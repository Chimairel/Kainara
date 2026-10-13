# Profile confirmation and food exclusions — local verification

Date: October 13, 2026. Workspace: `C:\Users\chima\Desktop\Nutrimind`.

## Behavior

- Complete, recognized condition declarations can be confirmed for planning without changing a declaration or sending a correction. A named pending declaration has an explicit **Reviewed as recorded** selection and requires the RND's review notes. This records judgment without marking the declaration supported, removing a restriction or certifying a meal.
- Missing evidence, vague/invalid declarations, unresolved clarification forms, pending correction proposals, inactive credentials, another RND's claim and changed revisions remain blockers. Reviewed-as-recorded and no-additional-restrictions assessments are mutually exclusive for an entry.
- Pork and beef under **Foods to avoid** use deterministic ingredient exclusions. Both new supported entries and earlier recognized entries work without rewriting saved rows. Known supported allergy exclusions retain their existing reviewed absence, cross-contact and recipe evidence requirements. Unfamiliar allergies, intolerances and exclusions remain subject to review.
- Ingredient names, linked composition identities and common aliases are checked in candidate validation, certified reuse, case preparation, source eligibility, source swaps, current-cycle actionability and catalogue browsing. Missing/uncertain ingredient identities cannot establish absence of pork or beef. Catalogue exclusion occurs before counting/paging.
- New guidance snapshots retain the structured restriction domains for membership decisions. Old ambiguous snapshots remain conservative and archived reports are not rewritten. A known food preference does not create an allergy details form solely because the member has a condition.

## Read-only observation

The reported member's saved profile contains Shellfish plus a custom Allergy Pork entry and a predefined Avoided Ingredient Pork entry. Both pork entries already appear in the first structured food save. Inspection did not establish a server conversion or the member's exact input sequence. The implementation preserves domains; it does not silently remove a declared allergy or repair this account.

## Verification

| Check | Result |
| --- | --- |
| Backend application TypeScript | Pass |
| Frontend TypeScript and changed frontend lint | Pass |
| Changed backend source/tests/acceptance lint | Pass |
| Focused backend regression suite | 109 passed |
| Profile workspace/frontend regression suite | 17 passed |
| Real HTTP/SQL acceptance | Six groups passed on fresh `127.0.0.1:55432/kainara_food_exclusions_20261013` |
| Chromium on actual localhost:3000 | Desktop confirmation in both themes; mobile desktop-access gate in both themes, four passed |

The SQL fixture verifies unchanged declarations/profile/revision, one persisted signed decision and audit under concurrent requests, retained case-review requirements, no correction proposal, blocked roles/claims/stale IDs/duplicates, missing evidence and vague declarations, avoidance planning readiness, combined condition/allergy confirmation, and a complete condition with pork avoidance requiring no artificial allergy form. Providers are disabled. AI failure/replacement regression uses simulated responses, not live provider verification.

Browser API responses are synthetic and fully intercepted; browser mutations do not reach shared Neon. The normal-use frontend 3000 and backend 5000 processes were confirmed in the required Desktop checkout. Screenshots are in the ignored Playwright results directory under `profile-as-recorded-*`.

This is targeted verification, not a claim that the entire system is defect-free. The prior broad-suite image mock compilation issue and preparation fixture failure are recorded in the preceding flag-resolution verification; this work did not rerun or repair those unrelated gates.

## Release boundary

Local only. No shared Neon writes, migration, account repair or deployment. The paused Solar branch remains checked out to preserve the shared folder's unrelated changes; this feature does not change icon styling. Publication must integrate and release both API and frontend together. The existing decision endpoint accepts the optional `reviewedDeclarationIds` field and retains its previous response shape.
