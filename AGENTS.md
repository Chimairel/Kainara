# NutriMind agent working guide

This file contains current repository working rules. The former 700-line agent guide, original prompts, and old design decisions are preserved in [Project evolution](docs/history/PROJECT_EVOLUTION.md#old-agents-md). They explain the project's history and must not override executable code or current decisions.

## Sources of truth

- Read [README.md](README.md) for setup and commands.
- Read [docs/NUTRIMIND_ENGINEERING_RECORD.md](docs/NUTRIMIND_ENGINEERING_RECORD.md) for accepted architecture decisions, implementation evidence, known limitations, and change IDs. It is a chronological record: newer entries supersede older observations.
- Inspect the code and tests for the behavior being changed. Do not infer current behavior from the historical archive.
- Preserve the separate Next.js frontend and Express/Prisma backend unless the owner explicitly requests an architecture change.

## Shared checkout and attribution

The owner requires Codex and Antigravity to implement and verify ongoing work in `C:\Users\chima\Desktop\Nutrimind`. Use this shared checkout even if the chat starts in a different worktree. Do not create or use another worktree for implementation unless the owner explicitly requests it. This does not make concurrent edits to the same file safe.

1. Before editing, inspect `git status --short` and the current commit. Agree on task or file ownership when both tools are active. Only one tool edits a given file at a time.
2. Commit a finished, reviewable unit before handing its files to the other tool. Stage only files you worked on and inspect the staged diff; do not sweep another tool's uncommitted edits into your commit.
3. Use a concise commit subject and a body trailer of `Assisted-by: Codex` or `Assisted-by: Antigravity`. The trailer identifies the tool responsible for the commit, not a clinical reviewer.
4. Push completed commits to `origin/development` after confirming the branch is current. Do not pull, reset, stash, or switch branches over someone else's uncommitted work.
5. Record significant architecture, clinical-safety, schema, data, or cross-role decisions and their verification in the engineering record using its existing change IDs. Routine edits need a clear commit and relevant checks.
6. For simultaneous work on overlapping files, coordinate ownership and finish one tool's changes before the other edits them. Use separate branches or worktrees only when the owner explicitly requests them, then review integration explicitly.

## Required localhost/demo release parity

The owner requires feature parity after every authorized demo promotion. Follow [Demo release parity](docs/DEMO_RELEASE_PARITY.md). A successful Git push alone does not complete a release.

### Required release order — owner instruction, October 16, 2026

1. Start changes in the shared local checkout. Keep `origin/development` current with completed, reviewed local work; a feature branch must not become an indefinitely separate main baseline.
2. Test locally against loopback PostgreSQL first. Then promote a pinned clean candidate to `codex/staging`, the online testing preview and its separate staging database/API. Run hosted functional tests only there.
3. Promote that exact staging-tested application tree to `demo` only within the owner's authorized release scope. Keep production on branch `demo`; preserve environment secrets and member records. Do not bundle unrelated dirty checkout edits or new code after staging validation.
4. **Do not run functional/smoke/load tests, test logins, test member actions or test SQL reads against demo live.** The owner explicitly restricted hosted testing to staging to conserve Neon transfer. Verify demo promotion using hosting deployment identity/state and configuration metadata, and retained migration receipts. Ask only if a genuinely necessary production data operation exceeds existing authorization.
5. Run `npm run release:parity -- --source HEAD --target origin/demo` for a read-only code comparison. `--assert` fails on committed application differences; `--assert-checkout` additionally rejects dirty/untracked application files. Fetch relevant refs first and verify actual provider deployment SHAs separately. The script does not prove runtime, secret/configuration or database-data parity.
6. For panelist code walkthroughs identify the actual demo release first. An unreleased local candidate may be intentionally ahead during development; disclose it and show the pinned released code when explaining live behavior. Never claim a dirty local checkout is byte-identical to live. Preserve other tools' unfinished work rather than resetting/stashing/switching over it.

1. Before promotion, compare the intended tested commit with the currently deployed frontend/API, both databases' applied migration names/checksums, and feature flags/behavior settings needed by the changed features. Record deliberate environment-specific differences and all pending rollout work. Normal localhost uses the isolated local database; preserve that isolation for testing.
2. Include reviewed additive migrations, required feature activation/configuration and intentional catalogue/reference-data updates in the same authorized release scope. Use the confirmed hosted project/branch, preserve existing secrets, apply changes in a compatible order, and wait for both hosts to become ready. New features must not silently stay disabled on demo after being advertised as released.
3. Promote intentional data changes using reviewed, bounded, idempotent migrations/imports with explicit targets and verification. Local test accounts, member activity, clinical decisions and audit history remain environment-owned. Never restore a local database over live to obtain parity or copy local credentials/secrets as configuration synchronization.
4. After deployment, compare actual deployment commits and relevant configuration metadata with the exact staging-tested candidate and retained migration evidence. Run functional checks on staging only, per the owner's release-order instruction above. Record differences and verification limits. Mark a release incomplete if a required migration, setting, data update, worker or host is missing; report the specific gap instead of claiming that the push finished the work.
5. These are mandatory agent/release checks, not an automatic database-sync service. Existing CI alone does not verify private database or deployed environment parity. Run repeated regression/provider/load work on the isolated local target; keep hosted checks bounded under the defense transfer budget.

## UI reuse

Before adding workspace markup, consult [frontend/src/components/README.md](frontend/src/components/README.md). Reuse the shared card, split pane, dropdown, tabs, meal presentations, library grid, pagination and password field. Keep role-specific authorization and eligibility in existing handlers and services.

## Change safety

- Read the target files and immediate dependencies before editing. Keep changes focused on the requested behavior and preserve existing UI design unless asked to change it.
- Do not insert placeholder data, fabricated clinical values, or dummy production behavior. Keep HTTP handling in routes/controllers and core database or integration logic in services where the current module supports that separation. Add dependencies only with the owner's approval.
- Never commit secrets, tokens, patient data, or local environment files. Use disposable fixtures for tests, and verify the database target before data-changing commands.
- Treat meal eligibility, allergies, conditions, approval reuse, claim locks, private clinical documents, and authorization as safety-sensitive. Do not weaken gates to make a UI or test pass. Preserve audit and access records.
- Make schema changes through reviewed additive Prisma migrations. Do not run `db push`, reset, seed, or destructive migration commands against the shared development database without explicit authorization.
- Run tests and static checks relevant to the changed code, including backend TypeScript checking and the frontend build when those packages change. For cross-role or clinical behavior, test the affected user, nutritionist, and admin journeys with stated limits. Do not claim clinical validation from automated tests.
- Check documentation links and repository hygiene when moving files. Preserve historical evidence instead of silently discarding it.
