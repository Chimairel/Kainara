# Recorded recipe visibility and batch review — October 16, 2026

## Scope and reason

The owner reports approximately 2,000 visible member recipes without recorded reviewer attribution and authorizes correcting visibility and adding batch review, then publishing through staging to demo. The cloned Windows development checkout should obtain the same changes through Git. This is not authorization to fabricate reviews or overwrite existing reviewer history.

The unrestricted catalogue previously admitted Panlasang Pinoy rows with `AVAILABLE` source status, independent of an RND decision. Published source provenance and general-wellness planning were intentionally distinct from condition/allergy certification. The member catalogue now requires a `VERIFIED` raw-recipe decision with recorded reviewer and date for the exact source content signature. Counts, page clamps, searches and ingredient-exclusion scans apply that predicate before paging. The compatible-library endpoint also requires recorded base admission, including restricted profiles. Existing restriction, flag and patient-clearance predicates remain mandatory.

This release changes browsing admission. It does not retroactively cancel scheduled meals or replace the existing general-wellness source planning policy. A source-base review is not review of an individually composed plate, rice portion or a member's condition/allergy suitability. These distinctions must remain explicit. An empty/smaller catalogue is expected when no matching reviews exist; do not restore entries with invented reviewer IDs.

## Batch workflow

The tool exports Panlasang source recipes in pages of 50 and submits reviewed selections in groups of five. It reuses the existing role/credential middleware, single-active-claim capacity, serializable review transaction and audit decision path. Server requests accept at most 25 distinct recipes. Every selected recipe needs explicit confirmation, a rationale of 10–1,000 characters, its exported revision and an evidence hash. Completeness checks reject missing preparation, invalid nutrition and ingredients lacking positive quantities/units. Checks establish data completeness only, not clinical validation. Incomplete recipes need correction before review.

The evidence hash binds the exported name, preparation, serving nutrition, ingredients, source and revision. Recheck inside the transaction prevents a source changing after review. An opaque environment key also binds the report to the backend's database target and signing configuration: switching Neon databases behind the same localhost URL requires a new export. It reveals no connection string/password. Active competing claims and flagged sources cannot be bypassed. Existing verified rows are skipped without changing their reviewer; successful decisions receive the authenticated RND's profile, never a supplied email or reviewer ID. Exports create no claims/decisions. Individual results and receipts make partial failures visible; requests are not automatically retried. Existing patient approvals and review events are not copied between environments. No schema migration is required.

Member meal responses resolve recorded source reviewer credentials in two bounded queries for the returned source identities. Missing/stale records remain unattributed. The display uses recipe scope, never a newly inferred member approval. It does not rewrite historical decision snapshots.

### Windows instructions (from the repository's backend folder)

Start the backend with the intended LOCAL or STAGING database first. Use an eligible RND account; the wrapper defaults the login name to `nutritionist@gmail.com` and prompts privately for its password. It does not save that password. Do not use the other account's credentials or copy a staging review file into a live submission.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/recipe-batch-review.ps1 -Mode export
```

This writes `.local/recipe-review.json`. Review each selected recipe's evidence and source. For reviewed recipes only, set `reviewed` to `true` and add the review rationale. Set the envelope's `confirmedReview` to `true` after completing that review. Do not change IDs, revisions or evidence hashes. Exclude entries with reported `issues`; fix the underlying evidence and export again. Unreviewed items remain `false` and are not submitted.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/recipe-batch-review.ps1 -Mode submit -ConfirmReviewed
```

The receipt file is `.local/recipe-review.json.receipts.json`. Existing successful decisions remain if a later item fails. Export mode refuses to overwrite an existing report; use `-File .local/recipe-review-next.json` for a new report. If the access token expires during a long run, run the wrapper again; it logs in afresh and preserves already verified attribution. Provider/network failures are reported, not blindly retried.

For a different API use `-Api https://YOUR-STAGING-API/api` and a distinct report file. The exported API binding must match at submission. Default loopback is appropriate when the new laptop's backend points to the staging Neon database. HTTPS is required outside loopback. Passwords/tokens never belong in Git, screenshots, chat or command arguments. RND endpoints: `GET /api/nutritionist/recipe-batch-review/preview?cursor=...`, `POST .../confirm`.

### Other laptop update

After the completed commit is pushed to development, stop its backend and run in the cloned repository:

```powershell
git status --short
git pull --ff-only origin development
npm.cmd --prefix backend run dev
```

Review/commit any local CODE edits before pulling; keep private environment files. This change adds no dependency or migration, so a pull plus backend restart is sufficient for an already installed development checkout. Production `npm start` users must first run `npm.cmd --prefix backend run build`. The frontend source and its environment remain unchanged.

## Verification and rollout

Evidence is updated below as checks and staging-first promotion complete. Demo testing remains prohibited; use provider metadata after promotion. The owner still needs to perform real reviews. No bulk approvals have been applied to local, staging or demo catalogue data by preparing this change.

- Initial candidate `f4fdee00` passes build, test TypeScript and all 1,165 backend tests (zero failures, one existing TODO); scoped lint has no errors and one pre-existing unused-import warning. Actual local disposable PostgreSQL/HTTP acceptance passes six grouped cross-role/claim/decision/visibility checks. Windows wrapper parses successfully. The actual read-only local CLI export covers **1,958 source recipes**, with **1,510** flagged for missing/invalid preparation, ingredient quantities/units or serving nutrition and zero recorded raw-source approvals. These checks do not establish that every flagged recipe is unsafe; they identify missing structured evidence for this batch path.
- Restore authorized Vercel access, update only the `codex/staging` preview API origin and deploy preview `dpl_4zV1WU76iGPCpW3pR5ETMrpPjPb8` READY. Eight direct/public-tunnel staging requests pass (role rejection, eligible-RND export and catalogue reads), followed by protected Vercel home/proxy checks. Owner-scoped member catalogue total is zero; no review was submitted. One initial private probe incorrectly supplied an unsupported query parameter; corrected requests pass without an application change. Staging requests remain slow: the protected catalogue read took 48.2 seconds including CLI/proxy overhead; do not claim a latency improvement.
- Initial promotion `f4fdee00`: Railway `a5a1e2f0-d361-4bba-952d-63f000daf36b` SUCCESS and Vercel `dpl_5b6qycyGQNjzCTdTJ2UGZYRfciV4` READY report that SHA. Non-platform Railway settings remain unchanged and database binding stays `kainara_demo`. Demo verification uses provider metadata only, with zero demo functional requests. The final database-target binding follow-up must pass the same staging-first sequence before release completion.
