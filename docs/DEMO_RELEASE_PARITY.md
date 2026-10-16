# Required localhost/demo release parity

The owner requires locally completed features and intentional reference-data changes to work on demo after an authorized promotion. Localhost uses an isolated database to preserve Neon transfer capacity. Feature parity is a release responsibility across code, schema, configuration and data; Git does not synchronize the databases or environment variables.

## Required order and hosted testing boundary

Owner instruction, October 16: **local changes → local verification → online staging verification → demo promotion**. `development` holds completed local work; `codex/staging` is the online testing branch; `demo` is the presentation/live branch. A feature branch is temporary. Keep the same application tree through the staging-to-demo promotion and preserve separate environment-owned records/secrets.

Run hosted functional tests on staging only. Do not send test requests, login attempts, mutations, smoke/load tests or test SQL reads to demo live. Verify the final promotion using deployment SHA/state and relevant configuration metadata plus retained migration receipts. This supersedes earlier requirements for authenticated production smoke checks. An authorized migration/backup is a separately scoped release operation, not permission for ongoing live tests.

Use `npm run release:parity -- --source HEAD --target origin/demo` after fetching relevant refs. Add `--assert` for committed application equality, or `--assert-checkout` to also reject local dirty/untracked application files. The command makes no network/database requests. It covers source/schema/reference files/assets/dependencies, not provider deployment identity, secrets or database records. Ahead-of-demo work must remain explicitly unreleased until staging verification and authorized promotion finish.

## Before each promotion

- Identify the tested source commit and the actual current Railway and Vercel deployment commits. Compare the changes against the deployed version, including backend/frontend contracts, migrations, scripts, assets and feature flags.
- Read local/staging migration names and checksums and compare them with checked-in files and retained live release receipts. A matching count alone is insufficient. List pending migrations explicitly. Diagnose checksum drift or failed migrations before proceeding; do not perform new demo test SQL reads under the owner's staging-only testing boundary.
- Compare only the relevant non-secret behavior settings privately. Record intended feature activations, membership/credit limits and provider budgets. Keep database URLs, ports, CORS/origins, transport/security, push delivery, signing/encryption keys and other environment-specific settings scoped to their environments.
- List intentional catalogue/reference-data changes separately from schema migrations. Review the source, affected IDs/counts, idempotency and preservation checks of their import/backfill scripts. Empty migration tables or a successful build do not prove data promotion.
- Record the previous compatible deployment pair, any necessary backup and a code rollback plan. Minimize full hosted downloads under the defense transfer budget; local rehearsal backups use local PostgreSQL. Preserve existing document/signing/provider secrets and post-release member activity.

Useful local inspections include `git diff --name-only origin/demo..HEAD`, `git log`, the existing local database status helper and a bounded read of `_prisma_migrations`. Use connected provider deployment/configuration tools for actual hosted state. Never publish secret environment exports.

## Complete the authorized rollout

1. Verify the hosted target: as of the approved October 16 cutover, Neon project `late-grass-59329912`, branch `br-floral-paper-aoa7pln0`, database `kainara_demo`. The previous `nameless-dust-38810716` database is preserved and is no longer the live target. Reconfirm actual host bindings before each operation; see [cutover evidence](DEMO_DATABASE_CUTOVER_2026-10-16.md).
2. Rehearse reviewed additive migrations and any data updates locally first. Apply needed hosted migrations with `prisma migrate deploy` in the compatibility order defined by the feature. Never use `db push`, resets, automatic test seeds or local database restores for parity.
3. Ensure all API/worker readers support new enum/schema values. Deploy compatible backend code, check readiness, deploy/promote the matching frontend and activate required features in the order established by their rollout contract. Both hosts must be verified; a branch push or one successful host is insufficient.
4. Apply intentional reference-data changes through the reviewed bounded idempotent process and verify affected identities/counts or content signatures. Preserve live account identities, passwords, member records, decisions and immutable attribution. QA fixture changes are not automatically promoted.
5. Run authenticated changed-feature checks through the online staging preview, including material failed/disabled states. Prefer free/preflight/cancel checks when verifying consent; provider-consuming actions require existing consent. Verify the demo hosts serve the exact tested application tree using metadata only. Repeated regression/load/provider tests remain local or explicitly bounded staging work.

## Completion record

Record the following in the release/engineering record before reporting completion:

| Check | Required evidence |
| --- | --- |
| Source | Tested commit and actual ready frontend/API deployment IDs/commits |
| Schema | Required migration names/checksums applied, failed/pending state resolved |
| Configuration | Changed features enabled with intended non-secret limits; deliberate differences listed |
| Data | Required reference-data updates applied and scoped verification passed, or explicitly not applicable |
| Behavior | Actual local and online-staging results; no demo functional tests; provider simulation distinguished from real calls |
| Recovery | Previous compatible release and preservation/rollback boundaries |

If one requirement is missing, the release is **incomplete**. State the missing item and continue the already authorized work. Request input only when the release needs genuinely missing information, a new external permission or an action beyond the authorized scope.

## Completed example: member assistant and final demo database

On October 16, tested tree `c8675a14` was promoted as `demo` release `7b96e8b5`; both actual hosts are ready on that release. The final database was restored from a fresh, write-frozen live backup, independently of staging, and has the assistant and water-residual migrations: 112 ledger rows, 111 successful and one historical rolled-back entry. Nara is enabled with weekly Free/Lifestyle/Health credits **5/15/30**, with conservative provider budgets and preserved live secrets. Public authenticated free-reply, consent, role and water-history checks passed without spending credits or admitting Gemini work.

See [actual IDs, migration/data checks and verification limits](DEMO_DATABASE_CUTOVER_2026-10-16.md), including the lack of fresh browser/OAuth/provider verification. Future assistant promotions must preserve the [rollout contract](MEMBER_ASSISTANT.md#rollout). A code push alone still does not complete a release.

## Enforcement boundary

This is a mandatory working-guide/release gate. The existing GitHub CI verifies source tests/builds; it does not automatically compare private databases, configure host variables or copy local data. No automatic database synchronization or new unattended migration/deployment job is introduced by this policy. Any future automation must preserve the same explicit targets, permissions, evidence and data boundaries.
