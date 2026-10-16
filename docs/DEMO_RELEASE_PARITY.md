# Required localhost/demo release parity

The owner requires locally completed features and intentional reference-data changes to work on demo after an authorized promotion. Localhost uses an isolated database to preserve Neon transfer capacity. Feature parity is a release responsibility across code, schema, configuration and data; Git does not synchronize the databases or environment variables.

## Before each promotion

- Identify the tested source commit and the actual current Railway and Vercel deployment commits. Compare the changes against the deployed version, including backend/frontend contracts, migrations, scripts, assets and feature flags.
- Read applied migration names and checksums from each confirmed database. Compare these with the checked-in migration files; a matching count alone is insufficient. List pending migrations explicitly. Diagnose checksum drift or failed migrations before proceeding.
- Compare only the relevant non-secret behavior settings privately. Record intended feature activations, membership/credit limits and provider budgets. Keep database URLs, ports, CORS/origins, transport/security, push delivery, signing/encryption keys and other environment-specific settings scoped to their environments.
- List intentional catalogue/reference-data changes separately from schema migrations. Review the source, affected IDs/counts, idempotency and preservation checks of their import/backfill scripts. Empty migration tables or a successful build do not prove data promotion.
- Record the previous compatible deployment pair, any necessary backup and a code rollback plan. Minimize full hosted downloads under the defense transfer budget; local rehearsal backups use local PostgreSQL. Preserve existing document/signing/provider secrets and post-release member activity.

Useful local inspections include `git diff --name-only origin/demo..HEAD`, `git log`, the existing local database status helper and a bounded read of `_prisma_migrations`. Use connected provider deployment/configuration tools for actual hosted state. Never publish secret environment exports.

## Complete the authorized rollout

1. Verify the hosted target: as of the approved October 16 cutover, Neon project `late-grass-59329912`, branch `br-floral-paper-aoa7pln0`, database `kainara_demo`. The previous `nameless-dust-38810716` database is preserved and is no longer the live target. Reconfirm actual host bindings before each operation; see [cutover evidence](DEMO_DATABASE_CUTOVER_2026-10-16.md).
2. Rehearse reviewed additive migrations and any data updates locally first. Apply needed hosted migrations with `prisma migrate deploy` in the compatibility order defined by the feature. Never use `db push`, resets, automatic test seeds or local database restores for parity.
3. Ensure all API/worker readers support new enum/schema values. Deploy compatible backend code, check readiness, deploy/promote the matching frontend and activate required features in the order established by their rollout contract. Both hosts must be verified; a branch push or one successful host is insufficient.
4. Apply intentional reference-data changes through the reviewed bounded idempotent process and verify affected identities/counts or content signatures. Preserve live account identities, passwords, member records, decisions and immutable attribution. QA fixture changes are not automatically promoted.
5. Run a bounded authenticated check of each changed feature on the public application. Check the same behavior verified locally, including failed/disabled states that materially affect the flow. Prefer free/preflight/cancel checks when verifying consent; obtain the existing required consent before a provider-consuming action. Repeated regressions and load tests remain local.

## Completion record

Record the following in the release/engineering record before reporting completion:

| Check | Required evidence |
| --- | --- |
| Source | Tested commit and actual ready frontend/API deployment IDs/commits |
| Schema | Required migration names/checksums applied, failed/pending state resolved |
| Configuration | Changed features enabled with intended non-secret limits; deliberate differences listed |
| Data | Required reference-data updates applied and scoped verification passed, or explicitly not applicable |
| Behavior | Actual local and live results for the changed flows, with provider simulation distinguished from real calls |
| Recovery | Previous compatible release and preservation/rollback boundaries |

If one requirement is missing, the release is **incomplete**. State the missing item and continue the already authorized work. Request input only when the release needs genuinely missing information, a new external permission or an action beyond the authorized scope.

## Completed example: member assistant and final demo database

On October 16, tested tree `c8675a14` was promoted as `demo` release `7b96e8b5`; both actual hosts are ready on that release. The final database was restored from a fresh, write-frozen live backup, independently of staging, and has the assistant and water-residual migrations: 112 ledger rows, 111 successful and one historical rolled-back entry. Nara is enabled with weekly Free/Lifestyle/Health credits **5/15/30**, with conservative provider budgets and preserved live secrets. Public authenticated free-reply, consent, role and water-history checks passed without spending credits or admitting Gemini work.

See [actual IDs, migration/data checks and verification limits](DEMO_DATABASE_CUTOVER_2026-10-16.md), including the lack of fresh browser/OAuth/provider verification. Future assistant promotions must preserve the [rollout contract](MEMBER_ASSISTANT.md#rollout). A code push alone still does not complete a release.

## Enforcement boundary

This is a mandatory working-guide/release gate. The existing GitHub CI verifies source tests/builds; it does not automatically compare private databases, configure host variables or copy local data. No automatic database synchronization or new unattended migration/deployment job is introduced by this policy. Any future automation must preserve the same explicit targets, permissions, evidence and data boundaries.
