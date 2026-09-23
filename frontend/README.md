# Gyaangrid — Web Frontend (React)

The responsive web frontend for **Gyaangrid**, an AI-powered Mathematics tutor for Classes 6–10 (NCERT / CBSE), built from *PRD v2.0 (Developer Specification)*.

It has two surfaces:

- **Student web app**: onboarding with parental consent, Home, Learn, Practice, Daily Challenge, Tests & Test Series, AI Doubt Solver, Mistake Bank, Progress, Leaderboard, Rewards, Profile and Settings.
- **Admin console** (`/admin`): role-gated with 2FA. Covers curriculum, study material, question bank with CSV import, test and series builder, AI knowledge base, remote config, students, moderation and the audit log.

Everything currently runs against an **in-browser mock API** that follows the PRD's API contract and business rules. Switching to the real backend is a configuration change (see [Connecting the real backend](#connecting-the-real-backend)).

---

## Quick start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build` (production build), `npm run preview` (serve the build), `npm run lint`.

Requires Node 18+ (tested on Node 22).

### Demo accounts (mock mode)

| Surface | Login | Notes |
|---|---|---|
| Student | `demo@gyaangrid.in` / `Demo@1234` | Class 8 student with about 3 weeks of history: streak, mistakes, tests and doubts. The login page has a **Fill in** button. |
| Student (Google) | "Continue with Google", then pick an account | "Use another account" creates a new student and goes through onboarding. |
| Admin: Super Admin | `superadmin@gyaangrid.in` / `Admin@1234` | 2FA code `123456` |
| Admin: Content Manager | `content@gyaangrid.in` / `Content@1234` | Can edit content. Config is read-only. |
| Admin: Support | `support@gyaangrid.in` / `Support@1234` | Students, moderation and audit. |

You can also sign up with any email to experience onboarding from scratch.

Mock data is stored in `localStorage` (`gg:mockdb:v4`). To reset the demo, clear the site data or run `localStorage.clear()` in the browser console.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite 5, JavaScript (JSX) |
| Routing | React Router 6 (data router, route-level code splitting with `lazy`) |
| Styling | Tailwind CSS 3 with a custom design system (`src/components/ui`) |
| State | Zustand (session, celebrations) + a small stale-while-revalidate query cache (`src/hooks/useQuery.js`) |
| Maths | KaTeX: a single renderer for every question, explanation, AI answer and note (F3-07) |
| Charts | Recharts |
| Motion | Framer Motion, `canvas-confetti` (respects `prefers-reduced-motion`) |
| Toasts | Sonner |
| Icons | lucide-react |

---

## Project structure

```
src/
  App.jsx                 routes (lazy-loaded pages, guards, layouts)
  main.jsx                bootstrap: token provider, 401 handling
  config/                 env access + product constants
  lib/                    date (IST day boundary), formatting, validators, storage, image processing, analytics
  hooks/                  useQuery (SWR cache + offline persistence), online status, server countdown…
  store/                  zustand stores (student session, admin session, celebrations)
  services/
    http.js               the ONLY network entry point (real fetch or mock)
    errors.js             stable error codes + ApiError
    api/student.js        student API surface (section 20)
    api/admin.js          admin API surface (/admin/*)
    auth/googleProvider.js  integration point for Firebase Google sign-in
    mock/                 in-browser mock backend (delete once the real API is live)
      server.js           router + auth / consent / role guards
      engine.js           server-side rules: grading, mistakes, XP/coins ledgers, streaks, mastery, recommendations
      ai.js               mock AI service (scope classifier, doubt solver, explanations)
      seed.js             demo student + admin data
      content/            NCERT curriculum 6–10, question generators, materials, tests
      handlers/           route handlers per domain
  components/             ui kit, layouts, maths renderer, question components, feedback
  features/               one folder per product area (home, learn, practice, challenge, tests, doubts, mistakes, …, admin)
```

---

## Architecture notes

- **The server owns truth (PRD 2.1).** The UI never computes XP, coins, streaks, scores or mastery. It renders the server's summary and refetches after every submission. The mock server enforces the same rules the real backend must enforce.
- **No answer leakage (F4-04).** Questions reach the client without `correctAnswer` or `explanation`. Answers are revealed only in the grading response. Doubt follow-up answers stay server-side.
- **Idempotent rewards (F10-06).** Coin ledger ids are `{uid}_{YYYY-MM-DD}_{TYPE}`, and a re-submitted challenge returns `alreadySubmitted: true`.
- **Server day boundary (F5-05).** Every "today" is computed in Asia/Kolkata. The test timer counts down from the server's `remainingSec` using a monotonic clock, so changing the device clock has no effect.
- **Consent gate (F1-07).** Content and AI routes return `403 CONSENT_REQUIRED` without a consent record. UI route guards only improve UX; they are not the security boundary.
- **Class isolation (F3-01).** Requesting another class's content returns 403.
- **Offline (F2-07, NFR-03).** Home, curriculum, topics (last 3 cached) and progress render from cache. Challenge answers queue locally and flush on reconnect. Test autosave retries. Every CTA shows an offline state.
- **Safe rendering.** No raw HTML is ever injected. Study material uses a safe Markdown subset, and KaTeX runs with `trust: false`.
- **Privacy (section 21).** No third-party analytics or ad SDKs. `lib/analytics.js` is a first-party event stub. Parent contact is masked everywhere. Doubt content never appears on parent-facing surfaces or in admin, unless it was flagged.

---

## Connecting the real backend

1. Copy `.env.example` to `.env` and set:
   ```
   VITE_USE_MOCK_API=false
   VITE_API_BASE_URL=https://api.gyaangrid.in/v1
   ```
   With the mock disabled, the bundler drops the entire `services/mock` folder.
2. The backend must return the common envelope `{ ok, data, error: { code, message } }` (PRD section 20). Error codes are listed in `src/services/errors.js`.
3. Endpoints and payload shapes are defined in `src/services/api/student.js` and `src/services/api/admin.js`. The mock handlers in `src/services/mock/handlers/*` are the reference implementation of each response shape.
4. **Auth.** Replace the token persistence in `store/authStore.js` with the Firebase Auth SDK session, and have `setTokenProvider` in `main.jsx` return `auth.currentUser.getIdToken()`. Implement `services/auth/googleProvider.js` with `signInWithPopup`.
5. **Uploads and speech-to-text.** `DoubtsPage` and `VoiceDoubtInput` already request a signed URL before sending. Add the `PUT` of the blob to `uploadUrl` where the comments indicate.
6. Once everything is live, delete `src/services/mock/`.

---

## PRD coverage

| PRD | Where |
|---|---|
| F1 Auth, onboarding, consent | `features/auth/*`, `features/onboarding/OnboardingPage.jsx`: password rules, rate-limit messages, Google, 5-step onboarding, self-declared parental consent checkbox, avatar (skippable), email verification before rewards |
| F2 Home and profile | `features/home/HomePage.jsx`: challenge card (3 states), three-mode Ask a Doubt, review card, Continue Learning, tiles, AI recommendation, activity. `features/profile/*` |
| F3 Syllabus and material | `features/learn/*`: chapter/topic tree with mastery, notes, in-app PDF viewer (download disabled), video, 20-second "studied" tracking, offline cache for the last 3 topics |
| F4 Question bank | Admin `QuestionsPage`, `QuestionEditorPage`, `ImportPage` (CSV with row-level validation). Approval is blocked without an explanation. Students can report questions. |
| F5 Practice and Daily Challenge | `features/challenge/*`, `features/practice/*`: pinned challenge, resume, diagnosis, instant-feedback practice, "Ask a doubt about this question" |
| F6 Tests and series | `features/tests/*`: instructions, server-timed player, palette, mark for review, 10-second autosave, auto-submit, rank (10+ attempts), AI summary, solution filters, sequential series |
| F7 AI Doubt Solver | `features/doubts/*`: text with maths keypad, photo (crop/rotate/compress), voice (waveform, editable transcript), staged progress, structured blocks, follow-up with up to 2 re-explanations, history, rating and reporting, quotas |
| F8 Mistake Bank | `features/mistakes/*`: filters, search, sort, due-today, retry, concept and likely-error explanation, simpler explanation, practice-more, archive, history |
| F9 Progress and mastery | `features/progress/ProgressPage.jsx`: activity strip, trend with gaps, strengths framed as next steps, "how is this calculated" on every metric, mastery map |
| F10 Gamification | Header stats, `RewardsPage`, `LeaderboardPage` (top 20 plus own row, tie-break rules), celebrations. Referrals stay behind a flag. |
| F11 Parent report | `features/profile/ParentReportPage.jsx`: shows the student exactly what the report contains and excludes |
| F12 Admin console | `features/admin/*`: role-gated nav and API, 2FA, audit on every change |

### Assumptions and open items

- **Consent (D-07)** is blocked in the PRD. For now it is a student self-declaration ("I confirm that my parent or guardian knows…") plus agreement to the privacy terms, recorded with version, timestamp and method. Parent OTP can plug into the same step later.
- **Visual design** is not frozen (reference screenshots are pending). This is an original design system that can be re-themed through `tailwind.config.js` tokens.
- **Localisation (NFR-09):** UI strings are not yet extracted into a translation catalogue. Do this before adding Hindi.
- **Automated tests (NFR-12):** none are included in this frontend yet. The scoring, XP and streak logic that needs unit tests lives on the backend. Adding Vitest and Playwright is recommended next.
- **Reminders (F5-12)** and parent report delivery (F11) are backend jobs. The frontend exposes the settings and the transparency view.
- PDF and video blocks show a placeholder viewer in mock mode and embed the real, admin-attached links when they are provided.
