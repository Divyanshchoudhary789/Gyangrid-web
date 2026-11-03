# Gyaangrid — Web Frontend (React)

The responsive web frontend for **Gyaangrid**, an AI-powered Mathematics tutor for Classes 6–10 (NCERT / CBSE), built from *PRD v2.0 (Developer Specification)*.

It has two surfaces:

- **Student web app**: onboarding with parental consent, Home, Learn, Practice, Daily Challenge, Tests & Test Series, AI Doubt Solver, Mistake Bank, Progress, Leaderboard, Rewards, Profile and Settings.
- **Admin console** (`/admin`): sign-in with TOTP 2FA, curriculum, study material with PDF upload, question bank with CSV import, test and series builder, AI knowledge base, remote config, students, moderation, analytics and the audit log.

The app runs against the **live Gyaangrid backend** (Express + MongoDB, Firebase Auth). Mock data is **off**. Backend go-live items are listed in [`docs/PENDING_BACKEND_APIS.md`](../docs/PENDING_BACKEND_APIS.md).

An in-browser **mock API** (the original PRD reference implementation) is kept for demos. It is switched on with one env flag and is stripped from real builds (see [Modes](#modes-real-backend-vs-mock)).

---

## Quick start

```bash
cd frontend
npm install
cp .env.example .env # then fill in the values (ask the team lead; never commit .env)
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build` (production build), `npm run preview` (serve the build), `npm run lint`, `npm test` (adapter contract tests built from the Postman examples).

Requires Node 18+ (tested on Node 22).

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_USE_MOCK_API` | `false` (default) = live backend. `true` = in-browser mock for demos only. |
| `VITE_API_BASE_URL` | Backend base URL including `/api/v1`, no trailing slash. |
| `VITE_FIREBASE_*` | Firebase Web SDK config (Authentication only). |
| `VITE_MOCK_LATENCY_MS` | Simulated latency, mock mode only. |

`.env` is git-ignored. The Firebase **web** config is not a secret: it ships in every browser bundle, and access is protected by Firebase Auth plus backend token verification. Still, keep it in `.env` and set it in your hosting provider's environment settings rather than in code. In the Firebase console, restrict the API key to your production domains (HTTP referrers) and add the domains under *Authentication → Settings → Authorized domains*.

### Modes: real backend vs mock

- **Real (default):** sign up or sign in with email/password or Google (Firebase). The backend verifies the Firebase ID token on every call. Admins sign in at `/admin/login` with a Firebase account whose backend `role` is `admin`.
- **Mock:** set `VITE_USE_MOCK_API=true` and restart `npm run dev`. The demo accounts below apply. Real builds never include the mock code or its demo accounts.

### Demo accounts (mock mode only)

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
    http.js               the ONLY network entry point (real fetch with token refresh/retry, or mock)
    errors.js             stable error codes, backend errorCode mapping, ApiError
    api/student.js        picks real/ or studentMock.js by VITE_USE_MOCK_API
    api/admin.js          picks real/admin.js or adminMock.js
    api/real/             live-backend adapters: backend shapes → UI shapes, capability flags
      auth.js             Firebase sign-in + /auth/me + /profile
      student.js          home, learn, challenge, practice, tests, mistakes, progress, rewards, account
      admin.js            /admin/* adapter + `caps` (what the backend supports)
      curriculum.js       memoised public curriculum lookups
      questions.js        question/answer mapping (MCQ, TRUE_FALSE, SHORT_ANSWER)
      doubts.js           AI tutor conversation, quota, media upload, transcription
      uploads.js          direct PUT to signed storage URLs
      contract.test.js    adapters tested against the saved Postman responses
    auth/firebase.js      Firebase Auth (email/password, Google popup, reset, verification)
    mock/                 in-browser mock backend (demo mode only)
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
- **Safe rendering.** Backend study material (HTML) is sanitised with DOMPurify through `components/math/SafeHtml.jsx` (allow-listed tags, https-only images, links open with `rel=noopener`). Mock material uses a safe Markdown subset. KaTeX runs with `trust: false`.
- **Privacy (section 21).** No third-party analytics or ad SDKs. `lib/analytics.js` is a first-party event stub. Parent contact is masked everywhere. Doubt content never appears on parent-facing surfaces or in admin, unless it was flagged.

---

## Backend integration

- **Envelope:** `{ success, message, data }`; errors `{ success: false, message, errorCode }`, mapped to UI codes in `src/services/errors.js`.
- **Auth:** Firebase owns the session (`services/auth/firebase.js`). `main.jsx` gives `http.js` a token provider that returns a fresh Firebase ID token. On `401`, the token is force-refreshed and the request retried once. `features/auth/AuthBootstrap.jsx` waits for Firebase to restore the session before route guards run.
- **Render cold starts:** requests time out after 60 s (90 s for AI routes), and GETs retry once on network errors and 5xx gateway errors.
- **Adapters:** pages consume UI shapes. `services/api/real/*` maps backend responses onto them, so a backend field rename is a one-line fix there.
- **Capabilities:** `mistakeApi.capabilities` and `adminApi.caps` describe what the backend supports, so one set of pages serves both real and mock mode.
- **Provider outages:** a `503` from AI, speech, storage or email becomes `SERVICE_UNAVAILABLE`. Screens show a calm message, keep the student's input, and never show the raw server text.
- **Public parent report:** `/parent-report/view?token=…` is authorised only by the signed token from the email. No bearer token is sent.
- **Answer reveal:** server-graded answers for the challenge and practice are cached per user in `localStorage` (`rv:*`), so a refresh keeps the feedback. Test sessions (`ts:*`) are cached so a refresh resumes the test. Both are cleared on sign-out.

### Deploying

`npm run build` outputs a static site in `dist/`. Host it on any static host (Vercel, Netlify, Firebase Hosting, S3 + CloudFront) with an SPA fallback to `index.html`, and set the `VITE_*` variables in the host's build environment. `vercel.json` (SPA rewrite, security headers, immutable asset caching) and `public/_redirects` (Netlify) are included. Then:

1. Add the production domain to Firebase *Authorized domains*.
2. Add it to the backend's CORS allow-list.

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
| F12 Admin console | `features/admin/*`: admin-only access, TOTP 2FA (QR drawn on the device), audit log, moderation, knowledge base. The backend has one `admin` role, so finer roles appear only in mock mode. |

### Assumptions and open items

- **Consent (D-07)** is blocked in the PRD. For now it is a student self-declaration ("I confirm that my parent or guardian knows…") plus agreement to the privacy terms, recorded with version, timestamp and method. Parent OTP can plug into the same step later.
- **Visual design** is not frozen (reference screenshots are pending). This is an original design system that can be re-themed through `tailwind.config.js` tokens.
- **Localisation (NFR-09):** UI strings are not yet extracted into a translation catalogue. Do this before adding Hindi.
- **Automated tests (NFR-12):** none are included in this frontend yet. The scoring, XP and streak logic that needs unit tests lives on the backend. Adding Vitest and Playwright is recommended next.
- **Reminders (F5-12)** and parent report delivery (F11) are backend jobs. The frontend exposes the settings and the transparency view.
- PDF and video blocks show a placeholder viewer in mock mode and embed the real, admin-attached links when they are provided.
