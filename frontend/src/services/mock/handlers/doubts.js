import { ApiError, ERROR_CODES } from '../../errors';
import { getDb, userState } from '../db';
import { uid as makeId } from '@/lib/random';
import { nextIstMidnight } from '@/lib/date';
import { sanitizeText } from '@/lib/validators';
import { DOUBT_LIMITS } from '@/config/constants';
import { cfg, today, awardXp, awardCoins, upsertMistake, pushActivity, topicMeta, maybeBothBonus } from '../engine';
import {
  classifyQuestionScope, callDoubtSolver, refusal, reExplain, familyOfText, readImage, transcribe,
} from '../ai';
import { allTopics } from '../content/curriculum';

const nowIso = () => new Date().toISOString();

/** Quotas are enforced server-side BEFORE any provider call, all from remote config (F7-09). */
function checkQuota(uid, { image }) {
  const st = userState(uid);
  const limits = cfg().ai;
  const usage = st.doubtUsage[today()] || { count: 0, images: 0 };
  const month = today().slice(0, 7);
  const monthCount = Object.entries(st.doubtUsage).filter(([d]) => d.startsWith(month)).reduce((s, [, u]) => s + u.count, 0);
  const resetAt = nextIstMidnight().toISOString();
  if (usage.count >= limits.doubtsPerDay) {
    throw new ApiError(ERROR_CODES.QUOTA_EXCEEDED, `You've asked ${limits.doubtsPerDay} doubts today — that's the daily limit. It resets at midnight.`, { status: 429, details: { resetAt, kind: 'DAILY' } });
  }
  if (monthCount >= limits.doubtsPerMonth) {
    throw new ApiError(ERROR_CODES.QUOTA_EXCEEDED, 'You have reached this month’s doubt limit. It resets on the 1st.', { status: 429, details: { kind: 'MONTHLY' } });
  }
  if (image && usage.images >= limits.imagesPerDay) {
    throw new ApiError(ERROR_CODES.QUOTA_EXCEEDED, `You can send ${limits.imagesPerDay} photo doubts a day. Try typing this one instead!`, { status: 429, details: { resetAt, kind: 'IMAGE' } });
  }
  return usage;
}

function consumeQuota(uid, { image }) {
  const st = userState(uid);
  const u = st.doubtUsage[today()] || (st.doubtUsage[today()] = { count: 0, images: 0 });
  u.count += 1;
  if (image) u.images += 1;
}

function quotaInfo(uid) {
  const u = userState(uid).doubtUsage[today()] || { count: 0, images: 0 };
  const l = cfg().ai;
  return { usedToday: u.count, limit: l.doubtsPerDay, imagesUsed: u.images, imageLimit: l.imagesPerDay, resetAt: nextIstMidnight().toISOString() };
}

function listItem(d) {
  return {
    id: d.id, inputType: d.inputType, preview: d.input.text || d.input.transcript || 'Photo doubt', topicName: d.topicName,
    status: d.status, createdAt: d.createdAt, scope: d.scope, rating: d.rating,
  };
}

/** POST /doubts — validate → quota → classify scope → solver (section 12, flow 5.3). */
function createDoubt({ uid, user, body }) {
  const inputType = body.inputType;
  if (!['TEXT', 'IMAGE', 'VOICE'].includes(inputType)) throw new ApiError(ERROR_CODES.VALIDATION, 'Unknown input type.');
  if (inputType === 'VOICE' && !cfg().flags.voiceDoubts) throw new ApiError(ERROR_CODES.FORBIDDEN, 'Voice doubts are not available right now.', { status: 403 });
  let text = sanitizeText(body.text || '');
  if (inputType === 'VOICE') text = sanitizeText(body.transcript || '');
  if (inputType !== 'IMAGE' && !text) throw new ApiError(ERROR_CODES.VALIDATION, inputType === 'VOICE' ? "We couldn't hear a question. Please record again or type it." : 'Please type your question.');
  if (text.length > DOUBT_LIMITS.maxTextChars) throw new ApiError(ERROR_CODES.VALIDATION, `Please keep your question under ${DOUBT_LIMITS.maxTextChars} characters.`);
  const isImage = inputType === 'IMAGE';
  checkQuota(uid, { image: isImage });

  const classId = user.profile.classId;
  const id = makeId('dbt_');
  let ocrText = null;
  if (isImage) {
    if (!body.imageRef) throw new ApiError(ERROR_CODES.VALIDATION, 'Please add a photo of your question.');
    const read = readImage({ width: body.imageMeta?.width, height: body.imageMeta?.height, seed: id });
    if (read.unclear) {
      // Unclear image: ask for a clearer photo, never guess (22.1). No quota consumed.
      throw new ApiError(ERROR_CODES.VALIDATION, 'That photo is a little hard to read. Take it in good light with the full question inside the frame.', { details: { unclearImage: true } });
    }
    ocrText = read.text;
  }
  const analysedText = [text, ocrText].filter(Boolean).join(' ');
  const scope = classifyQuestionScope(analysedText, classId);
  consumeQuota(uid, { image: isImage });

  const st = userState(uid);
  const base = {
    id, uid, classId, inputType, date: today(), createdAt: nowIso(),
    input: { text: inputType === 'TEXT' ? text : null, transcript: inputType === 'VOICE' ? text : null, imageRef: body.imageRef || null, ocrText, note: isImage ? text || null : null },
    imageDataUrl: isImage ? body.imagePreview || null : null, // mock only: stands in for the private bucket object
    scope: scope.scope, rounds: [], followUps: [], rating: null, reported: false, flagged: false,
  };

  let doubt;
  if (scope.scope === 'IN_SYLLABUS') {
    const response = callDoubtSolver({ text: analysedText, classId, seed: id });
    doubt = { ...base, status: 'AWAITING_FOLLOW_UP', family: familyOfText(analysedText), topicId: response.topic_id, topicName: response.topic_name, response, reexplainCount: 0 };
  } else if (scope.scope === 'HIGHER_CLASS') {
    const foundation = allTopics(classId).find((t) => ['linear', 'algebra', 'exponents'].includes(t.family));
    doubt = { ...base, status: 'CLOSED', response: refusal('HIGHER_CLASS', { higherTopic: scope.higherTopic, foundation: foundation ? { topicId: foundation.id, name: foundation.name } : null }) };
  } else if (scope.scope === 'SAFETY') {
    doubt = { ...base, status: 'CLOSED', flagged: true, response: refusal('SAFETY') };
    // Safety content is never echoed back; a moderation flag is raised (AI-05)
    getDb().admin.moderation.unshift({ id: makeId('mod_'), type: 'SAFETY_FLAG', status: 'OPEN', doubtId: id, reason: 'Safety filter triggered', at: nowIso(), studentRef: `${uid.slice(0, 6)}…` });
  } else {
    doubt = { ...base, status: 'CLOSED', response: refusal('OUT_OF_SCOPE') };
  }
  st.doubts.unshift(doubt);
  if (doubt.topicName) pushActivity(uid, { type: 'DOUBT', title: 'Asked a doubt', detail: doubt.topicName, link: `/doubts/${id}` });
  return { ...publicDoubt(doubt), quota: quotaInfo(uid) };
}

function publicDoubt(d) {
  const r = d.response || {};
  const strip = (fu) => (fu ? { text: fu.text, answer_type: fu.answer_type, options: fu.options } : null); // expected answer stays server-side
  return {
    id: d.id, inputType: d.inputType, input: d.input, imageDataUrl: d.imageDataUrl, scope: d.scope, status: d.status, createdAt: d.createdAt,
    topicId: d.topicId, topicName: d.topicName, rating: d.rating, reported: d.reported,
    response: r.in_syllabus ? { ...r, follow_up_question: strip(r.follow_up_question) } : r,
    rounds: d.rounds.map((x) => ({ ...x, follow_up_question: strip(x.follow_up_question) })),
    followUps: d.followUps,
  };
}

/** POST /doubts/:id/follow-up — grade, re-explain up to max, reward on understanding (F7-07, F7-11). */
function followUp({ uid, user, params, body }) {
  const st = userState(uid);
  const d = st.doubts.find((x) => x.id === params.id);
  if (!d) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Doubt not found.', { status: 404 });
  if (d.status !== 'AWAITING_FOLLOW_UP') return { ...publicDoubt(d), reward: null };
  const current = d.rounds.length ? d.rounds[d.rounds.length - 1].follow_up_question : d.response.follow_up_question;
  const understoodClick = body.understood === true;
  const answer = String(body.answer ?? '').trim();
  if (!understoodClick && !answer) throw new ApiError(ERROR_CODES.VALIDATION, 'Type or choose your answer first.');

  let correct = false;
  if (!understoodClick) {
    if (current.answer_type === 'NUMERIC') correct = Math.abs(Number(answer) - Number(current.expected_answer)) <= Math.max(current.tolerance || 0, 1e-9);
    else correct = answer === String(current.expected_answer);
  }
  d.followUps.push({ answer: understoodClick ? null : answer, correct, understoodClick, at: nowIso(), expected: correct || d.reexplainCount >= cfg().ai.maxReexplain - 1 ? current.expected_answer : null, explanation: correct ? current.explanation : null });

  let reward = null;
  if (correct || understoodClick) {
    d.status = 'UNDERSTOOD';
    const xpc = cfg().xp;
    const xp = awardXp(uid, { type: 'DOUBT_UNDERSTOOD', amount: xpc.DOUBT_UNDERSTOOD, eventId: `xp_${d.id}`, capKey: 'DOUBT', cap: xpc.DOUBT_DAILY_CAP, label: 'Doubt understood' });
    let coins = 0;
    // Coin qualifies on a correct follow-up (or explicit "understood") the same day (15.2);
    // rewards need a verified email (F1-01)
    if (user.emailVerified) {
      const r = awardCoins(uid, { type: 'DOUBT_SOLVED', amount: cfg().coins.DOUBT_SOLVED.amount, sourceEventId: d.id, label: 'Doubt solved reward' });
      if (r.awarded) coins = r.entry.amount;
      const bonus = maybeBothBonus(uid);
      if (bonus) coins += bonus.amount;
    }
    reward = { xp, coins };
    pushActivity(uid, { type: 'DOUBT_UNDERSTOOD', title: 'Doubt solved', detail: d.topicName, link: `/doubts/${d.id}` });
  } else if (d.reexplainCount < cfg().ai.maxReexplain) {
    d.reexplainCount += 1;
    d.rounds.push(reExplain({ family: d.family, seed: d.id, round: d.reexplainCount }));
  } else {
    // After the max, session is NEEDS_HELP, topic flagged weak and a CONCEPT mistake is created (F7-07/08)
    d.status = 'NEEDS_HELP';
    const t = topicMeta(d.topicId);
    upsertMistake(uid, {
      questionId: `CONCEPT-${d.id}`, topicId: d.topicId, chapterId: t?.chapterId, classId: user.profile.classId, kind: 'CONCEPT',
      questionText: current.text, type: current.answer_type === 'NUMERIC' ? 'NUMERIC' : 'MCQ_SINGLE', options: current.options || [],
      correctAnswer: current.expected_answer, answerTolerance: current.tolerance || 0, explanation: current.explanation,
      conceptNote: d.response.concept ? `${d.response.concept}. ${d.response.mistake_identification}` : null, difficulty: 'EASY',
    }, answer, 'DOUBT');
    st.recommendation = null;
  }
  return { ...publicDoubt(d), lastFollowUp: d.followUps[d.followUps.length - 1], reward };
}

const listDoubts = ({ uid }) => ({ items: userState(uid).doubts.map(listItem), quota: quotaInfo(uid) });

function getDoubt({ uid, params }) {
  const d = userState(uid).doubts.find((x) => x.id === params.id);
  if (!d) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Doubt not found.', { status: 404 });
  return publicDoubt(d);
}

function rateDoubt({ uid, params, body }) {
  const d = userState(uid).doubts.find((x) => x.id === params.id);
  if (!d) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Doubt not found.', { status: 404 });
  if (body.rating) d.rating = body.rating === 'UP' ? 'UP' : 'DOWN';
  if (body.report && !d.reported) {
    d.reported = true;
    d.flagged = true;
    getDb().admin.moderation.unshift({
      id: makeId('mod_'), type: 'AI_ANSWER_REPORT', status: 'OPEN', doubtId: d.id, reason: (body.reason || 'Student reported this answer').slice(0, 200),
      at: nowIso(), studentRef: `${uid.slice(0, 6)}…`, topicName: d.topicName, snapshot: { input: d.input.text || d.input.transcript || d.input.ocrText, concept: d.response?.concept, steps: d.response?.step_by_step },
    });
  }
  return publicDoubt(d);
}

const quota = ({ uid }) => quotaInfo(uid);

/** Short-lived signed upload URL with MIME/size validation (F7-02, SEC-10). */
function signedUrl({ body }) {
  const okType = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
  if (!okType.includes(body.contentType)) throw new ApiError(ERROR_CODES.VALIDATION, 'This file type is not supported.');
  if (!body.size || body.size > DOUBT_LIMITS.maxImageMb * 1024 * 1024) throw new ApiError(ERROR_CODES.VALIDATION, `Files must be under ${DOUBT_LIMITS.maxImageMb} MB.`);
  const ref = `private/doubts/${makeId()}`;
  return { uploadUrl: `mock://upload/${ref}?sig=${makeId()}&exp=300`, objectRef: ref, expiresInSec: 300 };
}

function stt({ body }) {
  const dur = Number(body.durationSec) || 0;
  if (dur > DOUBT_LIMITS.maxVoiceSec + 1) throw new ApiError(ERROR_CODES.VALIDATION, `Recordings can be up to ${DOUBT_LIMITS.maxVoiceSec} seconds.`);
  return transcribe({ durationSec: dur, seed: body.objectRef || String(Date.now()) });
}

export const doubtRoutes = [
  { method: 'POST', path: '/doubts', auth: 'student', consent: true, handler: createDoubt },
  { method: 'GET', path: '/doubts', auth: 'student', consent: true, handler: listDoubts },
  { method: 'GET', path: '/doubts/quota', auth: 'student', consent: true, handler: quota },
  { method: 'GET', path: '/doubts/:id', auth: 'student', consent: true, handler: getDoubt },
  { method: 'POST', path: '/doubts/:id/follow-up', auth: 'student', consent: true, handler: followUp },
  { method: 'POST', path: '/doubts/:id/feedback', auth: 'student', consent: true, handler: rateDoubt },
  { method: 'POST', path: '/uploads/signed-url', auth: 'student', consent: true, handler: signedUrl },
  { method: 'POST', path: '/stt/transcribe', auth: 'student', consent: true, handler: stt },
];
