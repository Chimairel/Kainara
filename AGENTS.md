# NutriMind agent working guide

This file contains current repository working rules. The former 700-line agent guide, original prompts, and old design decisions are preserved in [Project evolution](docs/history/PROJECT_EVOLUTION.md#old-agents-md). They explain the project's history and must not override executable code or current decisions.

## Sources of truth

- Read [README.md](README.md) for setup and commands.
- Read [docs/NUTRIMIND_ENGINEERING_RECORD.md](docs/NUTRIMIND_ENGINEERING_RECORD.md) for accepted architecture decisions, implementation evidence, known limitations, and change IDs. It is a chronological record: newer entries supersede older observations.
- Inspect the code and tests for the behavior being changed. Do not infer current behavior from the historical archive.
- Preserve the separate Next.js frontend and Express/Prisma backend unless the owner explicitly requests an architecture change.

## Shared checkout and attribution

Codex and Antigravity use `C:\Users\chima\Desktop\Nutrimind` as the shared working copy when the owner wants edits visible to both immediately. This does not make concurrent edits to the same file safe.

1. Before editing, inspect `git status --short` and the current commit. Agree on task or file ownership when both tools are active. Only one tool edits a given file at a time.
2. Commit a finished, reviewable unit before handing its files to the other tool. Stage only files you worked on and inspect the staged diff; do not sweep another tool's uncommitted edits into your commit.
3. Use a concise commit subject and a body trailer of `Assisted-by: Codex` or `Assisted-by: Antigravity`. The trailer identifies the tool responsible for the commit, not a clinical reviewer.
4. Push completed commits to `origin/development` after confirming the branch is current. Do not pull, reset, stash, or switch branches over someone else's uncommitted work.
5. Record significant architecture, clinical-safety, schema, data, or cross-role decisions and their verification in the engineering record using its existing change IDs. Routine edits need a clear commit and relevant checks.
6. For simultaneous work on overlapping files, use separate branches or worktrees and review integration explicitly.

## Change safety

- Read the target files and immediate dependencies before editing. Keep changes focused on the requested behavior and preserve existing UI design unless asked to change it.
- Do not insert placeholder data, fabricated clinical values, or dummy production behavior. Keep HTTP handling in routes/controllers and core database or integration logic in services where the current module supports that separation. Add dependencies only with the owner's approval.
- Never commit secrets, tokens, patient data, or local environment files. Use disposable fixtures for tests, and verify the database target before data-changing commands.
- Treat meal eligibility, allergies, conditions, approval reuse, claim locks, private clinical documents, and authorization as safety-sensitive. Do not weaken gates to make a UI or test pass. Preserve audit and access records.
- Make schema changes through reviewed additive Prisma migrations. Do not run `db push`, reset, seed, or destructive migration commands against the shared development database without explicit authorization.
- Run tests and static checks relevant to the changed code, including backend TypeScript checking and the frontend build when those packages change. For cross-role or clinical behavior, test the affected user, nutritionist, and admin journeys with stated limits. Do not claim clinical validation from automated tests.
- Check documentation links and repository hygiene when moving files. Preserve historical evidence instead of silently discarding it.
