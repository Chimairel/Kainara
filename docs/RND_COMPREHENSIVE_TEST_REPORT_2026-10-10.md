# RND workflow comprehensive test report

Date: October 10, 2026. Implementation baseline: `0de46bd7`.

## Scope and results

This run covers all five clarification implementation batches, the full backend/frontend unit suites, and regression acceptance for meal review governance, shared queues, swaps, audit and member history. It uses the normal localhost:3000 frontend with synthetic APIs or authenticated disposable backends. It does not activate the workflow in the shared development database.

| Check | Result |
| --- | --- |
| Full backend suite | 872 passed; zero failed; one existing TODO (873 total) |
| Full frontend component suite | 821 passed across 180 files |
| Frontend dependency/security and notification-worker checks | 8 passed |
| Eight PostgreSQL/HTTP suites | 99 scenario-group executions passed; some regression scenarios appear in multiple suites |
| Meal-log audit PostgreSQL/services/HTTP suite | Passed, including the pre-migration historical-data fixture |
| Authenticated Chromium journeys | 6 passed |
| Intercepted-API Chromium presentation/regression checks | 50 passed |
| Backend/frontend lint and production builds | Passed |
| Application/acceptance TypeScript and Prisma validation | Passed |
| Global architecture check | Existing baseline failure: one unchanged module exceeds its line budget by one line |

The authenticated browser journeys cover member Dashboard/Meals/Grocery repair history at 390px and 1440px in light/dark mode; RND claims, exact prior references, fullscreen canvas, local Ctrl-wheel zoom, H/V tools, published questions, late member answers and successor handoff; and an external member profile update forcing a claimed fullscreen meal canvas back to “A clear path to every review” without navigation. Direct access to the withdrawn meal is rejected afterward.

The 50 presentation checks cover admin/RND audit details, quarantine controls and change history, JSON draft imports, admin meal logs/popularity, member attribution, professional access revocation/restoration, missing health details, profile decisions, case withdrawal, onboarding, member privacy/deletion, live notifications and the desktop-only RND queue. Phone/desktop and light/dark checks apply where supported. They use intercepted responses; server authorization is established by the separate HTTP suites.

## Synthetic accounts and isolation

SQL role aggregates across the nine final task databases contained **103 synthetic accounts: 27 members, 66 RNDs and 10 admins**. Additional fixtures were recreated or erased by deletion scenarios; this is the final surviving count, not an assertion that only 103 inserts occurred.

Every target was explicitly restricted to loopback PostgreSQL ports 55488 or 55485, a named local container and an allowlisted database. All 103 migrations applied to each final fixture. The meal-log suite first seeded its historical record before the audit migration, then migrated to the current schema. Existing preview databases were preserved by using two new comprehensive database names on the previously running preview container.

Synthetic signed sessions exercised real backend role, claim, ownership, version and credential checks. Browser API requests were forwarded to the disposable target; the normal shared API was never a mutation destination. Gemini, email and payment providers were disabled. Ignored local fixture files contain synthetic session tokens and are excluded from committed evidence.

## Workflow coverage

| Area | Verified behavior |
| --- | --- |
| Persistent questions | Immutable publication, required answers, late responses after expiry, successor claims, latest-response resolutions, concurrent submissions, stale scope rejection and audited related-case access |
| Profile corrections | No profile write before member acknowledgment; correction requests preserve the original profile; revised proposals survive handoff; acceptance is idempotent and rechecks credentials; changed context blocks stale acceptance |
| Planning gates | Unresolved current questions/proposals and missing details block confirmation/planning; only altered profiles require new acknowledgment; stale approvals and generation are rejected |
| Concurrent reviews | Twenty-one outstanding meal claims are paused/cleared together when context changes; stale decisions cannot commit; one repair cycle publishes under competing requests |
| Shared RND pool | Heart, diabetes, pregnancy and healthy cases are visible to every currently eligible RND regardless of expertise, experience, legacy availability or online status; suspended/expired RNDs remain blocked; retired routing cannot be enabled |
| Meal clarification | A meal reviewer can reopen Profile work through persistent questions without directly editing the profile; old claims/cases retire; late source-week answers remain usable by the next profile claimant |
| Replacement search | Complete-serving nutrient limits, fixed units, zero versus unknown values, side/rice composition, pagination beyond 120 candidates, stale fingerprints and quarantine rechecks |
| Swap and rejection | One atomic pending replacement under concurrent swaps; separate final approval required; signed no-match evidence and rationale; no-suitable-replacement holds certified/raw/AI regeneration and deadline fallbacks |
| Prior references | Exact context only; no approximate age/weight/goal matching; captured context survives original-member changes; anonymous numeric/attribution DTO; changed serving/evidence, challenged decisions and expired reviewers exclude references; no automatic clinical approval |
| Repair history | Ten newly generated meals plus two retained recorded slots; original eaten/skipped nutrition and purchases retained; no duplicate slot generation, pantry credit or overlap with upcoming plans; changed history aborts repair; member deletion removes owned relations |
| Flagging/quarantine | Verified → first flag → pending re-review → independent re-verification → second flag → quarantine; variants/concurrent reports do not inflate incidents; future flags quarantine immediately; corrections invalidate confirmations |
| Release and oversight | Two distinct current eligible independent confirmations and admin release required; premature release blocked; original/corrected nutrition, both flag notes, actors and snapshots visible in related admin audit; approval-specific flags remain separate |
| JSON batches | Templates/export, draft-only import, quantities/mappings, limits, duplicates, atomic failures and retry idempotency; no member or internal clinical data in meal files |
| Meal-log audit | Immutable legacy context, variant identities, corrections, actors, retries, concurrency, rollback, removals, age/plan cohorts, pagination, role access and account erasure |

## Problems found during the run

- An older governance journey still asserted expertise-priority routing. Its expectations now verify the approved shared-pool behavior, including denial to expired/suspended RNDs.
- Older browser tests expected inline profile decisions and the previous expansion label. They now exercise the claim-gated canvas and decision modal, including missing-detail blocking and live closure after case removal.
- The synthetic admin fixture returned an array for the routing-history object and omitted the current accounts response. It now returns the correct DTOs. The access revocation/restoration journey passes without changing application behavior.
- A quarantine locator matched both the current badge and the historical incident status. It now selects the current status explicitly while retaining the timeline assertions.
- Two simultaneous Playwright invocations initially shared the default artifact directory, causing trace teardown failures. Separate output directories and fresh mutable fixtures eliminated the collision; the authenticated six-test rerun passed.

These were test/fixture defects. This testing task did not change application authorization, clinical policy or runtime feature behavior.

## Remaining boundaries

The global architecture guard still fails on unchanged `backend/src/services/clinical-evidence.service.ts`: 901 lines against a 900-line limit. It was already present in the implementation baseline. It is recorded rather than hidden or treated as a successful gate.

The six authenticated browser journeys use signed synthetic sessions rather than interactive login. Additional intercepted-API browser tests establish UI behavior, not real API authorization. Provider delivery, hosted demo deployment, load at production scale and clinical validation are outside this run. Passed suites are concrete evidence for the enumerated scenarios, not proof of every possible input.

Shared development still requires confirmed-target backup/application of the five additive clarification migrations and explicit feature enablement. No shared database write or demo promotion occurred in this task.

Machine-readable counts, fixture targets and verification levels are in [the acceptance evidence](verification/RND_COMPREHENSIVE_ACCEPTANCE_2026-10-10.json). Detailed logs and Playwright artifacts are kept under the ignored local `backend/.local` directory.

## Architecture-check follow-up

The owner subsequently requested fixing the recorded line-budget failure. The unchanged document-metadata projection was extracted into `backend/src/domain/clinical-document-metadata.ts`; `clinical-evidence.service.ts` now has 873 lines using the guard's count. The global architecture check and all 21 entry-point budgets pass. Backend lint/build and the full backend suite pass: 873 passed, zero failed and one existing TODO (874 total), including the new private-document metadata regression check. This refactor made no database or workflow-policy changes. The original run's evidence above remains preserved; engineering-record entry 323 records this follow-up.
