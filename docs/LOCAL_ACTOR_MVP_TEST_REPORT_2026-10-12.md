# Local actor MVP and adversarial browser report

Date: October 12, 2026. Source baseline: `30ba40a25e7ed02e7ae7fe1727441662ac88b43b` plus the fixes committed with this report.

## Verdict and boundaries

**The exercised member, RND and admin MVP journeys pass locally after five reproduced defects were fixed.** The requested clarification handoff and exact/nearby review-reference scenarios pass. This is evidence for the journeys below, not a claim that every possible workflow or clinical decision is correct.

The owner explicitly deferred publication. Implementation, API, frontend and browser checks use `C:/Users/chima/Desktop/Nutrimind`, `http://localhost:3000`, `http://localhost:5000/api`, and `kainara_local_development@127.0.0.1:55432`. No hosted restore, migration, deployment, secret change or further live repair occurred during this phase. Foreign uncommitted files were excluded from this commit.

A fresh local custom-format backup preceded account creation and mutations: `backend/.local/backups/local-development-2026-10-12T03-42-15-324Z.dump`, SHA-256 `8976305ab516b5117062a785b0b01c58d7a876700bfc560aee43d6c65f7a510f`. The original recovery archives and non-test account histories were preserved.

## Actors and browser method

The existing admin test-account UI created ten distinctly marked synthetic accounts, using its real preview, database-target confirmation and submit actions. Seven members cover six declaration combinations; two eligible RNDs exercise handoffs and independent decisions; an initially expired RND exercises credential renewal. The existing synthetic local admin exercises account creation, credential decisions and auditing.

| Member fixture | Declared condition | Declared allergy | Final active cycle slots |
| --- | --- | --- | --- |
| Baseline | None | None | 18, including two preserved eaten slots |
| Diabetes A | Diabetes | Dairy | 18 |
| Diabetes B | Diabetes | Dairy | 18 |
| Nearby case | Diabetes | Eggs | 18 |
| Pressure | Hypertension | Nuts | 18 |
| Kidney | Kidney disease | Gluten | 18 current + 21 upcoming |
| Heart | Heart condition | Shellfish | 18 current + 21 upcoming |

Tests used actual Chromium pages driven by Playwright, ordinary UI sign-in, real Express responses and local PostgreSQL persistence. Member checks include a 400-pixel viewport; staff checks use desktop. Normal flows did not mock API responses. One missed-event scenario deliberately aborted the live-event transport, leaving the real status fallback and database active. Replay/authorization/quota probes used the same authenticated browser context to send real server requests.

Synthetic accounts start with fixture onboarding and initial guidance; public signup, email delivery and OAuth are not established by creating them. Clinical details and test PRC material are clearly fictional software fixtures. Private account/password guides, auth states, clinical snapshots, raw response files and executable browser harnesses remain outside Git in `backend/.local/mvp-20261012`. [Sanitized aggregate verification](LOCAL_ACTOR_MVP_TEST_REPORT_2026-10-12.verification.json) records outcomes and evidence hashes without credentials.

## Member MVP

| Journey | Result | Evidence and practical limit |
| --- | --- | --- |
| Saved health details and current guidance | Pass | All seven members saved applicable condition/allergy forms and acknowledged the current report. |
| RND confirmation → automatic preparation | Pass | Six restricted members' open dashboards changed without reloading; observed transitions were approximately 0.2–1.3 seconds. Profile confirmation grants planning eligibility, not meal approval. |
| Cycle completeness and plate totals | Pass | Final bounded database inspection covered seven members, nine cycles and 168 slots. Every expected date has three slots; four plate macros match the sum of saved components within 0.01. Two eaten historical slots are counted through their repair receipt, not duplicated. |
| Variety | Pass for automatic selection exercised | Restricted current cycles contain 18 distinct meal names; the two upcoming cycles contain 21. Baseline has 16 active fresh rows, 15 distinct names after an explicit member swap, plus two retained eaten slots. Deliberate member selection is distinct from automatic repetition. |
| Declared allergens and actual nutrient identities | Pass for detected conflicts | Final active ingredient inspection combines original source labels with mapped food names. No detected declared-allergen conflict remains. Unknown classifications still require appropriate review; this is not exhaustive allergen or clinical validation. |
| Pending meal behavior | Pass | Pending case meals are previews; they cannot be marked eaten. After a real RND approval, the approved plate appears as actionable without a reload. Other pending meals remain previews. |
| Logging, water, groceries and progress | Pass | Actual eaten logging, 250 mL water increments, purchased grocery toggles retained after reload, and weight history saved. |
| Member swap | Pass | Actual source search, complete-plate preview and confirmation returned 200 and closed the modal. |
| Material profile/weight change | Pass | Untouched review requests withdraw; consumed history remains. Current acknowledgment and RND confirmation rebuild the remaining slots. This follows the latest enabled clarification-mode behavior. |
| Outside-food AI/acceptance/review separation | Pass | Real configured Gemini returned banana estimates. Preview created no consumed log. “Use estimate” saved without RND review; “Ask RND to review” created a distinct request. Estimated ranges/provisional labels remain. |
| Outside-food review quota | Pass | After the Health weekly review allowance was consumed, the button was disabled while acceptance remained enabled. A forced authenticated request returned `429 MEMBERSHIP_USAGE_LIMIT` and created no log. The probe used manually entered values, not an additional AI call. |
| Same-browser account switch | Pass | Signing out of baseline and signing in as nearby did not retain baseline meal actionability, identity or saved form contents. |

## RND MVP and cross-RND handoff

| Journey | Result | Evidence and practical limit |
| --- | --- | --- |
| Correct member facts reach RND | Pass | Actual profile/case canvases show the saved declarations, health-detail answers and current plate evidence. |
| Concurrent profile claim | Pass | RND B cannot claim while A holds the profile. |
| Persistent questions through claim release | Pass | A publishes a required clarification form and releases the profile. B claims and sees the same unanswered form. The member submits; B sees the submitted input without a reload, resolves it with notes, and the member retains the resolved answer after reopening. |
| Case approval | Pass | One eligible RND approves a claimed current plate with a recorded rationale. No second normal meal-approval confirmation is required. |
| Exact-context prior review reference | Pass | Diabetes B with the same current clinical-detail facts and measured plate sees A's prior numeric review reference, without A's member identity. The reference does not itself approve B. |
| Nearby context | Pass | Diabetes with a different allergy has no matching reference. Merely sharing a diagnosis is insufficient. Different saved clinical-detail strings also correctly prevented an exact match until the fictional matching fixture was made identical through the member UI. |
| Stale selection with live events missing | Pass, transport failure simulated | Another RND approves the selected case; the first canvas exits with an explanation in 11,629 ms through the real fallback, below 15 seconds. |
| Duplicate approval replay | Pass | Repeating the previously successful request returns 409; the second decision is not saved. |
| Stale rice evidence | Pass after fix | Real UI approval of a guarded synthetic obsolete serving returns `409 MEAL_SERVING_EVIDENCE_CHANGED`; no approval decision is recorded. The deliberately obsolete active fixtures were later withdrawn through normal member edits and fresh confirmation. |
| Mapped-allergen conflict | Pass after fix | The saved “chicken broth” mapping to “Chicken noodle broth, inst” produces a visible gluten conflict, and real approval returns `409 MEAL_INGREDIENT_CONFLICT`. RND rejection generates a compatible pending replacement. |
| Compatible approval after both new guards | Pass | A fresh compatible pressure-case breakfast still approves with 200, and the member can mark it eaten without reloading. The new rejection guards do not block this neighboring valid workflow. |
| Rejection replacement variety | Pass after fix | Real rejection of the duplicated replacement produces a different raw-corpus replacement; final kidney cycles have 18/21 distinct meals. |
| Pending-case certified-library swap search | Correctly blocked by catalogue coverage | Search was exercised; no eligible certified serving existed for the tested restricted case. Approval guards were retained, and rejection/raw-corpus replacement was exercised successfully. A successful restricted RND swap was not established by this browser run. |
| Outside-food request review | Pass | RND sees the requested log, opens the read-only FNRI comparison, records notes and keeps the estimate. The accepted-only log is absent from the review queue. Reviewed values remain estimates. |
| Expired credential and renewal | Pass | Expired RND cannot review, can upload a renewal, and remains blocked while pending. Admin downloads an identical encrypted test document, records a decision, and restored review access follows. |

## Admin MVP and recipe governance

| Journey | Result | Evidence and practical limit |
| --- | --- | --- |
| Account creation | Pass | Preview and explicit local target confirmation precede real creation of the ten fixtures. |
| License decision | Pass | Required document review/reason gates were exercised; the synthetic credential file round-tripped through encrypted storage and download byte-for-byte. No genuine PRC credential was approved. |
| Audit history and retained review canvas | Pass | Filtered RND history opens recorded approval details and their related read-only review canvas. Admin has no clinical approval action there. |
| Administrative recipe authoring | Pass | Admin authored one separate, unreviewed synthetic rice/carrot root recipe using exact FNRI identities and measured macro totals. Its parent, raw-source and family references are null: flag testing cannot withhold an existing source family. |
| Single independent base verification | Pass | One eligible RND claims and verifies the new admin-authored recipe. |
| First flag incident | Pass | A flags the synthetic recipe; one uninvolved eligible RND resolves the incident and re-verifies it. |
| Second distinct incident | Pass | A subsequent flag incident quarantines the synthetic recipe. RND re-verification/release controls are absent. |
| Admin-only quarantine release | Pass | Admin inspects the retained incident history, provides a rationale and releases the second incident without any RND confirmation for that incident. |
| Role boundaries | Pass | Member requests to staff APIs, RND requests to admin auditing and admin attempts at clinical approval return 403. Member browser navigation to admin displays access denial. |

## Reproduced defects and implemented fixes

1. **Approval and availability disagreed about saved rice revisions.** The UI could accept an obsolete serving while the member clearance path hid it. Approval and member availability now call the same pure rice-evidence policy. The authoritative transaction checks the current bounded rice evidence before saving decisions, references or notifications. Existing legitimate holds are not cleared.
2. **A second profile-detail edit left an empty cycle waiting on the first revision.** The withdrawal service previously returned when there were no untouched meal rows left. It now advances already-waiting active/future cycles to the latest revision, resets acknowledgment and stales groceries without inventing duplicate withdrawal/audit records. Sequential real edits, acknowledgment and confirmation rebuild successfully.
3. **Ingredient matching could introduce an allergen that source-name validation missed.** Candidate selection, final ingredient preparation, RND warnings and approval now evaluate the union of original and matched composition identities. All five production ingredient-preparation callers pass current dietary/allergy restrictions. Candidate identity reads retain paging and narrow id/name fields, using the existing matching cache. Source aliases and nutrients were not silently rewritten.
4. **Automatic replacement after rejection could repeat another cycle recipe.** Rejection now provides active sibling recipe identities/signatures and relative dates to the same variety-aware raw selector used in preparation. Limited-pool fallback behavior remains explicit; safety is not relaxed to force variety.
5. **The first 20 alphabetic food results could exclude an exact ingredient.** “Carrot” returned baby-food and mixed-dish USDA entries while hiding the FNRI exact record. Recipe food search now selects exact matches first and fills the remaining bounded results without duplicate IDs. Real RND draft search displays `Carrot · FNRI` first; the response still has at most 20 records and no full nutrient payload.

Regression coverage includes obsolete/missing rice evidence, sequential empty-cycle edits, mapped gluten/dietary conflicts, preservation of explicit original allergens, and exact food search under a saturated result limit. Rejection variety additionally has actual browser/persisted-cycle evidence and the existing raw-selector tests.

## Final checks

- Backend: production TypeScript build passes; **982 tests pass, zero fail, one existing TODO**.
- Frontend: **1,010 tests pass in 207 files**, plus **eight Node checks**. Expected jsdom navigation/media limitations appeared in test output; they are not browser errors.
- Changed backend files: ESLint passes; formatting and whitespace pass.
- Architecture budgets pass. Contract inventory: 1,164 source files, 306 routes, 238 static API calls, zero unmatched static paths, 11 traced dynamic callers.
- Final local plan inspection: **168 expected/persisted slots, nine cycles, seven members, three slots per expected date, zero measured plate-total mismatches, zero detected declared-allergen conflicts**.
- Existing foreground local services remain available for the owner. This release was not promoted to `demo` or published to Railway/Vercel.

The prior frontend production build belongs to the `30ba40a2` restoration verification; this phase changes backend source only. It did not rebuild `.next` underneath the running browser server. Foreign frontend changes present in the shared checkout were not authored or staged here; the current frontend test run and screenshots include that actual local checkout.

## Rehearsal caveats and remaining limits

- Saved clinical details and licensed review are still needed for restricted previews. Three slots per day does not mean all are cleared to eat.
- The restricted certified replacement search has a catalogue-coverage limit; do not claim a successful browser RND swap based on an empty search. The raw-corpus rejection fallback passed without broadening clinical clearance.
- These synthetic conditions/allergies cover distinct and nearby contexts, not every condition interaction, custom restriction, dosage, emergency, nutrient threshold or clinician judgment.
- One real AI estimate is provider success evidence for that request, not guaranteed future latency, model capacity, photo recognition, email delivery or payment processing. Hosted cold-start/egress/load behavior was not rehearsed here.
- Account creation bypasses signup/email/onboarding via the explicit fixture feature. Full live OAuth, checkout, notification delivery and all device/theme/accessibility combinations remain outside this browser evidence.
- Earlier harness attempts had wrong response-code expectations, selectors racing debounced queues, and local watch-server restarts during login. Corrected targeted reruns establish the listed results; this was not a single uninterrupted “all tests” browser run. Original private attempt evidence is retained.
- Test accounts, honest audit rows, encrypted synthetic renewal history, consumed synthetic logs and the isolated governance recipe remain in the local database for inspection. No rollback silently erases their history. Password guides remain private and were not committed.
- The five fixes require a later explicit compatible publication decision. A code-only release does not automatically repair historical held live servings or approve their health contexts.

## Screenshots

Reviewed synthetic screenshots are saved locally under `backend/.local/mvp-20261012`:

- `rnd-b-sees-member-answer.png` — successor RND sees A's form and the member's submitted input.
- `rnd-exact-context-reference.png` — exact recorded reference in a separate member case.
- `rnd-nearby-context-no-reference.png` — different allergy has no reused reference.
- `mapped-allergen-approval-blocked.png` — conflicting mapped evidence rejects approval.
- `rnd-stale-case-fallback.png` — missed live event still closes the stale review.
- `admin-recorded-review-context.png` — read-only related audit canvas.
- `rnd-quarantine-admin-required.png` and `admin-only-quarantine-release.png` — second incident and administrative release.
- `rnd-exact-food-search.png` — exact FNRI ingredient remains visible.
- `outside-review-quota-exhausted.png` — review exhausted, acceptance still available.
- `member-compatible-approval-after-guards.png` — current compatible breakfast is actionable while other meals remain previews.

Screenshots capture software test fixtures, not clinical endorsements. Raw account guides and auth state must not be shared with them.
