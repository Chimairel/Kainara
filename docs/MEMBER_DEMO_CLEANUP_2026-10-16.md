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

Promotion and final provider identity are recorded below when confirmed. Until then, do not claim local/demo rollout parity is complete.
