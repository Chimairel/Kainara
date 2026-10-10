# Development clarification rollout — October 10, 2026

## Result

The owner authorized applying the pending clarification migrations, enabling the workflow in shared development and testing weekly preparation. Demo promotion was explicitly excluded.

- Backed up the configured Neon development database to a local PostgreSQL custom archive. No additional Neon database or branch was created.
- Applied the five migrations listed below and enabled `CLINICAL_CLARIFICATIONS_ENABLED=true` in the ignored local backend environment.
- Restarted the normal development API on port 5000; browser checks used the normal frontend on port 3000. Prisma reports all 103 migrations applied.
- Complete catalogue weekly generation and background replacement passed. A live Gemini availability request passed, but actual meal fallback received repeated provider 503 responses. A complete AI-generated week remains **unverified**.

## Backup and migrations

Target: configured development `ep-crimson-poetry…/neondb`.

Local archive: `backend/.local/backups/clarification-rollout-20261010/development-before-rollout.dump`.

- Size: 13,890,335 bytes.
- SHA-256: `f157f0d58423f545d385ca45dc401215e59bab3076d3e402da28c5b73bc3f27b`.
- Archive table of contents and complete payload successfully read with PostgreSQL 17 `pg_restore`. This verifies archive readability; a full restored application test was not performed.
- Backup and credentials remain local and uncommitted.

Applied:

1. `202610100001_clinical_clarifications`
2. `202610100002_clinical_profile_proposals`
3. `202610100003_meal_clarification_reopening`
4. `202610100004_review_references`
5. `202610100005_plan_repair_history`

These additive migrations do not manufacture historical answers, proposals or review references. The default flag remains disabled for environments that have not been explicitly rolled out.

## Normal development checks

Created five marked `rollout1010` accounts: one admin, one RND, one heart-condition member and two unrestricted members. The create-only script preserved existing accounts and passwords. Active synthetic RNDs participate in the shared pool. Clinical decisions recorded here concern only synthetic test cases.

| Check | Evidence |
| --- | --- |
| Ordinary browser sign-in and starter/upcoming generation | Unrestricted member received three Saturday starter slots and a complete 21-slot upcoming week. |
| Current full week | A second unrestricted member with a Friday shopping schedule received 21 distinct slots for October 10–16. Fresh guidance acknowledgment was required before preparation. A concurrent preparation response returned 409 while the original job completed. |
| Progressive background fill | Withdrew six synthetic future slots. The normal worker filled the earlier missing day first: 15 → 18 → 21 active meals. All six cancelled rows remain historical; every date has breakfast, lunch and dinner. |
| Persistent questions | RND published one form through ordinary authenticated HTTP. Retrying the same request returned the existing form. |
| Member response | Submitted through the actual Health details browser UI; no empty-health illustration appeared under the populated form. |
| RND resolution | Read the saved answer and resolved its exact response version. Profile revision stayed unchanged. |
| Generation hold | Unresolved profile work blocked preparation and created no meals for the heart-condition member. Resolving a question does not itself certify the profile. |
| Admin oversight | Related admin audit details exposed the resolved form; sensitive-detail access created an audit record. |

The first partial-plan fixture was an upcoming week after its shopping cutoff. Its pause was expected. Inspection exposed a recovery omission: `SHOPPING_DEADLINE_PASSED` failures were never reconsidered when the week became active. Recovery now includes that failure, while the existing active-cycle, profile, clinical and shopping gates still decide whether it can resume.

During the current-week observation, a source-unavailable attempt failed and a test API restart interrupted a later lease. Only the abandoned synthetic lease was released after its worker process had terminated. The normal worker then completed the remaining day. This is not evidence of uninterrupted completion during a server restart; automatic abandoned-lease recovery retains its existing timeout.

## Live provider boundary

Actual SDK calls used the configured Gemini key and normal capacity controls. A public JSON integration probe initially received `AI_HIGH_DEMAND`, then succeeded on `gemini-3.6-flash`.

To exercise actual meal composition without disabling the shared catalogue, a disposable loopback database held synthetic prerequisites and copied public FNRI food records. Its source candidates were retired, forcing the real background meal fallback. Both observed requests returned Google 503 high demand. No generated meals were published; the job remained `WAITING_FOR_AI` with `AI_CAPACITY_DEFERRED` and a future retry time. No quota or review protection was relaxed. The disposable container was stopped after verification.

The successful availability probe does **not** establish successful meal composition, complete provider-backed weekly generation, provider uptime or clinical validity. Those remain separate from the passing catalogue workflow.

## Regression verification

- Disposable SQL partial-plan acceptance passed: current deadline-paused recovery; future deadline hold; earliest-day progress; preserved cancellations; fresh source evidence; allergy review hold; unique slots; frozen, stale and expired exclusions; concurrent and idempotent recovery; no external provider calls.
- Backend: **895 passed, zero failed, one existing TODO** (896 total), with `CLINICAL_CLARIFICATIONS_ENABLED=false` explicitly set for the suite's disabled-mode baseline. The first run inherited the newly enabled local flag and failed six tests whose mocks/expectations require that disabled baseline. The enabled workflow was checked separately through authenticated development requests and actual browser response submission.
- Backend build and ESLint passed.
- Architecture guard passed, including all 25 composition/controller/service budgets.
- Frontend source was not changed in this rollout. Its preceding full-suite/build evidence remains in [responsibility refactor QA](REFACTOR_RESPONSIBILITIES_QA_2026-10-10.md).

Evidence: [background observations](verification/development-rollout-2026-10-10/background-fill.json), [clarification checks](verification/development-rollout-2026-10-10/clarification-checks.json), [provider outcomes](verification/development-rollout-2026-10-10/provider-checks.json), and browser screenshots in the same directory. All captured accounts and clinical text are synthetic.

No demo promotion occurred. Software verification does not establish exhaustive absence of defects or clinical certification.
