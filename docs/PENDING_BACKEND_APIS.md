# Gyaangrid Backend — Before Go-Live

Base URL: `https://gyaangrid-backend.onrender.com/api/v1`

Checked on 30 Oct 2026 against `GyanGrid_Backend_Postman_Collection_Final.json`. All routes in the collection are live and integrated in the web frontend. What remains is the bugs below, then configuration and content.

## Bugs found in end-to-end testing (31 Oct 2026)

Found with a real student account on the live API, Class 10. The onboarding blocker from the last round is fixed.

### P0: wrong data shown to students

**1. Test marks ignore marks per question.** Test "Class 10 Mathematics - Chapter 1 Test" has `totalMarks: 4`, `passingMarks: 2`, 2 questions.
- With 1 correct and 1 wrong, `GET /tests/sessions/:id/result` returns `result.totalMarks: 2`, `obtainedMarks: 1`, `passed: false`, and each question has `totalMarks: 1`.
- Expected: `totalMarks: 4`, `obtainedMarks: 2`, `percentage: 50`, `passed: true`.
- `GET /tests/history` has the same wrong `totalMarks`.
- A student who reached the pass mark is shown as failed.
- Likely cause: each question has `marks: 1`, while the test says `totalMarks: 4`. Score from the test's marks, or make the question marks match the test (and validate this when a test is saved).

**2. Rewards summary is still 0.** For the same user at the same time:
- `GET /rewards/summary` returned `totalXp: 0`, `coins: 0`.
- `GET /home` returned `totalXp: 50`, `coins: 10`, and the XP history had the matching entries.
- The Rewards and Progress pages therefore show 0 while the header shows the real values. `dailyGoals` should be checked too.

**3. Correct mistake retry gives no XP.** `POST /mistakes/:id/retry` with a correct answer resolved the mistake, but no XP entry was created. `/rewards/how-to-earn` promises `MISTAKE_REVIEW: 5`. The response has no `awarded` block. Please award the XP and return `awarded: { xp, coins }`.

**4. Activity strip misses today.** On 31 Oct, after answering 5 questions, `GET /progress/summary` returned `activity.strip` for 24–30 Oct only, and `activeDaysLast7: 0` while `activeDaysThisMonth: 1`. The strip must end on today (IST).

### P1: data quality

**5. Syllabus touched.** `learning.syllabusTouchedPercent` is 0 although 5 of 28 topics have attempts.

**6. Breakdown placement.** On challenge, practice and test responses, `breakdown` is inside `questions[0]` instead of at the top level. On challenge and practice completion, `chapterName` and `topicName` inside it are `null`. Move it to the top level with names filled in, and count only answered questions (skipped questions currently appear as 0% topics).

**7. Practice `passed`.** `POST /practice/:id/complete` returns `passed: false` at 100%. Practice has no pass mark, so return `null` or remove the field.

**8. `timeTakenSeconds` and `rank` on the test result.** Both are missing from `GET /tests/sessions/:id/result`. The frontend works out the time from test history for now, and shows "—" for rank until `rank: { position, outOf, percentile }` is returned.

**9. Double test start.** Two `POST /tests/:id/start` calls fired together created two sessions (`...e7b2` and `...e7b3`). Make start safe against this race, for example with a unique index on one active session per student and test.

**10. Reward rule to confirm.** A student with an unverified email received 10 coins. Should coins require a verified email? The frontend no longer says they do.

**11. Admin student detail.** `GET /admin/students/:id` returns only `learningSummary { attempts, accuracy, testsAttempted }`. The collection promises a streak and gamification summary. Please add `totalXp`, `coins` and `currentStreak`.

**12. Admin student list.** `GET /admin/students` has no consent fields and no last-activity time (`lastLoginAt` only). Please add `consentedAt` and `lastActiveAt`.

**13. Audit log.** Entries have no `before` / `after` values (only `metadata`), and `/admin/config` returns `updatedAt` and `updatedBy` as null. The doc asked for these so that changes can be traced.

**14. Curriculum list.** The admin curriculum screen makes one call per chapter to get topics (13+ calls per class). An option to return topics with chapters would make it load much faster.

**15. Draft curriculum items are created live.** `POST /admin/curriculum/chapters` with `isActive: false` returned `isActive: true`, and the chapter appeared to students. The topic route behaves the same. The frontend now sets draft straight after creating, but the create call should respect `isActive`.

**16. Topics cannot be added to a draft chapter.** `POST /admin/curriculum/topics` returns "Parent chapter not found or inactive", so a chapter must be live before its topics can be prepared. Please allow it for admins.

**17. Status casing.** `POST /admin/materials` accepts only lower-case `draft` / `published` / `archived`, while the collection shows `"DRAFT"`, and the status endpoints document upper case. Please accept both, or correct the collection.

**18. Bulk import validate vs commit.** `/bulk-import/validate` accepted a boolean `correctAnswer`, then `/bulk-import` rejected it (`must be a string`). Validate must apply the same rules as the import.

**19. Draft series.** Creating a `DRAFT` series with a draft test fails with "Only published tests can be added to a published series." The check should apply only to published series.

**20. Rich text is stored unsanitised.** A material containing `<script>` was saved as-is and returned by the public API. The web app sanitises on display, but the backend should also sanitise on save, because other clients may not.

**21. No delete for materials.** There is no `DELETE /admin/materials/:id`, so a wrong entry can only be archived.

**22. Moderation reviewer.** `resolvedBy` is a raw user id. Please also return `resolvedByEmail`, so reviewers can see who acted.

**23. Response time.** `GET /daily-challenge` took 2–6 s and `GET /home` about 4 s in this test (`/doubts/quota` took about 1.5 s for comparison). Please check indexes and the hosting plan; Render's free-tier cold starts also add delay.

---

## Test data to remove before go-live

Created during testing on 31 Oct 2026. All of it is hidden from students.

| Item | ID | Where |
|---|---|---|
| Chapter "TEST - Chapter" (draft) | `6ae5c98f5f342a002015e7c5` | Class 8, chapter number 14 |
| Topic "TEST - Topic" (draft) | `6ae5ca475f342a002015e7d3` | Inside that chapter |
| 3 materials ("TEST - Notes", "Video lesson", "Notes (PDF)"; archived) | `6ae5cafc5f342a002015e7da`, `6ae5cb015f342a002015e7dd`, `6ae5cb055f342a002015e7e0` | Inside "TEST - Topic" |
| Material "TEST - Notes" (archived) | `6ae5cad35f342a002015e7d6` | **On the real topic** "Properties of Rational Numbers" (Class 8, Rational Numbers) |
| Test student data | User `6ae498487eed2b764699f614` | Challenge, practice, test attempts, mistakes, XP and coins |
| Question report (dismissed) | `6ae5ce9d5f342a002015e809` | On "The square root of 3 (sqrt(3)) is an irrational number." |
| Audit log entries | — | Test actions dated 31 Oct |

---

| # | Task | Why it matters | Priority |
|---|------|----------------|----------|
| 1 | Configure the AI provider | Doubts and "simpler explanation" return 503 until this is done | P0 |
| 2 | Configure `FIREBASE_STORAGE_BUCKET` and bucket CORS | Photo doubts, voice doubts and PDF uploads need it | P0 |
| 3 | Configure the speech-to-text provider and ffprobe | Voice doubts return 503 until this is done | P1 |
| 4 | Configure Brevo and the report-link URL | Parent report email and email OTP | P0 |
| 5 | Add the production web domain to CORS | The site cannot call the API without it | P0 |
| 6 | Publish content | See section 6 | P0 |
| 7 | Confirm four small contract details | See section 7 | P1 |

---

## 2. Storage CORS

The browser uploads directly to the signed URL with `PUT`, so the bucket's CORS must allow:
- **Origins:** the production domain and `http://localhost:5173`
- **Methods:** `PUT`
- **Headers:** `Content-Type`

## 4. Parent report link

The link in the email must point to the web app:

`https://<production-domain>/parent-report/view?token=<signed token>`

## 6. Content

1. **Questions.** Each chapter had only 1–3 published questions at the last check (31 Oct). Daily Challenge, practice and tests need at least 15–20 per topic.
2. **Study materials.** No study material was published in the topics checked on 31 Oct. Every topic shows "Notes coming soon".
3. **Maths formatting.** Write maths as LaTeX inside `$…$`, and explanations as one step per line.

## 7. Contract details to confirm

The collection has no example responses for these. The frontend accepts the likely field names, but please confirm the exact ones or add saved examples:

1. **`GET /admin/moderation`:** how a doubt report differs from a question report (the frontend looks for `doubtId`), and the field names of the resolution and of who resolved it.
2. **2FA guard:** the `errorCode` returned when an admin has not passed 2FA (the frontend looks for `2FA`, `TWO_FACTOR` or `MFA`), and what `POST /admin/auth/2fa/setup` returns for an admin who is already enrolled.
3. **`GET /leaderboard`:** the field marking the current user's row, and the name of the current-user rank block.
4. **`GET /mistakes/:id`:** the exact field names of the submitted answer, the archive state and the question snapshot.
