# October 16 live recovery

## Recovery source and omissions

The owner approved preparing a new live database from the verified October 10, 14:00 Philippine-time backup, current migrations and verified local additions. The old Neon project and original archives are retained. Hosted activity after that backup is unavailable while the original project is blocked; code and account specifications cannot reconstruct clinical answers, approvals or real member activity.

## Batch 1: isolated recovery copy — integration tested

`backend/scripts/prepare-defense-recovery.mjs --apply-local` refuses any source except `kainara_local_development@127.0.0.1:55432`. It captures a full source archive, restores a new task-owned Docker database and changes only that copy. Private connection settings, archives, credentials, account logs and count manifests are under ignored `backend/.local/defense-recovery/`.

The successful rehearsal retained all 39 existing accounts and password hashes, 291 meals, nutrient records, two historical profile reviews, historical decisions/audits and one clinical document. Document decryption and its SHA-256 matched with the retained encryption key. All foreign keys are validated. Thirteen documented synthetic accounts were recreated from their saved profile/credential-state specifications, bringing the copy to 52 accounts. Their new audit events have current timestamps; no old clarification answers or decisions were manufactured.

The recovery copy excludes 2,620 obsolete ENNS consumption rows, disables its source and marks its releases retired. It preserves source/release metadata and activation/audit relationships. The source backup and database retain the rows and immutability triggers. Cleanup temporarily disables the consumption table's user triggers only inside the isolated copy's transaction and restores them before commit.

Private evidence: `backend/.local/defense-recovery/1791696253565/manifest.json`. The prepared export is retained alongside its checksum. Its target is `kainara_defense_recovery@127.0.0.1:50613` and is distinct from normal localhost development.

## Remaining gates

Query projections, catalogue cache invalidation, lightweight review status, retired controls, browser workflows and measured PostgreSQL transfer must pass before promotion. Hosted provisioning/restoration, provider checks and deployment are separate gates; this record does not claim them complete.

Run all repeated acceptance/load rehearsals locally. The approved limit is ten concurrent sessions, 50 MB/hour of steady database read traffic and 25 MB of database reads per 21-meal generation. Measure database-to-API bytes, not browser response size. After release, inspect Neon usage after each rehearsal and daily until October 16: warn at 50%, stop nonessential live rehearsals at 70%, use the verified local fallback at 85%. These thresholds are an operating budget, not a guarantee of unlimited Free usage.
