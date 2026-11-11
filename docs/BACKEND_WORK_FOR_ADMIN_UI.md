# Admin UI Enhancement — Backend Requirements for Developer

> **Context:** The GyanGrid admin frontend has been comprehensively redesigned with an advanced, production-ready UI. This document details all the backend work needed to support the new admin features, plus existing pending backend tasks discovered during this upgrade.
>
> Base URL: `https://gyaangrid-backend.onrender.com/api/v1`
> All admin routes require `Authorization: Bearer <firebase-id-token>` and an admin role.

---

## 🔴 P0 — Blockers (Must fix before launch)

### 1. Test session answer duplication (EXISTING BUG)
**Problem:** `PATCH /tests/sessions/:id/answer` appends a new entry instead of upserting. The result then shows wrong marks and broken per-question breakdown.

**Fix:** Upsert by `questionId` — if an answer for that `questionId` already exists, replace it. Grade the final state only.

**Affected endpoint:** `PATCH /tests/sessions/:id/answer`

---

### 2. Double test start race condition (EXISTING BUG)
**Problem:** Two concurrent `POST /tests/:id/start` calls create two sessions.

**Fix:** Add a unique index on `(studentId, testId, status: 'ACTIVE')` or use a database transaction/findOneAndUpdate with upsert semantics.

**Affected endpoint:** `POST /tests/:id/start`

---

### 3. Failed AI follow-up leaks provider details and counts quota (EXISTING BUG)
**Problem:** `POST /doubts/:id/follow-up` returns `400: "Groq could not accept..."` and still increments `usedToday`.

**Fix:**
- Catch all provider errors and return `503 SERVICE_UNAVAILABLE` with a neutral user message
- Do NOT increment the quota counter on provider errors
- Investigate why Groq rejects follow-up requests (likely a message array format issue)

**Affected endpoint:** `POST /doubts/:id/follow-up`

---

### 4. Admin 2FA not enforced (SECURITY — EXISTING)
**Problem:** Protected admin routes return `200` without a verified 2FA code.

**Fix:** Enforce the 2FA session guard on all `/admin/*` routes in production. The frontend already handles the `gg:two-factor-required` event and re-directs to the 2FA page.

---

## 🟠 P1 — New Backend Needed for Enhanced Admin UI

### 5. Analytics endpoint — enhanced data for dashboard KPI tiles
**Current:** `GET /admin/analytics` returns a basic overview object  
**New dashboard needs:**
- DAU trend: percentage change vs previous period (e.g., `dauTrend: +12.5`)
- WAU count
- Registrations count + trend
- Challenge completion rate
- Doubts today count
- AI tokens today + cost in INR
- Open moderation count
- Approved question count + questions in review queue count

**Recommended response shape:**
```json
{
  "analytics": {
    "users": {
      "dau": 342,
      "dauTrend": 12.5,
      "wau": 1850,
      "registrations": 28,
      "registrationsTrend": -3.2
    },
    "content": {
      "challengeCompletion": 71,
      "doubtsToday": 156,
      "approvedQuestions": 2840,
      "reviewQueue": 12
    },
    "ai": {
      "aiTokensToday": 2400000,
      "aiCostTodayInr": 48.50,
      "aiBudgetUsedPct": 62
    },
    "moderation": {
      "openModeration": 3
    }
  }
}
```

---

### 6. Daily analytics series — 14-day trend data
**Current:** `GET /admin/analytics/daily?from=&to=` exists but may be incomplete  
**Needed fields per day:**
```json
{
  "date": "11-11",
  "dau": 342,
  "registrations": 28,
  "challengesCompleted": 410,
  "doubts": 156,
  "aiCostInr": 48.50
}
```
Ensure all these fields are present and not null.

---

### 7. Weak topics analytics
**Endpoint:** `GET /admin/analytics/weak-topics`  
**Needed response:**
```json
{
  "weakTopics": [
    {
      "topicId": "...",
      "name": "Linear Equations",
      "classNumber": 8,
      "accuracy": 32,
      "totalAttempts": 1240
    }
  ]
}
```
Top 10 topics by lowest accuracy across all students.

---

### 8. Admin student list — pagination
**Current:** `GET /admin/students` returns all students (up to `limit=100`)  
**Problem:** No real server-side pagination. With 1000+ students this becomes slow.

**Fix:** Implement proper cursor/offset pagination:
- `GET /admin/students?page=1&limit=20&search=...&status=...&classId=...`
- Return: `{ students: [...], total: 1250, page: 1, limit: 20, hasMore: true }`

---

### 9. Admin students — per-student gamification summary (EXISTING, NEEDS VERIFICATION)
**Current:** `GET /admin/students/:id` should return gamification data  
**Ensure these fields are present:**
```json
{
  "gamification": {
    "totalXp": 1250,
    "goldCoins": 85,
    "currentStreak": 7
  },
  "learningSummary": {
    "attempts": 342,
    "testsAttempted": 12,
    "accuracy": 73.5
  }
}
```

---

### 10. Question performance stats
**Endpoint:** `GET /admin/questions/:id/performance`  
**Ensure this returns:**
```json
{
  "performance": {
    "totalAttempts": 850,
    "correctAttempts": 612,
    "accuracy": 72.0,
    "averageTimeSeconds": 45
  }
}
```
Currently this endpoint exists but the response shape varies. Standardize it.

---

### 11. Config history endpoint
**Endpoint:** `GET /admin/config/history?page=1&limit=30`  
**Needed response:**
```json
{
  "history": [
    {
      "key": "dailyChallengeQuestionCount",
      "before": 5,
      "after": 7,
      "byEmail": "admin@gyaangrid.com",
      "createdAt": "2026-11-10T14:30:00Z"
    }
  ],
  "total": 45
}
```

---

### 12. Bulk question import — validation endpoint
**Endpoint:** `POST /admin/questions/bulk-import/validate`  
**Status:** May return 404 on current backend  
**Fix:** Implement this endpoint. It receives an array of question objects and returns per-row validation results:
```json
{
  "rows": [
    { "row": 1, "valid": true, "errors": [] },
    { "row": 2, "valid": false, "errors": ["Topic does not exist"] }
  ]
}
```

---

### 13. Moderation — dismiss action support
**Current:** The frontend sends `action: 'DISMISSED'` but the backend may not support it  
**Fix:** `POST /admin/moderation/:id/resolve` should accept `action` values: `CORRECTED`, `RETIRED_QUESTION`, `ANNOTATED_KB`, `ESCALATED`, `DISMISSED`

---

### 14. Audit log — filtering support
**Current:** `GET /admin/audit-logs` accepts no filters  
**New UI needs:**
- `?action=QUESTION_PUBLISHED` — filter by action type
- `?resource=QUESTION` — filter by resource type
- `?from=2026-11-01&to=2026-11-11` — date range filter

These are optional (UI shows them but falls back gracefully if backend doesn't support them).

---

## 🟡 P2 — Configuration & Infrastructure

### 15. Firebase Storage — PDF uploads
**Status:** `POST /admin/uploads/signed-url` returns 503  
**Required for:** Admin PDF upload in Study Material page, Knowledge Base PDF upload  
**Fix:** Configure Firebase Storage bucket, set up CORS to allow `PUT` from the web domain, implement the signed URL flow:
1. `POST /admin/uploads/signed-url` → returns `{ uploadId, signedUrl, publicUrl }`
2. Client PUTs file directly to `signedUrl`
3. `POST /admin/uploads/:uploadId/complete` → returns `{ publicUrl }`

---

### 16. Knowledge Base — document management
**Endpoints needed (verify they exist and work):**
- `GET /admin/kb` → list all KB documents
- `POST /admin/kb` → add document (title, description, fileType, sourceUrl)
- `POST /admin/kb/:id/reindex` → trigger re-indexing
- `DELETE /admin/kb/:id` → remove document

**Document response shape:**
```json
{
  "_id": "...",
  "title": "NCERT Class 8 Math",
  "description": "...",
  "status": "INDEXED",
  "chunks": 420,
  "lastSyncAt": "2026-11-10T10:00:00Z",
  "error": null
}
```

---

### 17. CORS restriction
**Current:** `Access-Control-Allow-Origin: *`  
**Fix:** Restrict to production domain(s) only. Add the Vercel preview domains pattern for staging.

---

### 18. Admin test series — fix chapterId mapping
**Problem:** When creating a test series via the admin, `chapterId` from the UI (a frontend ID) needs to map correctly to `classId` on the backend. The frontend adapter already handles this in `testBody()` but verify the backend accepts both.

---

## 🟢 P3 — Content & Performance

### 19. Seed minimum content for each class
Each class (6–10) needs at minimum:
- 5+ **published** (status: `PUBLISHED`) questions per topic (for Daily Challenge)
- At least one published study material per chapter

Current state: Only 1–3 published questions per chapter. The Daily Challenge will fail.

### 20. Response time optimisation
Current response times are too slow for production:
- `GET /daily-challenge`: 2–6s → target < 500ms (cache the generated challenge)
- `GET /home`: ~4s → target < 1s (reduce N+1 queries, cache aggregates)
- `GET /admin/analytics`: > 2s → add an aggregated analytics collection updated every 5 minutes

### 21. Backfill old test results
Old test session results calculated with the previous scoring logic (before the answer duplication fix) need to be recalculated. Script: for all sessions in `COMPLETED` state, re-evaluate `obtainedMarks` from the latest answer per `questionId`.

### 22. Fix `learning.syllabusTouchedPercent`
`GET /home` returns `learning.syllabusTouchedPercent: 0` even after studying 7 topics.  
Fix: Count distinct `topicId`s in the student's attempts/views, divide by total published topics for their class.

---

## 📋 Test Data Cleanup Before Go-Live

Remove these test records from the production database:

| Resource | ID |
|---|---|
| Chapter "TEST - Chapter" (Class 8, draft) | `6ae5c98f5f342a002015e7c5` |
| Topic "TEST - Topic" (draft) | `6ae5ca475f342a002015e7d3` |
| 3 archived materials in TEST topic | `6ae5cafc…`, `6ae5cb01…`, `6ae5cb05…` |
| Archived material on "Properties of Rational Numbers" | `6ae5cad35f342a002015e7d6` |
| Dismissed question report | `6ae5ce9d5f342a002015e809` |
| AI answer report (open) | doubt `6aeeaccef640d445803b614d` |
| Test student + all activity | user `6ae498487eed2b764699f614` |

---

## 🔧 Frontend API Contract Changes Required

The following are **breaking changes** the frontend needs to consume once the backend is updated. The frontend is already written to handle them gracefully, but the backend must implement them first:

### A. `GET /admin/analytics` — richer shape
See item #5 above. Current frontend `DashboardPage.jsx` reads `analytics.users.dau`, `analytics.content.*`, etc. The backend currently returns a flat object — nest it into sections as shown.

### B. `GET /admin/students` — pagination fields
Frontend expects: `{ students: [...], total: N }`. Ensure `total` is the full count, not `students.length`.

### C. `GET /admin/audit-logs` — consistent field names
Frontend maps: `a.adminEmail || a.actorEmail || a.userEmail` for actor. Standardize to `adminEmail`.

### D. `GET /admin/questions/:id/performance` — consistent shape
Frontend tries: `d.performance || d.stats`. Standardize to returning `{ performance: { totalAttempts, correctAttempts, accuracy, averageTimeSeconds } }`.

---

## ✅ Already Working (Verified 7 Nov 2026)

- `GET /auth/me` — admin role verification ✓
- `POST /admin/auth/2fa/setup` and `/verify` ✓
- `GET /admin/curriculum/classes`, `/chapters`, `/topics` ✓
- `includeTopics=true` on chapters ✓
- `POST/PATCH/DELETE /admin/curriculum/chapters` and `/topics` ✓
- `GET/POST/PATCH /admin/materials` ✓
- `PATCH /admin/materials/:id/status` ✓
- `GET /admin/materials/:id/history` ✓
- `GET/POST/PUT/PATCH/DELETE /admin/questions` ✓
- `PATCH /admin/questions/:id/status` ✓
- `GET/POST/PUT/DELETE /admin/tests` ✓
- `GET/POST/PUT/DELETE /admin/test-series` ✓
- `GET /admin/students` and `/:id` ✓
- `PATCH /admin/students/:id/status` ✓
- `GET /admin/config` and `PATCH /admin/config/:key` ✓
- `GET /admin/moderation` and `POST /:id/resolve` ✓
- `GET /admin/audit-logs` ✓
- `GET /admin/analytics` (basic) ✓
- `GET /admin/analytics/daily` ✓
- `GET /admin/analytics/weak-topics` ✓

---

*Document generated: 11 Nov 2026 | Frontend version: post-UI-overhaul | Contact: frontend team for any API shape questions*

