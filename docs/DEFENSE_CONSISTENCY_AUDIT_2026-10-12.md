# Defense consistency audit — October 12, 2026

## Scope and initial findings

Audit the restored live database, current deployed configuration and the member/RND/admin defense journeys. Separate retained recovery omissions, intentional policy changes, unpublished development work and actual defects. Preserve current member activity and existing safety gates. Keep repeated tests local; use bounded live reads and a final role smoke. CLI and local scripts are preferred over service MCP tools.

Initial evidence:

- The screenshot's Health trial is pending its first usable current meal plan; pending RND previews do not start the clock. The wording “Pending kickoff” is unclear.
- The accepted V4 policy is 30 days and Free/Lifestyle/Health swap caps of 3/10/21. Older membership operations documentation still describes 14 days, 3/6/6 and optional whole-plan replans. Current executable policy and the later engineering record supersede that text.
- Development and demo have different histories. Development includes the tested license-update feature and model-policy/UI changes that were not part of the narrow live repairs. These differences must be inventoried rather than attributed to database loss.
- The newly reported repeated worker recipes have already been repaired and deployed; their regression and live repair evidence must remain in the acceptance checks.
- Membership cards repeat explanations and reset metadata and use large decorative capacity charts. Profile settings include an expanded membership explanation inside the form surface. The owner requested minimal cards.

## Batch 1 — Read-only inventory and plan

1. Compare recovery manifests and retained reference/migration records with live. Check validated relationships, current cycle/job/preview consistency, report/profile references, membership/usage state and RND credential gates. Interpret legitimate post-restore activity separately from loss.
2. Compare only the needed deployment configuration with its retained pre-switch evidence; keep secrets private. Inventory committed development-versus-demo source and unapplied migrations.
3. Run the full deterministic/static repository gates and select guarded PostgreSQL/HTTP acceptance suites for defense paths. Preserve unrelated uncommitted work.

Gate: each finding has reproducible evidence, severity, ownership and a proposed correction; no production mutation during diagnosis.

## Batch 2 — Correct behavior and data only where evidenced

1. Write a regression for each confirmed behavior defect before changing its handler/service/policy.
2. Check the same change through member, RND and admin boundaries, account isolation, retries/concurrency and pending-versus-approved states.
3. Any necessary live record repair requires a fresh verified backup, explicit target/scope guards, retained history and a dated audit. Do not recreate missing real actions or use current values to manufacture historical evidence.
4. Keep unpublished features separate from defects; verify their migration/release requirements before including them in a release.

Gate: reproducer passes after correction, relevant surrounding suites pass, and no weakened safety or quota gate.

## Batch 3 — Minimal reusable membership/profile presentation

Use Impeccable within the existing KAINARA palette, fonts and shared components. Display the current membership, concise state/date, actionable remaining allowances and required controls. Put policy explanations in one accessible help entry. Remove repeated instructions inside ordinary cards/forms. Preserve quota cadence, paid history, checkout actions and server authority. Retain meaningful blocked/error feedback.

Gate: active/pending/expired/paid/scheduled states, both themes and member mobile remain clear and accessible; no invented start/expiry dates or hidden required action.

## Batch 4 — Local regression and role rehearsal

Run deterministic suites, types/lint/build and relevant fresh disposable PostgreSQL acceptance. Cover authentication/account switching; report acknowledgment and profile confirmation; immediate worker wake and variety; weekly plans/logging/swaps/groceries; membership kickoff/expiry/allowances; clarification/review/credential/quarantine/history boundaries; outside food; and admin reference data. Use local intercepted providers where required and label those limits. Inspect UI in one batched desktop/mobile/theme pass, repair concrete findings together, then confirm once.

Gate: no unresolved defect blocks these defense journeys. External provider, payment settlement and clinical validation are reported separately, not claimed from fixtures.

## Batch 5 — Release and bounded live verification

Prepare a clean compatible demo release from tested changes, confirm any database migration target before applying, and preserve existing deployed secrets. Deploy backend before dependent frontend. Verify readiness and one bounded member/RND/admin smoke on the public URL. Record exact commits/deployments, findings, omissions, screenshots and rollback. Keep load/iteration tests local and preserve the defense transfer budget.

Gate: the published UI and backend agree on the tested policy and current data; rollback and local fallback remain available.

## Results

### Confirmed findings and corrections

- Retained data matches the verified recovery source: 51 of 52 accounts remain with unchanged password hashes. One account and its 47 meals were removed by a recorded self-service deletion on October 11, not by transfer loss. They must not be resurrected. All seven reference/rule tables match full-row fingerprints and counts: FoodItem 15,072, FoodAlias 81, RawRecipeCandidate 1,967, MealLibrary 2,027, ClinicalEvidenceSource 16, ConditionIngredientRule 9 and ConditionNutrientRule 10. All 22 saved PRC credential records are unchanged. The retained encrypted document decrypts with the deployed key and matches its saved checksum.
- No unvalidated foreign keys, orphan planning reports, duplicate active slots, duplicate planned logs or duplicate daily aggregates were found. ENNS consumption remains absent. Nine trials are started and six are pending; none has a future start. Pending kickoff for the reported member is expected while all 21 current previews still await RND review. Plan-review usage counts an admitted weekly episode, not one individual meal decision.
- Deployed signing, refresh, scheduler, encryption and provider secrets match retained switch evidence. Only the expected database target and clarification activation differ. Membership uses V4 defaults, without quota overrides. The older V2 operations document was corrected to the executable V4 policy; no entitlement or quota was changed.
- Development contained the tested license-update feature, model-policy and shared UI changes absent from the narrow demo patches. The owner approved publishing the verified development update and additive license history migration. Existing license credentials remain unchanged.
- The RND case-detail API omitted the saved recipe image. It now uses the member image resolver with bounded source/library photo fields and existing fallback/attribution rules. Tests cover actual SQL detail retrieval, an unclaimed pending case, source photo rendering, failed image fallback, adapted photo priority and rejecting an obsolete swapped-recipe photo. Claims, evidence checks and approval rules are unchanged.
- Membership cards now show concise state, remaining/cap allowances and real period dates. Pending periods do not render an empty calendar. Current Health expiry does not borrow a later Lifestyle expiry. Policy explanations live in one accessible help control; the expanded policy paragraph was removed from profile forms. Shared subscription history retains admin/member endpoints and owner isolation.

### Verification before release

- Backend: 950 passing deterministic tests, zero failures and one pre-existing TODO. Frontend: 976 passing tests plus eight Node checks; 28 focused tests passed after the final membership/photo changes. Both production builds, ESLint and architecture budgets pass.
- Actual disposable PostgreSQL suites pass for membership timing/allowances, report activation/corrections/concurrent check-ins, integrated member/RND/admin role boundaries and six license-update HTTP/database groups. The integrated-role script was updated to send the required current review-context token rather than bypassing the production guard. Its artificial cycle emits a grocery projection warning because it lacks a normal actionable snapshot; this run does not establish that fixture's grocery browser flow. Previous generation/grocery evidence remains in the recovery and variety records.
- One desktop/mobile/light/dark inspection batch and one confirmation batch pass with no browser errors or horizontal overflow, including pending and active/paid-next periods. Screenshots and raw acceptance receipts are retained privately under `backend/.local/defense-audit-20261012/`.
- The full formatting gate reports 48 pre-existing committed formatting violations. Changed implementation files were formatted; unrelated formatting debt was not swept into this release. External provider calls, payment settlement and clinical validation are not established by these isolated fixtures. No new live load test was run.

### Approved release

The exact migration target is `nameless-dust-38810716` / `br-round-art-b355gp02` / `neondb`. Before migration, the custom PostgreSQL archive was verified by listing and SHA-256: `972680b201034a4b7ea5eb8aeeebe7d35222714655319d91aa2c62a8237471f1` (13,859,536 bytes, 2026-10-11 18:22:32 UTC). The archive and deployed credentials remain private and uncommitted.

Migration, deployment IDs and bounded public smoke results will be appended after the approved switch completes. Rollback starts with the last working code pair at `2176ccd285a828ff978b7a8f068a3a9984eeba84`: Railway `150c4c83-0e3c-4ded-9f7f-14682e196158` and Vercel `dpl_E72E7eTKpV5Wf9oRXsB6uxbdwiF1`. The additive request ledger can remain on code rollback; never overwrite newer member activity with an old database restore. The verified local defense fallback remains available.
