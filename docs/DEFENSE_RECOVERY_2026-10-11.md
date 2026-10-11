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

## Batch 5: hosted restore and deployment — pending

Created `kainara-defense-20261016` under `chimairelp@gmail.com`: project `nameless-dust-38810716`, PostgreSQL 17, Singapore (`aws-ap-southeast-1`). The old blocked project remains intact. Creation is not restoration or deployment. The exact branch, database and endpoint must be obtained and confirmed under README's target rule before restoring the final archive into the new empty database.

Plugin management confirms Neon, Railway and Vercel are installed/enabled. The provider tools needed for connection retrieval and deployments remain unavailable in this chat; installation status does not establish usable deployment access. Hosted restoration, actual deployed-secret verification, release promotion, public-URL smoke and actual quota readings remain outstanding. No demo branch update or live database switch has occurred.

Development release `63ac381887cce3f4aba25a8570462df173d46234` is pushed. A separate clean release checkout retains this committed source without the shared checkout's unrelated edits. Both production builds and backend script typechecking passed there, with all 62 frontend pages generated; dependency installation used the committed lockfiles. The shared checkout's final frontend production build/ESLint also passed.

### Release sequence and rollback

1. Confirm the exact new empty target; verify the archive checksum before restoring. Validate all migration names/checksums and retained counts, foreign keys and document decryption against the final manifest.
2. Privately compare the retained document key with the actual deployed key. Preserve deployed signing, refresh and scheduler secrets and provider configuration. Never replace them with generated setup-file values. Enable the compatible clarification configuration with its required schema present.
3. Record current deployment IDs, commit hashes and target configuration privately. Deploy the full compatible backend update before publishing its frontend. Verify readiness and account metadata first, then promote/deploy the tested frontend and verify the existing public URL.
4. Run one bounded live smoke across member, RND and admin. Record actual deployed commits, usage timestamp, omissions and result here. Keep further load testing local.
5. If release smoke fails, stop new live writes, retain the failure evidence and use the verified local fallback while restoring the last compatible deployment/configuration pair. Do not overwrite post-switch member activity with the older archive. The blocked old Neon target alone is not a working fallback.

### Usage budget until October 16

Check Neon transfer after each bounded rehearsal and daily through October 16. Record the used/allowed amount and timestamp; a missing reading is unknown, not zero. Track compute/storage separately from transfer.

A daily thread follow-up, **Defense database budget**, is active through October 16 and starts usage checks once the live switch is recorded. It stays quiet on unchanged/non-actionable states. Actual provider access/readings still need verification. At the measured rate, ten continuously active sessions for five days would retrieve approximately 5.3 GB; close rehearsal tabs afterward and do not treat the hourly gate as permission for continuous week-long load.

| Transfer usage | Action |
| --- | --- |
| 50% | Warn; inspect unexpected read/generation traffic and keep rehearsals local. |
| 70% | Stop nonessential live rehearsals and repeated generation; preserve capacity for the defense. |
| 85% | Use the verified local fallback for the defense workload. |

Before the presentation, start Docker/local database and API/frontend using `docs/LOCAL_DEVELOPMENT_AND_DEFENSE.md`, verify readiness and one ordinary role login, and keep the verified archives/manifests available. Local recovery preserves data, but network-dependent AI, email, OAuth and payment services still depend on their providers. These thresholds provide a reserve for the expected workload, not a guarantee that Free quotas cannot be exhausted.
