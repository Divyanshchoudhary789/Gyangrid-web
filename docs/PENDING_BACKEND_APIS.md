# Gyaangrid Backend — Round 4 Findings

Base URL: `https://gyaangrid-backend.onrender.com/api/v1`

Tested on 7 Nov 2026 with a real student account (Class 10) against the backend described in `FLUTTER_API_HANDOFF.md` (main `84e7db7`).

## Fixed and confirmed live

| Earlier issue | Result |
|---|---|
| Test scoring | Chapter 1 test, 2 correct → `obtainedMarks: 4 / 4`, `percentage: 100`, `passed: true` |
| Rewards summary | `GET /rewards/summary` = 95 XP / 10 coins, matching `/home` and the ledger |
| Mistake retry XP | Correct retry returned `awarded: { xp: 5 }` and resolved the mistake |
| Activity strip | Ends today (7 Nov, IST) |
| Completion breakdown | Top level, names filled in, answered questions only (challenge, practice, test) |
| AI doubts | Answer returned in about 8 s; refusal, feedback (+5 XP, +5 coins) and report all work |
| Material delete | `DELETE /admin/materials/:id` exists |
| Admin student detail | XP 205, coins 25, streak 1, consent and last-active shown |
| Nested curriculum | `includeTopics=true` works; the admin curriculum screen now makes 1 call instead of 13+ |
| Moderation | `resolvedByEmail` returned; reported doubts include their messages |

## New bugs (P0)

**1. Saving the same test answer twice adds a second entry, and the result then shows wrong marks.**
- Answering a question and then saving it again (autosave, or the student changing their answer) appends a new item to `session.answers` instead of replacing it. The new item has `isCorrect: null`.
- `GET /tests/sessions/:id/result` then builds each question's `isCorrect` / `obtainedMarks` and the chapter/topic `breakdown` from that last entry.
- Seen live on session `6aeeac2df640d445803b6146`: `result.correctCount: 2`, `obtainedMarks: 4`, but both questions show `isCorrect: false`, `obtainedMarks: 0 / 2`, and the chapter breakdown shows `0 / 2`.
- Fix: upsert one answer per `questionId` in `PATCH /tests/sessions/:id/answer`, and grade review entries from the final answer.

**2. Double test start still opens two sessions.** Two `POST /tests/:id/start` calls sent together created `…6145` and `…6146`. The handoff says re-starting resumes the active session, but concurrent starts race. Please enforce one active session per student and test (unique index or transaction). The web app now sends only one request per start, but other clients may not.

**3. Failed follow-up leaks provider details and still uses quota.**
- `POST /doubts/:id/follow-up` with "Can you explain it with a simpler example?" returned HTTP 400: "Groq could not accept this request. Check that the input format and size are supported."
- `/doubts/quota` then showed `usedToday: 2` after one answered doubt.
- The handoff says provider failures return 503 and are not charged. Please return 503 `SERVICE_UNAVAILABLE` with a neutral message, don't count the failed call, and check why Groq rejects the follow-up request.

## Other issues (P1)

**4.** Old test results were not recalculated with the new scoring. The 31 Oct attempt still shows 1 / 2 and "failed". Please backfill.

**5.** `learning.syllabusTouchedPercent` is still 0 with 7 topics studied.

**6.** `GET /doubts` returns `topicName: null` for a doubt about linear equations.

**7.** Old `ACTIVE` test sessions that have expired still appear in `/tests/history` with `isSession: true`. Finalise expired sessions, or mark them `EXPIRED`.

**8.** Simpler explanation is still disabled (503 "not enabled in the limited Groq integration"). The web app hides the button until it is enabled.

**9.** Image doubts are unsupported (503). The web app shows "Photo questions are coming soon".

**10.** Response time: `GET /daily-challenge` 2–6 s, `GET /home` about 4 s.

## Still to configure

| Item | Status |
|---|---|
| Firebase Storage bucket + CORS (`PUT` from the web domain) | Not configured: `POST /admin/uploads/signed-url` returned 503 on 7 Nov. Needed for voice doubts and admin PDF upload |
| Admin 2FA enforcement | Not enforced: protected admin routes returned 200 without a verified code on 7 Nov. Turn it on for production admins |
| Speech-to-text provider | Needed for voice doubts |
| Brevo + report link `https://<domain>/parent-report/view?token=…` | Parent report email and email OTP |
| App Check | If `FIREBASE_APP_CHECK_REQUIRED=true` is set, give the web team the reCAPTCHA v3 site key for `VITE_FIREBASE_APPCHECK_SITE_KEY` |
| CORS | Currently `*`; restrict to the production web domain |

## Content

At the last check each chapter had only 1–3 published questions, and no study material was published in the topics checked. The Daily Challenge needs 5 eligible questions per class.

## Test data to remove before go-live

| Item | ID |
|---|---|
| Chapter "TEST - Chapter" (draft), Class 8 | `6ae5c98f5f342a002015e7c5` |
| Topic "TEST - Topic" (draft) | `6ae5ca475f342a002015e7d3` |
| 3 archived materials in that topic | `6ae5cafc5f342a002015e7da`, `6ae5cb015f342a002015e7dd`, `6ae5cb055f342a002015e7e0` |
| Archived material on the real topic "Properties of Rational Numbers" | `6ae5cad35f342a002015e7d6` |
| Dismissed question report | `6ae5ce9d5f342a002015e809` |
| AI answer report (open) and doubt | doubt `6aeeaccef640d445803b614d` |
| Test student and all its activity | user `6ae498487eed2b764699f614` |
