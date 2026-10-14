# Saved approval canvas and flag pages — October 14, 2026

## Owner decision and implementation

The owner authorized all currently eligible RNDs to inspect the full immutable context saved for a meal approval. This replaces the original-reviewer-only restriction for meal approval audit context. It does not grant access to current member profiles or original clinical document files. Role, verified account, suspension, PRC eligibility and recorded-access controls remain enforced. Related-condition reference searches retain their existing bounded food-only projection.

Live case review and saved approval replay share the same evidence paper components. Approval requests submit a validated presentation layout only; the API obtains evidence and any open related-condition reference page itself. The final transaction checks the captured review-context version. New decisions save these papers, sheet positions, selection, tool mode and camera in existing immutable decision JSON. Old decisions are rendered from their saved facts with an explicit missing-layout notice, without looking up current clinical data. No historical records are rewritten and no schema migration is required.

Meal cards use the shared red danger action. Flag meal opens the same base-verification evidence papers plus a draft reasons paper. Saved approval canvases offer Flag approval and add the corresponding draft paper. Cancel clears and removes it without an API request. Approval Cancel also restores the previous desktop presentation. Failures retain the reasons, and submission results use Sonner. At phone widths these entry points stack the same pages without scaling input text. The ordinary live decision workspace retains its desktop requirement.

## Approval flag lifecycle

- Case approval flags target a `MealPlanReviewDecision`, distinct from whole-recipe and existing reusable PROFILE/CONDITION flags.
- A serializable, version-checked transaction records structured reasons, suspends the source approval's affected plans, exact reuse and current coalesced dependents, clears claims, marks grocery projections stale and creates member notifications. Independently superseding decisions and unrelated meals are not targeted.
- The source verifier and flagger cannot open/claim/approve an affected active case. An uninvolved, currently eligible RND must hold its current claim to record a resolution. Resolving does not approve or restore any meal; the ordinary current-context approval checks still apply.
- Historical reasons and the independent resolution remain available as information in the review and audit. Flag/resolution audit rows carry the original recorded conditions. Follow-up links select a current affected case, including when the original source has expired.
- The clinical rollout must be enabled for this new mutation path; a disabled rollout cannot produce flags whose resolution guards would be skipped.

## Verification

- 30 focused frontend tests cover existing governance transitions, admin audit, shared live papers, saved camera/sheet replay, on-demand reasons, Cancel without mutation, cleared retry drafts, server-failure retention, Sonner, saved reference pages without live fetches, legacy missing-data labels, phone stacking and historical flag resolution pages.
- Seven backend unit tests cover eligible full saved-context access, current-profile/file exclusion, ineligible access, historical links, audit labels, presentation-only validation, structured reasons and the disabled-rollout boundary.
- `backend/scripts/meal-approval-audit-local-acceptance.ts` uses a fresh database inside the ownership-checked loopback PostgreSQL container. Real SQL verifies source/exact/coalesced suspension, unrelated recipe preservation, stale/repeated rejection, verifier/flagger exclusion, current independent claim requirements, no automatic approval on resolution, immutable evidence, saved notes/resolutions and condition-labelled audit context.
- The existing complete exact-reuse HTTP/SQL acceptance passes all five built-in conditions and 17 scenario groups, including the full flag/resolution/fresh-approval HTTP lifecycle, captured canvas layout and trusted server evidence, related-reference capture, untrusted client evidence rejection and non-RND/invalid flag request rejection. Existing matching, changed-context, credential, dispute, quarantine and explicit-consumption behavior remains covered.
- Scoped frontend lint is clean. Backend lint has no errors and five pre-existing warnings in unrelated services. Backend and frontend production builds pass. Broad frontend test TypeScript retains pre-existing fixture errors; application compilation passes through the production build.
- Shared localhost browser checks use the authorized RND test account and existing Pandesal data: red meal action, shared verification papers, red approval action, draft editing/Cancel, retained evidence papers, light/dark desktop and readable 400px phone form. Only drafts were edited; no shared flag, claim, approval or resolution was submitted. Normal authentication and saved-context access audit records may be written. Browser viewport and theme are restored afterward.

These are software checks, not clinical validation or proof of a hosted release. Changes are committed locally; publishing remains separate. Mutation acceptance uses owned loopback fixtures, not the shared defense database.
