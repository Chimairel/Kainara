# RND flag and reusable-context audit — October 13, 2026

## Scope and environment

Read-only source audit and synthetic browser verification in `C:\Users\chima\Desktop\Nutrimind`, using the existing frontend at localhost:3000. Normal backend remains on port 5000. Every browser API request in this audit was intercepted; no live Neon accounts, meals or flags were mutated. Unit tests use mocked persistence and the guarded unit environment. This is not a new live database end-to-end flag rehearsal.

Solar work is paused at `54f24ed1`. The shared checkout remains on `codex/solar-icons` to preserve unrelated uncommitted work; no checkout/stash/reset, application changes or deployment occurred in this audit. Audited backend flag/reference services are identical to origin/development. Existing icon imports differ in presentation components. Local backend .env has CLINICAL_CLARIFICATIONS_ENABLED=true; hosted configuration was not inspected.

## Findings

| Scenario | Current behavior | Verdict |
| --- | --- | --- |
| First recipe-wide flag | Stores structured incident notes, marks library family FLAGGED/PENDING_REREVIEW and withholds affected member use | Goes to the separate Flagged recipes queue in the RND Library, not the ordinary Case approval canvas |
| Repeated incident after re-verification | Quarantined; independent RND cannot release it | Requires admin decision; preserved by tests |
| Flagged profile/condition approval | Saves flag reason/suspension reason and marks dependent APPROVED slots requiresSafetyRevalidation | RND Audit > Flagged approvals and library approval details show the concern; flagging does not itself make those slots PENDING_REVIEW |
| Pending member case opened in canvas | Shows generic profile/evidence-change warning | Specific flag reason/report is absent from the case preview contract and canvas; visibility gap relative to the requested workflow |
| Exact prior recorded case/serving | Exposes recorded reviewer/date and numeric plate facts in Meal evidence > Prior review references | Rendered successfully in the actual localhost fullscreen canvas with a synthetic response |
| Similar but not exact case | No matching prior reference | Intentional: age, weight, clinical inputs, clarification answers and exact serving/evidence must match; diagnosis alone is insufficient |
| Challenged/held recipe, expired reviewer, missing legacy capture | Excluded from reusable reference eligibility | Source guards preserve separate current decisions; old private case details are not copied |

The flagging operations set requiresSafetyRevalidation on dependent approved slots but do not directly change their status to PENDING_REVIEW. The case queue and preview require PENDING_REVIEW. Do not promise that flagging immediately puts the member's same meal in that queue. A pending replacement or a separately reopened slot is a different workflow.

## Evidence trace

- backend/src/services/meal-wide-flag.service.ts — structured report/incident creation, recipe hold, dependent slot revalidation.
- backend/src/services/meal-approval-lifecycle.service.ts — scoped flags and saved reasons; dependent slot revalidation.
- backend/src/domain/meal-actionability.policy.ts — case queue requires PENDING_REVIEW, current period and unsuperseded cycle.
- backend/src/services/nutritionist-review.service.ts — preview returns reviewReferences and generic revalidation warning; no linked flag report/reason field.
- backend/src/services/reusable-review-reference.service.ts — immutable capture, exact context/serving matching, held/flagged/expired exclusions and anonymous reference payload.
- frontend/src/features/nutritionist-reviews/CaseReviewDocument.tsx and sections/CaseAuditSection.tsx — canvas warning and prior-reference renderer.
- frontend/src/features/nutritionist-library/MealReviewPanel.tsx — structured flag notes, references, correction suggestions and required resolutions in separate re-review panel.
- frontend/src/features/nutritionist-library/SharedMealLibraryWorkspace.tsx — Flagged recipes queue is in Library.
- frontend/src/app/(nutritionist)/nutritionist/audit/page.tsx and reviews/GovernanceQueuePanel.tsx — flagged approval queue and saved reasons.

## Verification this run

- Six backend tests passed: exact reference key/privacy rules, structured flag/confirmation input, held lineage and admin-only quarantine release.
- Nine frontend tests passed across prior-reference renderer, canvas error presentation, incident timeline and flagged-approval recheck panel.
- Two synthetic RND browser governance journeys passed at 390px and 1440px: structured flag evidence remains visible and quarantine controls cannot bypass admin release.
- Two additional read-only synthetic journeys used the actual fullscreen canvas at localhost:3000: exact reference appears with recorded attribution and macros; generic revalidation warning appears without a specific flag reason. No browser exceptions.
- Private screenshots and browser results: backend/.local/rnd-context-audit-20261013/{exact-reference.png,flagged-context.png,browser-results.json}. Reproduction script: backend/.local/rnd-context-audit-browser.cjs.

## Smallest next change to consider

1. Add a read-only case-scoped concern summary to the existing preview response, sourced from its linked recipe incident and flagged approval records. Include saved reason, author/date, concern status and applicable version; preserve history after resolution and do not substitute the current profile for recorded context.
2. Show that summary on the existing Meal evidence sheet using a shared renderer. Reuse the stored records rather than duplicating notes or inventing a new schema.
3. Decide the intended transition for current untouched member slots after a flag: preserve a hold while the recipe is under independent review; reopen eligible unchanged slots for fresh case approval after release. Preserve eaten/skipped history. A held recipe must not become approvable just to expose its notes.
4. Verify these transitions and reference exclusions with isolated PostgreSQL/API tests and browser journeys before release.

No workflow repair, migration or publication is included in this test-first audit.

## Follow-up: requested canvas implementation

The owner subsequently requested a concern paper, a mandatory written resolution and an explicit resolved action before verification. That local implementation supersedes the visibility-gap finding above. Recipe flags, scoped approval rechecks and pending member-case linked concerns now use shared canvas components; resolved notes remain visible. See [implementation verification](RND_FLAG_RESOLUTION_2026-10-13.md) for tests, screenshots, enforcement and limits. The original queue-transition finding still applies: flags do not themselves make an approved member slot pending.
