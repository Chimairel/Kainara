# RND clarification and member-context review batches

Owner-approved direction, October 10, 2026. This is an implementation plan, not evidence that the features are delivered. Keep the implementation status below current. Use the engineering record for verification and rollout evidence.

## Decisions

- Keep the shared eligible RND pool and temporary claims. Do not restore expertise-first visibility or availability opt-out routing.
- One persistent profile case owns clarification forms. A profile review claim is temporary; the questions, answers and resolutions survive handoffs.
- Reuse the desktop review canvas in the Profile queue. Members answer through Health Details. Meal reviewers see a read-only profile and can request profile clarification.
- Published questions and submitted responses retain history. Forms alone do not alter the profile or require acknowledgment. Answers do not automatically classify a diagnosis or resolve a question.
- RND clinical corrections are proposed revisions with before/after values and rationale. Members acknowledge or request correction. Member clinical/planning edits require explicit confirmation; cosmetic edits are excluded.
- Generation and pending decisions use one acknowledged profile revision. Necessary clarification pauses planning/decisions. Profile changes supersede old pending requests; preserve historical decisions, logs, forms and drafts.
- Live invalidation closes fullscreen and clears selection to the existing default right panel, refreshes the queue and shows a notice. Preserve tab, filters and scroll; do not reload the browser. Transactional revision checks remain authoritative.
- Recipe verification and suitable review evidence are reusable. Cross-member clinical auto-approval and AI natural-language filtering are deferred. No universal condition thresholds are introduced in these batches.
- Replacement filtering starts with explicit nutrient controls, includes serving and sides, and rejects unknown required values. A swap stays pending. No suitable replacement is a recorded outcome rather than endless unchanged regeneration.
- Preserve existing evidence, licensing, allergy, condition-clearance, flag, quarantine, independence and admin-sensitive-access gates.

## Execution and evidence

Each batch is a separately reviewable commit with scoped tests. Inspect shared-checkout dirt first, preserve others' edits, and push finished units to development. Do not infer completion from a previous batch or convert legacy approvals. Use additive migrations and disposable cross-role acceptance before requesting confirmed shared development rollout. Clinical validation and hosted demo promotion remain separate.

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Persistent version-bound clarification forms, member answers, claim handoffs, RND resolution, shared form UI and planning gate | Implemented and locally tested; shared rollout pending |
| 2 | Profile queue canvas; reviewed structured profile proposals, correction requests and acknowledgment; link forms to proposal evidence | Implemented and locally tested; shared rollout pending |
| 3 | Plan/review context revision enforcement, meal-triggered clarification, outdated-request withdrawal and live default-panel return; preserve drafts | Implemented and locally tested (3a/3b); remaining-history reconciliation delivered in Batch 5; shared rollout pending |
| 4 | Explicit replacement nutrient filters, missing-value handling and no-suitable-replacement outcome | Implemented and locally tested; shared rollout pending |
| 5 | Exact prior review references; remaining-plan log/purchase reconciliation; cross-role and authenticated browser acceptance | Implemented and locally tested; shared rollout pending |

## Batch 1 boundaries

Use existing profile review scope/claims and current health-detail fields. Start with bounded text and single-choice questions. Published forms are immutable; follow-up questions are another form. Member submissions are immutable response versions. Resolution binds to the latest submitted version, requires a current eligible claimant and rationale, and cannot diagnose or edit profiles. A member can answer after the original claim expires. A stale profile/scope cannot receive new answers or resolutions; retain it as superseded history. Sending a form must not increment profile revision or clear acknowledgment, but unresolved current forms block profile confirmation and planning.

The first rollout is disabled until its additive migration has been applied to a confirmed target. Off mode retains existing behavior without querying missing tables. No new dependency, provider calls, real clinical fixtures or shared database writes are needed for implementation tests.

## Remaining rules to implement explicitly

- Required information means current condition-detail requirements plus questions an eligible RND marks necessary. Never claim a questionnaire establishes exhaustive clinical knowledge.
- One active correction proposal per member. A disputed clinical restriction does not silently become NONE. Admins oversee process, not clinical classification.
- Published form author, submitted member, resolving RND and timestamps are distinct. Do not credit the last actor for all previous work.
- Profile changes must be checked under the same database lock as final decisions; notifications do not replace concurrency checks.
- Recipe/portion changes and holds override reusable review evidence. Previous member identities, raw answers and private documents are not reusable summaries.
- Waiting-member cases remain discoverable for handoff, labelled separately from ready-to-review work. Expired meal weeks must not erase active profile clarification.

## Acceptance gates

1. Claim/role/current-credential boundaries, foreign member access denial, malformed/oversized forms and answers.
2. Claim expiry, release and another claimant; late member answer visible to the new reviewer.
3. Required answers, independent follow-ups, concurrent submissions/resolutions, idempotent retries and immutable old responses.
4. No profile revision/acknowledgment mutation from forms; unresolved forms block confirmation and generation.
5. Changed profile/scope invalidates old work; disputed/corrected proposal and acknowledgment gate.
6. Twenty-one concurrent meal reviewers cannot commit stale decisions; fullscreen exits to the default panel with no page reload.
7. Filter boundaries, plate totals, unknown nutrients, swaps pending and exhausted replacement search.
8. Member/RND/admin sensitive-case access and audit, held recipes and historical attribution.

Record actual passed checks and remaining limitations after every batch. Shared migration application requires fresh target confirmation and a local backup; demo promotion is separate.

## Batch 1 delivered evidence

October 10, 2026: additive migration `202610100001_clinical_clarifications` creates three related tables. Current profile scope logic is shared without changing the existing scope format. Text/single-choice forms publish under a current eligible RND claim. Member answers persist as numbered response versions, and resolution binds to the latest version. Current unresolved forms block confirmation and planning; stale profile/scope forms are historical. Member Health Details and the current Profile queue use one shared form renderer. The complete Profile queue canvas conversion is Batch 2, not a Batch 1 claim. Case-scoped admin oversight shows saved questions, response versions and resolution and audits sensitive access. Notifications contain no question/answer content. Retry keys prevent duplicate publications/responses; transactional profile locking serializes answers and resolution.

Verification: 855 backend tests passed (one pre-existing TODO, 856 total); 27 focused frontend tests passed; 13 fresh PostgreSQL/HTTP scenarios passed on task-owned loopback port 55488 with all 99 migrations and no external providers. The acceptance run covers claims, late responses/handoff, ownership, validation, retries, unchanged profile, blocked confirmation/planning, version-bound resolution, concurrent submission/resolution, audited admin history, health-detail scope changes without a profile increment, changed profile and current confirmation after resolution. Backend/frontend lint, builds, application/script TypeScript and Prisma validation passed. This is software verification, not clinical validation or browser E2E evidence.

`CLINICAL_CLARIFICATIONS_ENABLED` stays false by default; existing localhost uses disabled mode until authorized migration/enablement. No shared database data was modified for Batch 1. Tests used synthetic accounts only in the disposable target. Future batch behavior remains planned.

## Batch 2 delivered boundaries

The Profile queue reuses ReviewCanvas: movable current-profile, saved-guidance/document, clarification composer, individual published-form and correction sheets; H/V tools, local Ctrl/Command wheel zoom and fullscreen remain shared. Profile decision notes open in a canvas-layer dialog. Published forms stay immutable, and clarification/proposal drafts are owned outside the fullscreen portal so expansion preserves them.

Additive migration `202610100002_clinical_profile_proposals` stores immutable before/after and resolved-form evidence, author, rationale, member response and applied revision. A database partial unique index and the existing member lock enforce one active proposal. This batch permits corrections to declared safety sections and existing-area health details. Body targets and preferences remain member-controlled. Refinement such as a reported diabetes type is recorded in reviewed health details; no new clinical taxonomy or automatic diagnosis classifier is introduced.

Sending a proposal leaves the saved profile unchanged and blocks new planning/profile confirmation. A member can acknowledge and apply it or request correction with a reason. A successor claimant can propose a new correction linked to the prior request; prior contents and responses are retained. Acceptance checks current scope and author credentials, applies existing restriction validation, advances safety/profile revisions exactly once, clears prior claims and invalidates old reviews/reports. It is acknowledgment of the correction, not clinical profile certification: the existing current RND confirmation and nutrition-guidance/report planning checks still apply. Independently changed profiles/scopes supersede outstanding proposals. Accepted history retains attribution. Related admin access is read-only and audited.

Shared rollout is pending for both Batch 1 and Batch 2 migrations and their common flag. Batch 3 remains responsible for meal-triggered clarification, stronger plan context enforcement, live default-panel return and stale draft preservation. Batch 4 replacement filters and Batch 5 reusable summaries remain planned.


## Batch 3a delivered boundaries

Meal previews return a context fingerprint covering the recorded profile/planning inputs, clinical declarations/details/document facts, selected and current guidance, exact plate ingredients/composition and cycle. Claiming, approving, rejecting and RND swapping must carry that fingerprint when the common rollout flag is enabled. Final decision/replacement transactions recheck it under the member profile lock, recheck eligible reviewers and require current acknowledged guidance/profile confirmation. New approval/rejection snapshots preserve the context that was reviewed. Cosmetic display names and check-in timestamps/counters do not invalidate it. Profile confirmations are revision-bound in enabled mode; old confirmations remain historical.

Profile revision changes release pending claims. Paused members are excluded from the meal queue until current profile/report gates pass. Enabled mode lists and decides individual meal requests, preventing coalesced approval from bypassing the context checks. Polling compares context before replacing visible evidence: a changed/inactive case closes fullscreen and returns to the existing default panel with a notice, preserving tabs/filters and session-only unfinished approval/rejection notes. Notes are owner-scoped, bounded to ten drafts and cleared on account change; they are not resubmitted automatically. Slow responses cannot resurrect a previous selection/account. Visible polling is five seconds plus request latency; focus/live events refresh immediately, not browser reloads.

This is a separately reviewable part of Batch 3. Meal-triggered clarification and profile-review reopening, persistent outdated-request withdrawal and rebuilding current cycles after acknowledgment remain Batch 3b. The common flag stays disabled on the shared development database until the complete rollout is authorized; the two prior additive migrations remain pending. No schema migration or shared data mutation is needed for 3a.


## Batch 3b delivered boundaries

A current eligible meal claimant can send questions from a movable clarification sheet in the shared canvas. Sending atomically reopens the persistent Profile case using a separate review-episode key, binds the immutable form to the opened meal/profile context, and releases all pending meal claims. It does not change profile fields/revision or acknowledgment. Current meal decisions and planning pause until Profile work resolves all current forms and records fresh confirmation. A member with NONE declarations can still have a clarification case; no diagnosis is inferred. Forms and responses remain available after the source week expires. Resolutions and correction proposals belong to the Profile queue, not the meal canvas. Saved forms reuse the shared read-only renderer and show their source meal. Unfinished question drafts share the existing owner-scoped session archive and survive fullscreen rerenders.

Actual clinical/planning edits retire current/future unconsumed pending or approved slots as CANCELLED, retaining rows, original cycle snapshots, decisions and logged history. They stale the guidance acknowledgment and require current profile confirmation and acknowledged guidance before rebuilding. Material health-detail saves now advance the profile revision in enabled mode; exact retries do not. Document fact/validity changes bind profile review context and release pending claims. Retired previews return the same typed inactive response used by the live default-panel return. Related staff audit can show the member-triggered withdrawal without attributing it to an RND.

The internal current-cycle repair uses today through the original end date and the original admitted billing start, never regenerates passed dates, and publishes under the member lock. Concurrent recovery coalesces through the generation job and rechecks its source before reclaim/publication. First membership access now uses conflict-safe receipt creation rather than a racing empty-update upsert. These repairs cannot be supplied as a member HTTP payload and do not grant cross-member clinical approval reuse.

Verification: 864 backend tests passed (one existing TODO, 865 total); 32 focused frontend tests passed in seven files; ten fresh PostgreSQL/HTTP scenarios passed with 24 synthetic accounts, membership enabled and all 101 migrations, including concurrent 21-claim pausing, late answers, source-context audit, immutable history, a four-day/12-meal replacement, idempotent recovery, membership receipt races and reauthenticated account deletion. The previous form/proposal/context runs passed 13, 19 and eight scenarios respectively on fresh task-owned databases. Lint, TypeScript, Prisma validation and both builds passed. Evidence is [Batch 3b evidence](verification/MEAL_CLARIFICATION_BATCH3B_2026-10-10.json). These are software checks, not browser E2E or clinical validation.

### Remaining repair boundary

Automatic repair is paused before job creation if the remaining dates already contain DONE/SKIPPED logs or the source plan contains purchases. Both denial and unchanged history are tested. Reconciliation of those records into a replacement remains unfinished; it must be covered by the later integrated acceptance batch before claiming full current-plan recovery. Passed-date logs outside the replacement window remain untouched. Do not bypass this guard to make a repair appear complete.

Shared development remains disabled and untouched; migrations `202610100001_clinical_clarifications`, `202610100002_clinical_profile_proposals` and `202610100003_meal_clarification_reopening` need confirmed-target rollout. Later replacement filtering, reusable summaries and complete browser acceptance remain planned.

## Batch 4 delivered boundaries

The RND swap modal reuses the member comparison/options and adds optional minimum/maximum limits for energy, protein, carbohydrate, fat, sodium, sugar, fiber, potassium, phosphorus and saturated fat. Units are fixed (kcal/g/mg), with no preset medical limits or AI interpretation. Searches scan all currently eligible certified-library rows in bounded chunks, apply complete-serving/rice and existing admission checks before counting and pagination, and report exclusions for missing required nutrient values. Unknown values are distinct from recorded zero. The search scope is the currently eligible certified library, not every raw recipe or an assertion that no possible clinical meal exists.

Previews include exact serving totals and a fingerprint bound to recipe/evidence, extended nutrient values, rice portion and food composition revision. The final swap rechecks those values, filters, current profile context, credentials, claims, admission and quarantine under the existing member/lineage locks; food/recipe rows are held while the complete serving is persisted. Rice remains a serving component of the unchanged recipe. Every RND swap remains pending for a separate final decision. Editing filter drafts clears old choices and search receipts; stale asynchronous responses cannot restore them. Off-mode member/RND behavior remains unchanged.

An eligible claimant can mark the rejection as No suitable replacement after searching. This still requires the rejection modal and a rationale of at least ten characters. A short-lived signed, reviewer/case/context-bound receipt records the search limits, full matching count, unknown exclusions, time and scope. It records clinician rejection of available numeric matches separately from an exhausted numeric search; it does not claim every matching meal was inspected. The immutable decision and related audit retain the record, and the unavailable rejected slot holds automatic certified/raw/AI replacement, including competing rows and deadline processing. Admin inspection remains case-scoped and audited. Approve and Reject remain the only final decisions; the preparation button does not create a third decision.

Verification: 869 backend tests passed (one existing TODO, 870 total), 29 focused frontend tests passed across six files, and 11 fresh PostgreSQL/HTTP scenarios passed with four synthetic roles/accounts and 128 library recipes, all 101 migrations and external calls blocked. The legacy off-mode RND swap/routing/retirement acceptance passed 18 scenarios on a separate fresh task-owned database. Both builds, lint and application/script TypeScript passed. Evidence: [Batch 4 evidence](verification/REVIEW_REPLACEMENT_FILTERS_BATCH4_2026-10-10.json). There is no new schema migration or shared database mutation for this batch. Authenticated browser E2E, reusable summaries and log/purchase reconciliation remain Batch 5 work; this evidence is not clinical validation. Shared rollout still requires the three prior migrations and confirmed enablement.

## Batch 5 delivered boundaries

Exact prior RND decisions are reference evidence for a fresh decision. New approvals capture keyed hashes of the immutable recorded profile, clinical declarations/details, reviewed document facts and resolved clarification questions/answers, plus the exact recipe, quantities, composition revisions and numeric serving. No approximate age/weight matching or legacy reconstruction is allowed. Later changes by the original member do not rewrite that captured context. The reusable display contains only the recorded RND name/time and plate macros; another member's identity, clinical notes, private guidance, documents and answers are excluded. Held recipes, changed evidence/servings, expired reviewers and challenged decisions cannot supply these references. References grant no approval, unlock or member clinical clearance.

Remaining-date repair now records an immutable receipt rather than moving old meals/logs or erasing purchases. DONE/SKIPPED slots count as covered and are not generated again. They appear as owned, read-only history on Dashboard and Meals; eaten intake uses the actual saved log macros. Previous purchases appear separately on Grocery and do not mark new ingredients purchased or credit pantry stock. Inherited receipts preserve original histories once. Publication rechecks history, current revision, profile confirmation and selected guidance acknowledgment under the member lock, then records the receipt/audit in the same transaction. Ordinary generation still rejects logged/purchased overlap. Upcoming preparation cannot supersede a repaired current cycle before its original end date. Bounded reconciliation failures remain explicit rather than truncating valid source records.

Additive migrations `202610100004_review_references` and `202610100005_plan_repair_history` create related tables only. All five clarification migrations and the common feature flag still require confirmed-target rollout. Disabled mode returns before querying the new tables. No shared development data changed, and demo promotion remains separate.

Verification on October 10, 2026: 872 backend tests passed, zero failed and one existing TODO; 122 focused frontend tests passed across 23 files. Six reference and thirteen clarification/repair PostgreSQL/HTTP scenario groups passed on fresh guarded loopback databases with all 103 migrations, synthetic accounts and disabled external providers. Replacement-filter and legacy disabled-mode regression acceptance passed eleven and eighteen scenario groups respectively. Five authenticated Chromium checks passed against localhost:3000 with requests forwarded to disposable backends: phone/desktop member history in both themes, and desktop RND references, fullscreen local zoom, questions, live canvas return, member answer and successor Profile queue handoff. Related admin access is HTTP-tested; no new admin browser journey or interactive login journey is claimed. Both lint/build checks, application/acceptance TypeScript and Prisma validation passed. Changed source modules meet their architecture budgets; the global guard reports the unchanged baseline clinical-evidence.service.ts at 901 lines against a 900-line limit. Evidence: [Batch 5 verification](verification/REVIEW_REFERENCES_REPAIR_BATCH5_2026-10-10.json).
