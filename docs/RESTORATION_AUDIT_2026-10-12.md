# Restoration audit — October 12, 2026

## Scope and result

Work and verification were performed in `C:/Users/chima/Desktop/Nutrimind`, starting from `b567bef0`. The pre-switch deployed baseline is `ce9f9e41`; the recovery and later release decisions are recorded in [defense recovery](DEFENSE_RECOVERY_2026-10-11.md). Later approved behavior takes precedence over that baseline.

The immediately reported loss is fixed: top progress now stays active while visible page data is loading, including a direct refresh. Two previously identified parity findings are fixed in source/documentation: FNRI imports tolerate verified line-ending transport changes, and current governance/study instructions reflect admin-only quarantine release. The owner subsequently authorized the three eligible live record repairs described below. No catalogue reimport, database migration or live deployment was performed.

This is not a claim that every historical record can be recovered or that all live meals are cleared. The remaining live evidence holds and migration provenance limits are recorded below.

## Restoration checklist

| Area | Evidence and outcome |
| --- | --- |
| Shared Desktop edits | The earlier checkout correction brought `0576a316`, `e7aa471b`, `e48ceba6` and `28d4663e` into this checkout. No other worktree was edited in this pass. Existing foreign edits remain unstaged. |
| Top sliding progress | The committed component was byte-identical to the pre-switch baseline. It hid 250 ms after route commit and never tracked page data or first load. Shared loading ownership now fixes those gaps; success, failure, Strict Mode cleanup, concurrent regions and abandoned navigation are tested. The original strip palette is retained. |
| Page/API entry points | Git comparison finds no deleted files under `frontend/src/app` or `backend/src/routes`. Static inventory covers 306 route declarations and 238 frontend calls with no unmatched static calls; 11 dynamic callers retain their existing trace evidence. This is not a live execution of every route. |
| Deleted source modules | The file-by-file inventory is in [verification JSON](verification/RESTORATION_AUDIT_2026-10-12.json). Apart from retired ENNS `ReleaseOperations`, deletions belong to `63ae489a`, the October 10 cleanup of unused or superseded modules. Their replacement behavior remains in active workspaces; restoring dormant files would not restore a missing route. |
| Profile/onboarding | Reusable settings sections, compact child tabs, mobile onboarding sections and the health forms inbox remain. Their approved redesigns are preserved. |
| Shared controls and feedback | Solid primary/outlined secondary buttons, small header refresh actions, collapsed brown announcements and shared feedback notices remain. No explanatory text was added to member cards. |
| RND workflows | Single-RND ordinary approval, clarification handoff, acknowledgment/corrections, exact-context references, current credential gates and license requests remain. Selected-review invalidation retains its 15-second fallback. These have unit/local acceptance evidence in the parity report; current suites pass. |
| Quarantine | Current guide corrected to match executable `MealReviewService`: the first incident requires one independent RND; quarantined recipes cannot be claimed/confirmed by an RND; the admin decides release/archive with current evidence and rationale. Member-specific clearance still applies. Historical October 8 results are explicitly labeled superseded. |
| Planning, logging and groceries | Current shared image/title/ingredient/complete-plate contracts, preparation refresh, worker variety, quota/idempotency and historical logging protections pass the current suites. No old card or generation implementation was reinstated. |
| Database alterations | The [full parity audit](SYSTEM_DATABASE_PARITY_AUDIT_2026-10-12.md) verified complete-row equality of 14 reference tables, retained recipe/nutrient alterations, accounts, document decryption and compatible physical schema. Those results are dated evidence, not an automatic live/local synchronization claim. |
| FNRI reproducibility | Only CRLF-to-LF normalization is permitted against a pinned canonical hash. Verified deliveries retain the original publisher delivery fingerprint. Tests prove LF/CRLF/mixed transport equality and reject modified identifiers, nutrient content and extra whitespace. Unknown nutrient values still remain unknown. |
| Approved retirements | ENNS observations/imports/regional planning and dispute resolution remain retired. No two-RND quarantine exception was restored. |

## Current live record findings

A bounded repeatable-read transaction with `SET TRANSACTION READ ONLY` inspected current/future unfinished cycles at **2026-10-12T03:10:01.171Z** on `nameless-dust-38810716 / br-round-art-b355gp02 / neondb`. It ignored superseded plan rows when checking active counts. Private IDs, fingerprints and candidate lists remain in the uncommitted local inventory; credentials and clinical answers were not printed.

- **19 current/future slots** have older rice evidence. **Three** qualify for the existing unchanged unrestricted-serving repair guard. The other **16** already have safety revalidation holds and do not qualify for that shortcut; they require current-context review. This is a later reading than the previous audit's 18 slots, not a rewritten historical count.
- No active current/future cycle in this bounded inspection had fewer saved rows than its expected count. Earlier past-date incomplete cycles remain historical findings; superseded replacement rows are not treated as extra active meals.
- The owner confirmed the exact defense target and three eligible rows. A fresh custom PostgreSQL backup contains **13,870,485 bytes**, SHA-256 `a8ec8afee05dd6a3f6bd53115c5afd255dee9896c2e84986ce09ec0b841e018a`; the archive header and `pg_restore --list` were verified. At **2026-10-12T03:17:37.035Z**, a serializable transaction rechecked the preview fingerprint, applied the existing guarded repair, and verified all neighboring cycle records, nutrients, ingredients, IDs, logs, decisions and clearance usages remained identical. Exactly three rice evidence/signature/work-key records were refreshed, with three maintenance audits; the grocery list is marked stale for normal reprojection. The cycle retains 15 saved rows; authoritative cleared IDs increase **3 → 6**. Historical dates were not repaired. The other 16 future safety-held slots remain outside this scope.
- Two inherited migration hashes still match the recovery ledger but do not match repository bytes. All historical Git versions available for each file were checked with raw/LF/CRLF, BOM and final-newline variants (eight distinct byte variants per migration); no matching delivery was found. Current compatible schema evidence remains valid. No ledger history was changed.
- Old-project activity absent from verified archives cannot be reconstructed from source. Retained audit references and intentional account deletion/ENNS removal must remain distinguishable from a transfer omission.

## Verification

| Gate | Result |
| --- | --- |
| Backend full suite | 976 pass, zero fail; one existing TODO |
| Frontend full suite | 1,010 pass in 207 files, plus eight Node checks |
| Focused loading/report/query checks | 39 pass; overlap the full suite |
| FNRI completion regression | Six pass; overlap the backend suite |
| Browser loading lifecycle | Two scenarios pass: desktop light and mobile dark; delayed guidance, direct reload, resolution and error cleanup. APIs are fully intercepted; no AI generation or live mutation was submitted. |
| Production builds | Backend and frontend pass. Frontend uses `.next-production`; the owner's port-3000 development server remains running. |
| Contracts/architecture | Zero unmatched static API calls; all source/entry-point budgets pass |
| Changed frontend lint | Pass using the project's installed ESLint |
| Impeccable | Existing-theme hardening and bounded desktop/mobile inspection; changed surfaces detector emits no findings. No claim of comprehensive accessibility or physical-device verification. |

The initial browser width assertion assumed the reserved scrollbar gutter was part of the fixed bar's width. The fixture now verifies the visible viewport bounds and progress lifecycle; no application CSS was changed for that assertion. An initial root-directory lint command resolved an incompatible ESLint version; the actual frontend-installed lint passes. Neither failed fixture/tool invocation is concealed as an application defect.

## Release and rollback

This source pass is a development update. It does not imply that `kainara.site` has received it. The preceding compatible hosted pair is documented in [rice repair](UNCHANGED_RICE_PLAN_REPAIR_2026-10-12.md). Publication needs the tested code commit and normal backend-before-frontend release sequence; this pass requires no migration, secret change or wholesale database restore.

Code rollback can revert the loading ownership/FNRI normalization changes independently. The three refreshed evidence records use the existing schema and are compatible with the preceding release. Preserve all later member activity and existing safe record repairs. Never restore a full older backup merely to roll back presentation. Remaining clinical holds require their existing review path, not a code rollback or blanket release.
