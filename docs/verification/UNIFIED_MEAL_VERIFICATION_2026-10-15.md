# Unified meal verification — October 15, 2026

## Owner-approved change

Remove the separate “Meals needing re-review” table and the second RND decision workflow in library details. New recipes and first-incident flagged recipes share Meal verification navigation and the existing claim → evidence canvas → reasoning page → decision pattern. Recipe concerns remain distinct from member-specific approval flags in Case approval.

## Implementation

- `MealVerificationWorkspaceService` combines existing base-verification candidates with one current flagged serving per pending recipe lineage. Own active claims come first. New, Flagged and Rejected labels distinguish the work. Quarantined recipes remain in the existing admin workflow.
- Library details retain current flag concerns and history as read-only evidence, with a link to the exact recipe in the unified queue. The retired table and RND library claim/confirmation controls are removed.
- Flagged recipes use shared canvas, evidence, concern and decision-paper components. Verification requires an active independent claim, the current evidence version, a marked response to every concern and explicit evidence/rice acknowledgement. Editing a response removes its resolution mark. Changed evidence or lost claims invalidate the decision draft.
- Rejection records attributed findings, clears the claim and keeps the same recipe/incident withheld for correction. It does not count as a new flag or bypass quarantine. Explicit claim release is separately audited. A reviewer-row lock enforces one active recipe claim across new and flagged work, including separate tabs. Existing case-approval claim capacity remains separate.
- Reproduced the existing GET `/api/nutritionist/meal-verification` HTTP 500 as a Prisma 5 query-engine panic in nested, parallel primary-key `findUnique` reads. The two affected target reads now use `findFirst` with the same unique-ID predicate, consistent with the repository's existing Prisma batching workaround. The normal API subsequently returned all 23 existing candidates with HTTP 200.

## Verification

- Backend production build and test TypeScript pass. Full backend suite: **1,087 passed, zero failed, one existing TODO**.
- Review/library frontend suite: **177 passed across 37 files**. Legacy library tests were updated for queue routing; they also caught and verified restoration of current concern visibility. Frontend production build, TypeScript and scoped lint pass. One pre-existing unused schema import warning remains in the backend nutritionist routes. Impeccable detector reported no findings on the changed queue/canvas surfaces.
- Normal localhost API passed **10 guarded synthetic acceptance checks**: unified loading, previous-verifier exclusion, capacity in both directions, claimed-first order, retained withholding/incident count after rejection, attributed audit, unresolved-concern rejection, successful verification removing the item and retained reports.
- Normal localhost browser verified an involved verifier's readable evidence and disabled actions, an eligible RND's claim, automatic reasoning paper, required concern resolution/acknowledgement, successful verification and return to the queue. No browser console errors were observed. Temporary browser tab was closed; the user's existing tab was preserved. Local proof: `codex_outputs/unified-meal-queue-20261015.png` and `codex_outputs/unified-meal-canvas-20261015.png`.
- Fixture writes were guarded against the exact defense database hostname/database for Neon project `nameless-dust-38810716`, main branch `br-round-art-b355gp02`. Four explicitly synthetic recipes were archived afterward and their claims cleared. Submitted concerns, decisions and audit events remain retained. No real-member decision, claim or profile was changed.

## Limits

No migration, provider AI request, nutrient backfill or load test. Local verification does not establish hosted deployment success. Existing desktop-only canvas behavior and existing recipe/member safety guards remain in effect. Rejection intentionally leaves a flagged recipe unavailable until its concerns are resolved.
