# October 16 live recovery

## Recovery source and omissions

The owner approved preparing a new live database from the verified October 10, 14:00 Philippine-time backup, current migrations and verified local additions. The old Neon project and original archives are retained. Hosted activity after that backup is unavailable while the original project is blocked; code and account specifications cannot reconstruct clinical answers, approvals or real member activity.

## Batch 1: isolated recovery copy — integration tested

`backend/scripts/prepare-defense-recovery.mjs --apply-local` refuses any source except `kainara_local_development@127.0.0.1:55432`. It captures a full source archive, restores a new task-owned Docker database and changes only that copy. Private connection settings, archives, credentials, account logs and count manifests are under ignored `backend/.local/defense-recovery/`.

The successful rehearsal retained all 39 existing accounts and password hashes, 291 meals, nutrient records, two historical profile reviews, historical decisions/audits and one clinical document. Document decryption and its SHA-256 matched with the retained encryption key. All foreign keys are validated. Thirteen documented synthetic accounts were recreated from their saved profile/credential-state specifications, bringing the copy to 52 accounts. Their new audit events have current timestamps; no old clarification answers or decisions were manufactured.

The recovery copy excludes 2,620 obsolete ENNS consumption rows, disables its source and marks its releases retired. It preserves source/release metadata and activation/audit relationships. The source backup and database retain the rows and immutability triggers. Cleanup temporarily disables the consumption table's user triggers only inside the isolated copy's transaction and restores them before commit.

Private evidence: `backend/.local/defense-recovery/1791696253565/manifest.json`. The prepared export is retained alongside its checksum. Its target is `kainara_defense_recovery@127.0.0.1:50613` and is distinct from normal localhost development.

## Batch 2: reduce database retrieval — integration tested

FNRI and USDA matching now retrieve identity/matching fields and hydrate complete nutrient evidence only for selected foods. Exact, alias and lexical FNRI outcomes matched the original full-record lookup for 1,618 inputs. Stable identities use a ten-minute process cache with successful catalogue-mutation invalidation; empty/failed loads are not cached. Authorization, clinical readiness and claim eligibility still read current records.

Candidate coverage is preserved. Recipe and queue projections retain the fields required for eligibility, allergy checks, signatures and serving composition. Queues hydrate only actionable cases, and completed cycle reconciliation avoids retrieving full historical meals. The existing idle worker backoff remains in place.

## Batch 3: reduce UI reads and retire ENNS — integration tested

Static catalogues and historical views refresh on opening, relevant events/mutations and explicit refresh. Selected profile/meal review status polls every 15 seconds using metadata revisions, then fetches the full canvas only after a change. Existing live events invalidate immediately; an inactive case closes the canvas to the default panel with an explanation. Queue counts, clinical status and notifications use a 60-second fallback; hidden tabs pause polling. Current member plans fall back every 120 seconds when settled and every three seconds while preparing. Every mutation retains server validation.

Owner-scoped cache keys and immediate detail masking prevent another account's profile, document or outside-food review appearing after account switching. Late requests from the previous account cannot overwrite the new account's state/cache. Browser and focused regression checks cover these boundaries.

ENNS totals, consumption import/publication controls and planning-region display are removed. Authenticated retired endpoints return `410 FEATURE_RETIRED`. Historical metadata, schema and audit references remain readable; other nutrition-data operations remain available. Impeccable was applied within the existing typography, palette and shared components. Both admin-data themes were visually inspected, and its mechanical scan reported no findings.

## Batch 4: local rehearsal and transfer budget — passed within scope

Measured on October 11 at 07:04:57 UTC through the task-owned loopback TCP proxy, including PostgreSQL protocol/authentication overhead. These are database-to-API bytes, not browser response sizes or a Neon quota reading. MB below means 1,000,000 bytes.

| Measurement | Result | Gate |
| --- | ---: | ---: |
| Full-record FNRI baseline | 5,210,646 bytes | Comparison baseline |
| Cold FNRI matching identities | 138,916 bytes | 97.33% reduction; at least 90% required |
| Warm FNRI matching identities | 0 bytes | Cache hit |
| One 21-meal generation | 6,674,708 bytes | At most 25 MB |
| Ten-session steady reads over 181.6 seconds | 2,211,528 bytes | Conservative projection: 44.23 MB/hour; at most 50 MB/hour |

The rehearsal mixes seven members, two active RNDs and an administrator. It includes cold catalogue loads, notification/status reads, queue refreshes and selected review status. Limits apply to this measured workload and one backend instance; repeated generation, additional users/replicas, new data volumes and external providers require a new budget assessment. Initial over-budget iterations were corrected before the passing measurement; no search-result coverage cap was introduced to make it pass.

Verification evidence:

- Backend suite: 940 passed, zero failures and one existing TODO. Frontend suite: 950 tests passed across 195 files, plus eight Node checks. Subsequently, 11 focused account/profile cases passed, including two new outside-food owner-isolation checks.
- Backend/frontend production builds, full ESLint, script typechecking, formatting and all 25 architecture budgets passed. Fresh actual-SQL review-filter/context acceptance passed 11 and nine groups respectively; the exact-context reference fixture passed its six core groups before opening the browser API.
- Ordinary browser journeys used distinct member, eligible/ineligible RND and admin accounts. Checks covered clarification answers/handoff, profile acknowledgment, exact-context references, stale fullscreen exit, canvas-only Ctrl+wheel/H/V, audit history, and member layouts in both themes/mobile sizes.
- A final five-journey Chromium run passed real API/database approval, rejection, pending replacement, read-only admin audit and explicit outside-food review/correction. A separate actual admin quarantine-release browser journey passed. The synthetic outside-food preview supplies known values; these checks do not claim live Gemini estimation quality or external payment/email verification.
- A private fixture launcher initially started browsers before its replacement API was ready. Adding a readiness wait produced the clean five-test pass; that failure was a rehearsal-startup race, not an application authorization failure.

Private byte evidence: `backend/.local/defense-recovery/1791696253565/transfer-result.json`. Repeated/load rehearsals stay local.

## Final clean export — restored and verified locally

The final export comes from a fresh restore of the pristine prepared archive into `kainara_defense_final@127.0.0.1:50613`, separate from mutated rehearsal databases. All retained table counts match the preparation manifest: 52 users, 291 meals, 15,072 foods, 2,027 library recipes, one clinical document, two profile reviews, 625 audit events and zero ENNS consumption rows. All 52 password hashes match the prepared copy; document decryption/hash and all foreign keys pass. All 103 migration names/checksums are present; 104 migration-table rows include the retained historical unsuccessful attempt.

- Archive: ignored `backend/.local/defense-recovery/1791696253565/final-defense.dump`.
- Size: 13,812,909 bytes.
- SHA-256: `822ae013e3788362fd74227ae318a1250bb1316b2ef78388609eb6c03fb4ec38`.
- Complete counts, migration checksums, verification and omissions: adjacent private `final-manifest.json`.

## Batch 5: hosted restore and deployment — verified October 11

The owner confirmed the exact target and authorized continuation. Authenticated official Neon, Railway and Vercel CLIs all verified `chimairelp@gmail.com`. Restored the verified final archive into the empty `neondb` database on branch `main` / `br-round-art-b355gp02`, project `kainara-defense-20261016` / `nameless-dust-38810716`, PostgreSQL 17, Singapore (`aws-ap-southeast-1`). Endpoint: `ep-soft-bonus-b35ab8jw`; role: `neondb_owner`. The old blocked project and all original archives remain intact.

Restore used one transaction with exit-on-error and no owner/privilege restoration. Before any application writes, all retained table counts, all 52 password hashes, 103 applied migration names/checksums, validated foreign keys and the encrypted document/hash matched the final manifest. Passwords/connection strings were passed privately, never written into tracked files. The recovery directory now has an explicit repository ignore rule. Private evidence includes `neon-restored-manifest.json` and `neon-restore.log` beside the archive.

The actual deployed document key matched the retained key. Railway changed only `DATABASE_URL` and `CLINICAL_CLARIFICATIONS_ENABLED=true`; all 45 other existing variables were compared and preserved, including signing, refresh, scheduler and provider secrets. The new pooled connection bounds the API pool to five connections and uses 30-second connection/pool timeouts. Vercel's existing production variables were unchanged; its environment export masks sensitive values, so those placeholders were not used to replace secrets. Actual public browser requests verified routing.

The clean release checkout excluded unrelated shared edits. Both production builds and backend script typechecking passed with all 62 frontend pages generated from committed lockfiles. Promoted tested commit `20899735f998cd57fd783ad86a1087d68f9eb142` to `demo`; compared with tested implementation commit `63ac381887cce3f4aba25a8570462df173d46234`, it adds only recovery documentation. Deployed the compatible backend first, checked `/ready` and ordinary account/profile access, then deployed the frontend. Existing public URL: [www.kainara.site](https://www.kainara.site).

| Production component | Verified deployment | Commit |
| --- | --- | --- |
| Railway API | `24a6ce5f-4554-4b3c-a9aa-d20aebd9d880` — SUCCESS | `5a9c025fe97a1d2848a6f40a9ff32578061111a4` |
| Vercel frontend | `dpl_Cw6k6yPpJAKsjdbbmabgJ9J79ivz` — READY, automatic member confirmation refresh; preceding profile and review UI retained | `e57e630eae00f1d87f368724638da1e6f5fc4a0d` |

The later frontend-only health forms inbox release preserves the compatible API above and changes no schema or deployed environment variables. Its public browser check, narrow source scope and previous frontend rollback target are recorded in `docs/HEALTH_FORMS_INBOX_RELEASE_2026-10-11.md`.

The subsequent frontend-only profile refinements preserve that inbox and compatible API. The continuous RND guidance sheet, approved shared button styles and reusable profile settings surfaces are documented in `docs/PROFILE_UI_REFINEMENTS_2026-10-11.md`. All three public personalization tabs were checked with an existing synthetic member; no profile or clinical form was saved during the live smoke.

The October 12 frontend-only confirmation refresh corrects a stale member waiting state after RND approval, including missed live events and older blocked requests. Its 43 focused tests, isolated browser transition and bounded public read-only smoke are recorded in `docs/MEMBER_CONFIRMATION_REFRESH_2026-10-12.md`. The immediate frontend rollback is `dpl_F33ixRnrEsU2ct2kBBGUNxvJguwH` at `52752a92e264b000eb464cbad272efc7da8fc8f4`; no database restore is needed.

Later October 11, owner-confirmed migration `202610110002_initial_profile_clarification_context` and the narrow release above corrected question publication for initial profile revision 0. A fresh verified backup preceded the migration, with retained counts and credential fingerprints unchanged. The ordinary live RND → member answer → second RND handoff/resolution journey passed. See `docs/INITIAL_PROFILE_CLARIFICATION_FIX_2026-10-11.md` for the archive checksum and exact evidence. The original recovery pair was Railway `616d9157-bd6b-4425-80ba-81e90fea97e1` and Vercel `dpl_62NuFUQiMKdvd6GJDWdjQ1YAp7LY`, both at `20899735`.

One bounded actual Chromium smoke passed separate member, active RND and admin accounts on the public URL. Member mobile clinical details/report, RND reviews/library, admin nutrition data/audit and the historical RND profile approval's read-only shared canvas loaded without browser errors, API 5xx responses, false account-profile failures or page-width overflow. Admin canvas exposes no Approve/Reject actions. Login/navigation measured 7.79 seconds for the cold member, 2.65 seconds for RND and 1.77 seconds for admin; these measurements do not guarantee all future cold starts. An initial smoke assertion incorrectly treated the retained generic nutrient evidence freshness heading as an obsolete ENNS control; the corrected ENNS-specific assertion passed on the bounded admin rerun, without application changes. Actual `410 FEATURE_RETIRED` behavior also passed. Private evidence: `live-final-smoke.json`, role screenshots and `backend-live-preflight.json`. Audit/session events generated by these real checks legitimately increase the restored baseline counts.

### Release sequence and rollback

1. Keep the verified archive/checksum, final manifests and private configuration snapshots. Never restore the old archive over current live data; capture a new backup before any later recovery operation.
2. Current compatible deployment pair is recorded above. Previous baseline was commit `ce9f9e41`, Railway `bed59fd0-7cf7-4f87-a499-954fdce20d4f` and Vercel `dpl_23DZVnY3JEzY2WVyLL2fQ11xK4Mh`. Previous metadata/configuration is retained privately. Those deployments are historical evidence, not assurance that an older API supports the current schema or that the blocked old Neon database is usable.
3. If a later deployment fails, pause new live writes, preserve evidence and use the local fallback. Redeploy the known compatible `5a9c025f` pair against the verified new target; validate readiness and ordinary role access before reopening. The previous `20899735` pair supports the relaxed database constraints but reintroduces the revision-0 submission failure. Check schema compatibility before considering an older release. Never restore an older archive over new member activity.
4. Retain deployed document/signing/refresh/scheduler/provider secrets. Restore only an explicitly confirmed target, and never use masked Vercel environment exports as secret values. Preserve any post-switch member activity rather than replacing it with the October 10 snapshot.

### Usage budget until October 16

Check Neon transfer after each bounded rehearsal and daily through October 16. Record the used/allowed amount and timestamp; a missing reading is unknown, not zero. Track compute/storage separately from transfer.

A daily thread follow-up, **Defense database budget**, is active at 09:00 local time through October 16. It uses connected Neon tools or the authenticated official CLI for this exact project, stays quiet on unchanged/non-actionable states, and reports delayed/unavailable readings honestly. Free consumption-history API access returns a plan restriction; repeated calls cannot bypass it. At the measured rate, ten continuously active sessions for five days would retrieve approximately 5.3 GB; close rehearsal tabs afterward and keep repeated generation/load testing local.

At the final metadata check, October 11, 09:02:01 UTC (17:02 Philippine time), the new project's API reported zero transfer/compute counters despite actual SQL activity. These are delayed readings, not proof of zero usage or a reliable current quota percentage. The branch reports 135,192,576 bytes of logical storage. The recorded reset is November 1 UTC. Track the dashboard/current project counters until they catch up; do not claim guaranteed remaining capacity. Use a conservative 5,000,000,000-byte transfer operating budget based on [Neon's published Free transfer allowance](https://neon.com/blog/how-to-make-the-most-of-neons-free-plan), and verify current account terms in the dashboard. The [current Free plan update](https://neon.com/blog/neon-free-plan-1-gb-per-project) separately documents 1 GB storage per project and 100 CU-hours; compute/storage are separate from transfer. Endpoint minimum/maximum are 0.25/1 CU with the default five-minute suspension setting.

| Transfer usage | Action |
| --- | --- |
| 50% | Warn; inspect unexpected read/generation traffic and keep rehearsals local. |
| 70% | Stop nonessential live rehearsals and repeated generation; preserve capacity for the defense. |
| 85% | Use the verified local fallback for the defense workload. |

The local fallback was restarted and verified after live deployment: PostgreSQL at `127.0.0.1:55432/kainara_local_development`, API at `http://localhost:5000` and frontend at `http://localhost:3000`. `/ready` and an ordinary Chromium admin login/profile check passed with local API routing, no application errors and no hosted database dependency. Normal local data retains 39 accounts and 291 meals; the separate clean final recovery database/archive retains the 52-account transfer baseline. Live and local data do not synchronize automatically. Private evidence: `local-fallback-smoke.json`, screenshot and process manifest. Before presentation, follow `docs/LOCAL_DEVELOPMENT_AND_DEFENSE.md` to start Docker/services and repeat readiness/login after a restart. Local data remains available, but network-dependent AI, email, OAuth and payment services still depend on their providers.

All five batches have passed their stated verification gates within this scope. Daily capacity monitoring continues until October 16. Measured transfer reduction and operating thresholds provide a reserve for the expected workload, not a guarantee that Free quotas cannot be exhausted or that external provider journeys are clinically validated.
