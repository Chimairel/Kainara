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
| 2 | Profile queue canvas; reviewed structured profile proposals, correction requests and acknowledgment; link forms to proposal evidence | Planned |
| 3 | Plan/review context revision enforcement, meal-triggered clarification, outdated-request withdrawal and live default-panel return; preserve drafts | Planned |
| 4 | Explicit replacement nutrient filters, missing-value handling and no-suitable-replacement outcome | Planned |
| 5 | Reusable review summaries with privacy/current-version checks; full cross-role and browser acceptance | Planned |

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

`CLINICAL_CLARIFICATIONS_ENABLED` stays false by default; existing localhost uses disabled mode until authorized migration/enablement. No shared database data was modified. Tests used synthetic accounts only in the disposable target. Future batch behavior remains planned.
