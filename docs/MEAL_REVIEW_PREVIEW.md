# Synthetic meal-review preview

This local preview recreates the successful governance acceptance fixture for owner inspection. It uses PostgreSQL in Docker at loopback port 55485, a guarded test API on 5103 and a separately built frontend on 3103. The shared application at localhost:3000 and its database are unchanged. All displayed people, credentials, clinical notes and nutrition examples are synthetic.

## Open the prepared preview

From the repository root in PowerShell:

```powershell
powershell -File scripts/start-meal-review-preview.ps1
```

Leave the terminal running, then open [preview login](http://127.0.0.1:3103/login). Use the local preview password supplied in the owner's chat. No actual email inbox is needed. Sign out before switching accounts, or use separate browser profiles. Use 127.0.0.1 for the preview so it has a separate session from localhost:3000.

| Account | What to inspect |
| --- | --- |
| admin@example.test | Meals → search Synthetic routed journey plate → quarantined review timeline; Audit → RND history |
| rnd-heart-senior@example.test | Original recipe verifier and heart member approver; heart-priority case queue |
| rnd-flagger@example.test | Both flag reports; heart-specialist priority work |
| rnd-heart-junior@example.test | Independent re-verifier; prior version, concerns and corrected version |
| rnd-kidney@example.test | Non-matching heart-case visibility; shared recipe re-review remains visible |
| rnd-general@example.test | General RND, with self-reported experience that did not grant specialist priority |
| member-heart@example.test | Approved heart member serving withheld after the recipe flags; profile/health details |
| member-heart-pending@example.test | Separate pending heart case for comparing specialist/non-specialist queues |
| member-healthy@example.test | Healthy profile and withheld member serving |
| member-diabetes@example.test | Pending diabetes case, prioritized to rnd-diabetes@example.test |
| member-pregnancy@example.test | No matching specialist; experience priority to rnd-kidney@example.test and rnd-experience@example.test |

The original test names remain in the records and immutable snapshots. Login aliases do not rewrite the historical actors. The fixture is paused after the second incident, with the recipe quarantined; admin release still requires two valid independent confirmations. Inspecting or changing it will change this preview's state. The priority window uses real time and opens the member cases to the general pool after expiry.

## Guarded recreation

The database must be a fresh task-owned `kainara_meal_governance` database at 127.0.0.1:55485, with all migrations applied. Configure NODE_ENV=test, synthetic JWT/encryption keys, no provider credentials and membership disabled. Run `npm --prefix backend run test:acceptance:meal-governance`; the command refuses a nonempty or mismatched target. After success, set MEAL_GOVERNANCE_PREVIEW_PASSWORD to a local-only password and run `tsx scripts/meal-governance-preview.ts --prepare` from backend. The prepare script requires the expected nineteen synthetic fixture accounts and quarantined lineage, hashes the password, assigns stable email aliases and completes browser-only profile fields. The second admin exists for the batch ownership test. An unrelated old fixture member intentionally has no profile and is excluded from the inspection table.

Build the frontend with NUTRIMIND_REPAIR_E2E=true, NEXT_PUBLIC_API_URL=/api, INTERNAL_API_URL=http://127.0.0.1:5103 and an empty NEXT_PUBLIC_GOOGLE_CLIENT_ID. This uses .next-repair and leaves the normal development/production builds intact. The launcher starts only this prepared fixture. No shared migration, seed, account or routing setting is changed.

The October 8 preparation passed the complete eleven acceptance groups again, isolated frontend production build and real password login/profile reads for the seven main inspection accounts. After preparation, authenticated queue reads still showed the pending heart member to the three heart specialists and hid it from the kidney specialist; admin detail retained two incidents, QUARANTINED and disabled release. Backend script typing, focused lint, launcher syntax, architecture and changed-file checks passed. The automated frontend start was rejected by approval review with only “blocked by policy”; the user-run launcher is provided, and a live preview browser sign-in is not claimed verified.
