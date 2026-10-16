# Member cleanup and local/demo alignment — October 16, 2026

## Authorized scope

The owner requested local/demo code alignment and removal of existing data except Admin/Nutritionist accounts. After clarification, the owner selected **delete member accounts and activity; keep the meal library and nutrition reference data**, preserving all Admin/Nutritionist accounts. The owner separately confirmed `nutritionist@gmail.com` as the account to rename to **Chimairel Pacaldo**, with the supplied JPEG as its photo. Other staff accounts, credentials, PRC fields, verification and review eligibility were not changed.

This is an explicitly authorized data maintenance operation. It does not supersede the owner's restriction against functional/test SQL traffic on demo. Production SQL was limited to target/account inventory, the backed-up cleanup transaction and its integrity verification. Functional profile checks ran locally, not against demo.

## Backups and execution

- Verified the actual Railway database binding before using the current final demo database: `kainara_demo` in project `late-grass-59329912`. Local remained `kainara_local_development` on loopback port 55432. Staging was not cleared or copied into either database.
- Created separate full custom-format PostgreSQL backups, with successful dump completion, table-of-contents verification and SHA-256 receipts. Local: **14,285,963 bytes**, SHA-256 `fed8e6e968c7602bd56583fac390e707356399c5ef2b4859f0507b5dd95a578d`. Demo: **15,347,787 bytes**, SHA-256 `82cebd3ba98c9dd4b20e72933aa966c8f6b219a9f4dfa74bf58199c24a1bdc47`. Backups contain private historical data; they remain under the excluded `backend/.local/environment-isolation-20261016/member-cleanup/` directory and are not committed. No restore verification is claimed.
- Rehearsed the complete cleanup in one local serializable transaction, verifying its results before intentional rollback. Applied the same reviewed operation locally and then to demo, each atomically. Locked member creation/profile changes during the operation, scoped deletion to `USER`, removed restrictive case/evidence links before account cascades, and removed member-related observed submissions/audit events. Aborted if a member document unexpectedly supported a shared clearance.
- Committed at approximately **16:51 local** and **16:52 demo**, UTC+8: **30 local member accounts** and **14 demo member accounts**, respectively, with their linked plans, logs, water entries, reports, membership records, sessions, notifications and clinical cases. Admin/Nutritionist credentials, other staff records, catalogue/reference data and unassociated staff/operational records remained. All staff accounts were preserved, including existing staff test accounts; this was not a reduction to exactly two staff logins.
- Before committing each transaction, compared row counts and full-row digests for **26 protected reference/configuration/migration tables**. All matched. Staff user/profile digests also matched after excluding only the intended name/image/headshot/timestamp edits. User credentials and PRC/verification fields were unchanged.

## Nutritionist photo and identity

Uploaded the supplied original 1024×1024 JPEG (157,860 bytes) to the existing application's Cloudinary account. Updated the confirmed Nutritionist user's display name and avatar URL, and stored the same original image as its profile headshot. Existing OAuth logic preserves a deliberately selected non-Google avatar. No generated portrait, image modification, new hosting dependency or public repository image was used. Immutable historical review snapshots were not rewritten to impersonate a new reviewer.

Local authenticated account/profile GET checks returned 200 with the expected new name and headshot. No demo test login or functional request was sent.

## Release candidate and checks

The runtime application candidate remains the staging-tested `7efa6c14` tree, which includes the dashboard query correction. Local/direct-staging/public-tunnel API checks are retained in the preceding performance record; the frontend is unchanged from the prior deployed release. The usual Vercel staging alias still needs the new tunnel configuration because its management credentials returned 403. This transport limitation must not be represented as a successful alias/proxy test.

GitHub's legitimate deployment-status integration can still report Vercel deployment identity/status, independently of the unavailable direct Vercel credentials. Staging Preview for `7efa6c14` reported success there. Use normal Git promotion and provider metadata; do not introduce demo app tests.

Release review also found five CI-only failures caused by mocked AI fixtures setting a synthetic provider key after transitive imports captured configuration. Import a test-only synthetic-key fixture before those services in the two affected suites. This does not alter runtime AI configuration or call a real provider. Full local backend tests: **1,159 pass, zero fail, one existing TODO**; ten focused mocked AI regressions pass. Test-only changes and this maintenance record do not alter the staged runtime application tree. The repository-wide formatting gate has existing debt (436 reported files, including the historical prototype); it is not made green by reformatting unrelated owner work.

## Final application parity evidence

Candidate **`7f69baf1f08cff3d185bdcb09e2688ecf3523fae`** contains the unchanged staging-tested application tree plus the test-only fixture correction and documentation. A clean archive without local `.env` or a real provider key passes the full backend suite (1,159 pass, zero failures, one TODO) and compilation. The live checkout's unrelated dirty assets/header are excluded. Local API/frontend now run from this clean archive; 1,655 tracked frontend/backend/schema files match Git object hashes with zero mismatches. The private startup helper is pinned to this release and its already-running path passes. Local profile checks pass after restart.

The candidate was pushed to development and staging before demo. Its archived staging API passed public-tunnel current-meal/water GETs and anonymous rejection, with current meals taking 7,181 ms in that sample; no credit/provider work. Vercel's GitHub integration reports Preview success for the same SHA (GitHub deployment `7115165220`). The ordinary staging alias/proxy remains unverified with its obsolete tunnel setting; a successful preview build is not a successful proxy test.

At **17:08 UTC+8**, Railway deployment **`0e5d60e6-4baf-4282-a7f4-2200b4522edb`** reports SUCCESS on `7f69baf1`. Non-platform settings compare unchanged with the saved pre-cleanup configuration, including `kainara_demo` and all credentials. The demo Git ref points to this candidate. No schema migration or catalogue import occurred.

Vercel's latest successful **Production** record in GitHub remains **`7111275940` / `8d4bd49f`**; the new Git event produced a Preview, so a new production frontend deployment was **not** observed. However, the complete committed `frontend` tree is **exactly identical** between `8d4bd49f` and `7f69baf1` (Git tree `fb6d83e85f1d702a7a519b7961b2e789a3f0d6cb`). The release changes only backend runtime files; the existing production frontend already contains the matching frontend code. Accordingly, application source parity is verified by component, without claiming equal provider commit labels or a newly deployed Vercel production build. Direct Vercel management/alias inspection remains unavailable under the 403 credentials.

The Git parity assertion finds no committed application difference between the shared checkout and demo; the disclosed dirty shared files are preserved outside the served archive. All production verification in this release uses provider/Git metadata and the specifically authorized cleanup receipts. No demo app test request or test login was sent. Full repository CI is not claimed green: existing formatting debt remains, and browser workflow completion is not required as evidence for this unchanged frontend.
