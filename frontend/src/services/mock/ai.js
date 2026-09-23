/**
 * Mock of the server-side AI service (section 18). In production these run behind the backend proxy
 * and call the LLM with retrieval; the client never talks to the provider (non-negotiable, SEC-01).
 * Output follows the strict JSON contract in 18.2 so the UI is built against the real shape.
 */
import { seeded } from '@/lib/random';
import { AI_REFUSAL_MESSAGE } from '@/config/constants';
import { generateQuestion } from './content/generators';
import { allTopics } from './content/curriculum';

const SAFETY = /\b(suicide|kill myself|self[- ]?harm|hurt myself|want to die|abuse[ds]?|beat(s|ing)? me|touch(ed|es) me|nobody loves me|depress(ed|ion))\b/i;
const NON_MATH = /\b(essay|history|civics|prime minister|president|joke|movie|film|song|lyrics|cricket|football|capital of|chemistry|physics|biology|poem|story|weather|video game|who is|who was|geography|grammar|translate|recipe|celebrity|news|election|girlfriend|boyfriend|instagram|youtube|hack|password)\b/i;
const MATH_SIGNAL = /(\d\s*[-+*/×÷^=]\s*\d|\bx\b|[=√π%]|\b(solve|find|calculate|evaluate|simplify|expand|factori[sz]e|area|perimeter|volume|angle|triangle|circle|radius|equation|fraction|percent|ratio|proportion|probability|mean|median|mode|square|cube|root|polynomial|integer|decimal|lcm|hcf|prime|sin|cos|tan|quadrilateral|parallelogram|graph|coordinate|interest|profit|loss|discount|exponent|power)\b)/i;
const BEYOND_10 = /\b(derivative|differentiat|integra(l|te|tion)|limit of|matri(x|ces)|determinant|vector|complex number|logarithm|log\s*\d|permutation|combination|binomial theorem|calculus)\b/i;
const HIGHER_BY_CLASS = [
  { minClass: 10, re: /\b(trigonometr|sin|cos|tan|cot|sec|cosec|quadratic|arithmetic progression|\bap\b|nth term)\b/i, name: 'trigonometry, quadratics and progressions' },
  { minClass: 9, re: /\b(polynomial|heron|coordinate geometry|euclid|irrational|cyclic quadrilateral)\b/i, name: 'polynomials and coordinate geometry' },
  { minClass: 8, re: /\b(cube root|square root|identities|factori[sz]ation|compound interest)\b/i, name: 'roots, identities and factorisation' },
];

const FAMILY_KEYWORDS = [
  ['linear', /\b(solve|equation)\b|=/i],
  ['mensuration', /\b(area|perimeter|volume|surface|rectangle|trapezium|cuboid|cylinder|cm²|cm2)\b/i],
  ['angles', /\b(angle|triangle|degree|supplement|complement|parallel|transversal)\b/i],
  ['percent', /%|\b(percent|discount|profit|loss|interest|gst)\b/i],
  ['probability', /\b(probability|dice|die|coin|cards?)\b/i],
  ['squares', /√|\b(square root|sqrt|perfect square)\b/i],
  ['data', /\b(mean|median|mode|average|data)\b/i],
  ['algebra', /\b(expand|identity|identities|factori[sz]e|simplify)\b/i],
  ['exponents', /\^|\b(power|exponent)\b/i],
  ['fractions', /\b(fraction|numerator|denominator)\b|\d\s*\/\s*\d/i],
  ['ratio', /\b(ratio|proportion|unitary)\b/i],
  ['integers', /-\d/],
];

export function classifyQuestionScope(text = '', classId = 8) {
  if (SAFETY.test(text)) return { scope: 'SAFETY' };
  const hasMath = MATH_SIGNAL.test(text);
  if (NON_MATH.test(text) && !(/\b(solve|equation|area|angle)\b/i.test(text) && hasMath)) return { scope: 'OUT_OF_SCOPE' };
  if (!hasMath) return { scope: 'OUT_OF_SCOPE' };
  if (BEYOND_10.test(text)) return { scope: 'HIGHER_CLASS', higherTopic: 'advanced mathematics (Class 11–12)' };
  const higher = HIGHER_BY_CLASS.find((h) => classId < h.minClass && h.re.test(text));
  if (higher) return { scope: 'HIGHER_CLASS', higherTopic: higher.name };
  return { scope: 'IN_SYLLABUS' };
}

/* ---------- tiny symbolic helpers so common doubts get a genuinely correct answer ---------- */

function parseLinearSide(side) {
  let s = side.replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/×/g, '*');
  // expand k(a x + b)
  s = s.replace(/(-?\d*\.?\d*)\*?\(([^()]+)\)/g, (_, k, inner) => {
    const kk = k === '' || k === '+' ? 1 : k === '-' ? -1 : Number(k);
    const { a, b } = parseLinearSide(inner) || { a: 0, b: 0 };
    return `${a * kk >= 0 ? '+' : ''}${a * kk}x${b * kk >= 0 ? '+' : ''}${b * kk}`;
  });
  s = s.replace(/\+\+|--/g, '+').replace(/\+-|-\+/g, '-');
  if (!/^[+-]/.test(s)) s = `+${s}`;
  if (!/^([+-](\d+\.?\d*)?\*?x?)+$/.test(s)) return null;
  let a = 0;
  let b = 0;
  const re = /([+-])(\d*\.?\d*)\*?(x?)/g;
  let m;
  while ((m = re.exec(s)) && m[0] !== '') {
    if (m[0] === '+' || m[0] === '-') break;
    const sign = m[1] === '-' ? -1 : 1;
    const num = m[2] === '' ? 1 : Number(m[2]);
    if (m[3]) a += sign * num; else b += sign * num;
  }
  return { a, b };
}

const fmt = (n) => (Number.isInteger(n) ? `${n}` : `${Math.round(n * 1000) / 1000}`);
const lin = (a, b) => {
  const xs = a === 0 ? '' : a === 1 ? 'x' : a === -1 ? '-x' : `${fmt(a)}x`;
  const bs = b === 0 ? '' : `${xs ? (b > 0 ? ' + ' : ' - ') : ''}${xs ? fmt(Math.abs(b)) : fmt(b)}`;
  return `${xs}${bs}` || '0';
};

function trySolveLinear(text) {
  const m = /([-\d\s.x+*()−–]+)=([-\d\s.x+*()−–]+)/i.exec(text.replace(/X/g, 'x'));
  if (!m || !/x/.test(m[0])) return null;
  const L = parseLinearSide(m[1]);
  const R = parseLinearSide(m[2]);
  if (!L || !R || L.a === R.a) return null;
  const A = L.a - R.a;
  const B = R.b - L.b;
  const x = B / A;
  return {
    equation: `${lin(L.a, L.b)} = ${lin(R.a, R.b)}`,
    steps: [
      `Write the equation: $${lin(L.a, L.b)} = ${lin(R.a, R.b)}$`,
      `Move the $x$ terms to the left and the numbers to the right (each term changes sign as it crosses "="): $${fmt(L.a)}x ${R.a >= 0 ? '-' : '+'} ${fmt(Math.abs(R.a))}x = ${fmt(R.b)} ${L.b >= 0 ? '-' : '+'} ${fmt(Math.abs(L.b))}$`,
      ...(A === 1
        ? [`Simplify both sides: $x = ${fmt(B)}$`]
        : [`Simplify both sides: $${lin(A, 0)} = ${fmt(B)}$`, `Divide both sides by ${fmt(A)}: $x = ${fmt(x)}$`]),
      `Check: left side $= ${fmt(L.a * x + L.b)}$ and right side $= ${fmt(R.a * x + R.b)}$ ✓`,
    ],
    answer: fmt(x),
    mistake: R.a !== 0
      ? `A common slip here is moving $${fmt(R.a)}x$ to the left without changing its sign. When a term crosses the "=" sign, + becomes − and − becomes +.`
      : 'A common slip is subtracting the constant on only one side. Whatever you do to one side, do to the other.',
  };
}

function trySolveArea(text) {
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number);
  if (/triangle/i.test(text) && /base/i.test(text) && /height/i.test(text) && nums.length >= 2) {
    const [b, h] = nums;
    return {
      steps: ['Area of a triangle $= \\frac{1}{2} \\times \\text{base} \\times \\text{height}$', `Substitute: $\\frac{1}{2} \\times ${b} \\times ${h}$`, `$= ${fmt((b * h) / 2)}$ square units`],
      answer: fmt((b * h) / 2),
      mistake: 'Many students forget the $\\frac{1}{2}$. A triangle is exactly half of a rectangle with the same base and height.',
    };
  }
  if (/rectangle/i.test(text) && nums.length >= 2) {
    const [l, w] = nums;
    return {
      steps: ['Area of a rectangle $= \\text{length} \\times \\text{breadth}$', `$= ${l} \\times ${w}$`, `$= ${fmt(l * w)}$ square units`],
      answer: fmt(l * w),
      mistake: 'Do not confuse area ($l \\times b$) with perimeter ($2(l + b)$).',
    };
  }
  return null;
}

function trySolvePercent(text) {
  const m = /(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i.exec(text);
  if (!m) return null;
  const [pc, n] = [Number(m[1]), Number(m[2])];
  return {
    steps: [`$${pc}\\% = \\frac{${pc}}{100}$`, `$\\frac{${pc}}{100} \\times ${n} = ${fmt((pc * n) / 100)}$`],
    answer: fmt((pc * n) / 100),
    mistake: 'Remember that “of” means multiply, and per cent means divide by 100.',
  };
}

const CONCEPTS = {
  linear: 'Solving a linear equation in one variable',
  mensuration: 'Area and perimeter of plane figures',
  angles: 'Angle properties of lines and triangles',
  percent: 'Percentages and their applications',
  probability: 'Theoretical probability',
  squares: 'Squares and square roots',
  data: 'Mean, median and mode',
  algebra: 'Algebraic identities and simplification',
  exponents: 'Laws of exponents',
  fractions: 'Operations on fractions',
  ratio: 'Ratio and proportion',
  integers: 'Operations on integers',
};

const MISTAKE_PATTERNS = {
  linear: 'Moving a term across “=” without changing its sign is the most common error in this topic.',
  mensuration: 'Mixing up area and perimeter, or forgetting the ½ in the triangle formula, causes most mistakes here.',
  angles: 'Students often use 90° where 180° applies. Check whether the angles lie on a straight line or form a right angle.',
  percent: 'Taking the percentage of the wrong base value (e.g. selling price instead of cost price) is the usual slip.',
  probability: 'Counting favourable or total outcomes incorrectly — list them out to be sure.',
  squares: 'Confusing squaring with doubling (e.g. $5^2 = 10$) is a frequent error.',
  data: 'Forgetting to sort data before finding the median is the most common mistake.',
  algebra: 'Writing $(a + b)^2 = a^2 + b^2$ — the middle term $2ab$ is missing.',
  exponents: 'Multiplying exponents instead of adding them when bases are multiplied.',
  fractions: 'Adding denominators together instead of finding a common denominator.',
  ratio: 'Treating an inverse proportion as a direct one.',
  integers: 'Sign errors when subtracting a negative number.',
};

function detectFamily(text) {
  const hit = FAMILY_KEYWORDS.find(([, re]) => re.test(text));
  return hit ? hit[0] : 'linear';
}

function topicFor(classId, family) {
  const topics = allTopics(classId);
  return topics.find((t) => t.family === family) || topics[0];
}

function followUp(family, seed, level = 'EASY') {
  const q = generateQuestion(family, seeded(seed), level);
  return {
    text: q.text,
    answer_type: q.type === 'NUMERIC' ? 'NUMERIC' : 'MCQ',
    options: q.options || [],
    expected_answer: q.correctAnswer,
    tolerance: q.answerTolerance || 0,
    explanation: q.explanation,
  };
}

/** callDoubtSolver() — returns the 18.2 structured contract. */
export function callDoubtSolver({ text, classId, seed }) {
  const family = detectFamily(text);
  const topic = topicFor(classId, family);
  const solved = (family === 'linear' && trySolveLinear(text)) || trySolveArea(text) || trySolvePercent(text);
  const example = generateQuestion(family, seeded(`${seed}:ex`), 'EASY');

  const steps = solved?.steps || [
    'Read the question carefully and underline what is given and what is asked.',
    `Identify the idea being tested: ${CONCEPTS[family] || 'the core concept of this chapter'}.`,
    ...example.explanation.map((s, i) => (i === 0 ? `Apply the method — for instance: ${s}` : s)),
    'Write your final answer with the correct units, then check it by substituting back.',
  ];

  return {
    in_syllabus: true,
    topic_id: topic?.id,
    topic_name: topic?.name,
    concept: CONCEPTS[family] || topic?.name,
    mistake_identification: solved?.mistake || MISTAKE_PATTERNS[family],
    step_by_step: steps,
    final_answer: solved?.answer || null,
    worked_example: `${example.text.replace(/\.$/, '')} → ${example.explanation[example.explanation.length - 1]}`,
    follow_up_question: followUp(family, `${seed}:fu`),
    difficulty_level: 'MEDIUM',
    safety_flag: false,
    grounded: true,
  };
}

/** Simpler re-explanation after a wrong follow-up (F7-07). */
export function reExplain({ family, seed, round }) {
  const example = generateQuestion(family, seeded(`${seed}:re${round}`), 'EASY');
  return {
    intro: round === 1
      ? "No worries — let's try it a different way, one small step at a time."
      : "Let's slow down even more. Look at just one step at a time.",
    concept: CONCEPTS[family] || 'the key idea',
    step_by_step: [
      round === 1 ? 'Think of it like a see-saw: both sides must stay balanced.' : 'First, write down only what the question gives you.',
      ...example.explanation,
    ],
    follow_up_question: followUp(family, `${seed}:fu${round}`),
  };
}

export const familyOfText = detectFamily;

export function refusal(kind, extra = {}) {
  if (kind === 'SAFETY') {
    return {
      in_syllabus: false,
      safety_flag: true,
      message: "It sounds like something difficult might be going on. You don't have to handle it alone — please talk to a parent, a teacher or another adult you trust today. If you are in danger right now, call 112 or the child helpline 1098 (free, 24×7).",
    };
  }
  if (kind === 'HIGHER_CLASS') {
    return {
      in_syllabus: false,
      higher_class: true,
      message: `This question uses ${extra.higherTopic}, which comes in a higher class. Let's build the foundation first — it will make that topic much easier later.`,
      foundation: extra.foundation,
    };
  }
  return { in_syllabus: false, safety_flag: false, message: AI_REFUSAL_MESSAGE };
}

/** Mock OCR for photographed doubts. */
export function readImage({ width, height, seed }) {
  if (width && height && Math.max(width, height) < 240) return { unclear: true };
  const samples = [
    'Solve: 3(x - 2) = 2x + 5',
    'Solve for x: 5x - 3 = 2x + 9',
    'Find the area of a triangle whose base is 14 cm and height is 9 cm.',
    'Find 15% of 360.',
  ];
  return { unclear: false, text: seeded(seed).pick(samples) };
}

/** Mock speech-to-text (provider pending D-03). */
export function transcribe({ durationSec, seed }) {
  if (!durationSec || durationSec < 1) return { transcript: '' };
  const samples = [
    'Find the area of a triangle whose base is 12 centimetres and height is 8 centimetres',
    'Solve 7x minus 5 equals 3x plus 11',
    'What is 20 percent of 450',
  ];
  const t = seeded(seed).pick(samples)
    .replace('7x minus 5 equals 3x plus 11', '7x - 5 = 3x + 11')
    .replace('20 percent of', '20% of');
  return { transcript: t };
}

/** explainMistake() — concept + likely-error diagnosis, cached permanently on the record (F8-05). */
export function explainMistake(mistake, family) {
  const snap = mistake.questionSnapshot;
  const last = mistake.attempts[mistake.attempts.length - 1]?.answer;
  let likelyError = MISTAKE_PATTERNS[family] || 'Re-read the question and check each step carefully.';
  if (snap.type === 'NUMERIC' && last != null && last !== '') {
    const g = Number(last);
    const c = Number(snap.correctAnswer);
    if (!Number.isNaN(g)) {
      if (g === -c && c !== 0) likelyError = `Your answer ${g} has the right size but the wrong sign. Check each step where a term moved across “=” or a negative number was subtracted.`;
      else if (c !== 0 && (Math.abs(g / c - 10) < 1e-6 || Math.abs(g / c - 0.1) < 1e-6)) likelyError = `Your answer ${g} is off by a factor of 10 — the decimal point has probably slipped.`;
      else if (c !== 0 && Math.abs(g / c - 2) < 1e-6) likelyError = `Your answer ${g} is exactly double the correct value. Did you miss a “÷ 2” or “½” somewhere?`;
      else if (c !== 0 && Math.abs(g / c - 0.5) < 1e-6) likelyError = `Your answer ${g} is exactly half the correct value — one factor of 2 went missing.`;
    }
  }
  return {
    whyCorrect: snap.conceptNote || `This question tests ${CONCEPTS[family] || 'a core idea from this chapter'}. Follow the worked steps and notice how each one follows from the rule.`,
    likelyError,
    generatedAt: new Date().toISOString(),
    promptVersion: 'explain-mistake-v2',
  };
}

/** 3-line performance summary + one next step for tests (F6-10). */
export function testSummary({ scorePct, weakest, strongest, skipped }) {
  const lines = [
    scorePct >= 80 ? `Excellent work — you scored ${scorePct}%, well above the class average.` : scorePct >= 50 ? `Good effort — you scored ${scorePct}%. You are on the right track.` : `You scored ${scorePct}%. Every test shows us exactly what to work on next.`,
    strongest ? `Your strongest area was ${strongest}.` : 'You attempted questions across the whole test.',
    weakest ? `${weakest} needs the most attention right now.` : skipped ? `You skipped ${skipped} question${skipped > 1 ? 's' : ''} — try every question next time; there may be no penalty.` : 'Keep the momentum going with a short practice set.',
  ];
  return { lines, nextStep: weakest ? `Practise 10 questions on ${weakest}, then review its mistakes.` : 'Take the next test in your series.' };
}

/** summariseForParent() — one plain-language line from aggregates only (F11). */
export function parentSuggestion(firstName, weakTopic) {
  if (!weakTopic) return `Ask ${firstName} to show you one question they solved this week and explain how — teaching is the best revision.`;
  return `Ask ${firstName} to explain ${weakTopic} to you out loud — it is this week's topic that needs the most attention.`;
}
