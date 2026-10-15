# Owner-requested test-data cleanup — October 15, 2026

## Authorized scope

The owner requested stale/test-data cleanup while protecting `admin@gmail.com` and `nutritionist@gmail.com`, then explicitly selected **identified test accounts only**. Non-test accounts remain. Account identification used the existing `devfixture_` IDs, explicit `[TEST …]` names, QA/journey/batch acceptance account patterns, and the three additional accounts named by `prisma/seed-test-accounts.ts`. An address ending in `.test` alone was not sufficient evidence. Catalogue age or a vague source label was not a deletion criterion.

## Recovery and target

- Exact database checked before reads/writes: Neon project `nameless-dust-38810716`, main branch `br-round-art-b355gp02`, `neondb`, endpoint `ep-soft-bonus-b35ab8jw`.
- Captured a full custom-format PostgreSQL backup at **2026-10-15 07:50:36 UTC**, 14,499,624 bytes. SHA-256: `cc67b5c4f81f065443f6d476b8275db1cf7feecde90ed5ed5d2f9c56e719b50f`.
- Successfully restored the backup into the separate local `kainara_cleanup_20261015` database and rehearsed the cleanup there before applying it to the shared defense database. No restore was performed against the live database.
- Archive, inventory, account selection, scripts and detailed receipts remain private under ignored `backend/.local/system-cleanup-20261015/` and adjacent ignored scripts. They contain private records and must not be committed.

## Applied result — 07:55:23 UTC

| Action | Result |
| --- | ---: |
| Explicitly identified test accounts | 43 |
| Accounts physically deleted | 30 |
| Test identities disabled and retained for saved attribution | 13 |
| Expired sessions removed, at least one day past expiry | 16 |
| Expired outside-food previews removed, at least one day past expiry | 2 |
| Unreferenced archived synthetic meal fixtures deleted | 2 |
| Terminal flag-draft note bodies cleared | 19 |

The 13 retained identities have suspended sign-in, password login disabled, OAuth links removed and sessions revoked. They remain because saved decisions, flags, clarifications, verification or immutable work-credit evidence refer to them. One retained member's 15 historical plan rows remain; pending test slots were cancelled and unfinished test generation stopped. No approval was reassigned to another reviewer. No constraint, immutable-history trigger or clinical eligibility gate was disabled.

Unreferenced fixture deletion was limited to two explicit `qa-flag-draft-20261015-*` / `qa-unified-meal-20261015-*` archived recipes, with no plans, flags, approvals, clearances, derivations, safety reviews or lineage. Referenced fixture history remains archived. The genuine recipe catalogue and source datasets remain intact. Old imported recipes awaiting verification were not assumed obsolete.

## Checks — 07:56:51 UTC

- 29 account rows remain: 16 preserved non-test/protected accounts and 13 disabled test-attribution identities. Zero identified test accounts remain active; no test sessions, review claims or running generation jobs remain.
- Protected accounts matched all saved User fields exactly across cleanup, including password hashes. Other accounts' identity, password hashes, roles, suspension and onboarding state matched. Genuine catalogue IDs, status, signatures and verifiers matched. No patient credentials or clinical payloads are included here.
- Saved review/work-credit counts are unchanged: seven recipe reports, 25 recipe review decisions, three confirmations, 12 meal-plan decisions, zero condition-clearance decisions and 28 work credits. Per-account/fixture cleanup actions are attributed in AuditEvent; existing audit history remains.
- All foreign-key constraints remain validated. Normal API login for the protected nutritionist returned HTTP 200; a retained test reviewer's login was rejected. Normal browser review queues and outside-food tab loaded without console errors. Member queue count changed from 15 to five after removal of test work.

## Review notification dots

The additional owner request replaces the inline dark bullets on Pending/Outside food logs with the notification bell header's green, upper-right activity mark. `NotificationActivityDot` is shared by those tabs and the existing bell header, including theme rings and reduced-motion handling. Counts remain available to screen readers and each dot disappears independently when its queue is empty.

Fourteen existing notification/review-filter component tests, scoped ESLint, frontend production build/TypeScript, React quality review and Impeccable detector pass. Actual normal browser verified both dots, 8px absolute placement, tab switching and no console errors. Local screenshot: `codex_outputs/review-notification-dots-20261015.png`.

Database cleanup is already applied to the shared defense database. Git publication of the UI change does not itself establish successful hosted deployment.
