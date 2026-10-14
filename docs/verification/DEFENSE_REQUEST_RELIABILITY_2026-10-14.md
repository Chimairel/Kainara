# Defense request reliability audit — October 14, 2026

## Scope

The owner requested a codebase audit after RND replacement search repeatedly failed during loading. This pass inventoried 1,024 non-test TypeScript/TSX files across backend and frontend: 262 API calls (128 GET, 97 POST, 25 PATCH, 10 PUT, two DELETE), six direct fetch/provider paths and 21 possible database reads inside loops. These are static inventory counts, not 262 separately exercised browser journeys.

The review traced ordinary API requests, explicit deadlines, session recovery, visible polling, shared presentation caches, provider timeouts, database transaction budgets and read loops. Existing mutation guards, clinical admission, approval reuse, claims, version checks and access recording remain authoritative.

## Findings and changes

| Finding | Change |
| --- | --- |
| Regex exceptions missed other RND views and member library/history reads. Query strings could also evade exact route matching. | One tested request policy normalizes paths and supplies bounded 90-second database budgets across member/RND/admin routes. Non-default caller deadlines remain intact. |
| Grocery reads may rebuild a stale list through a 90-second transaction; the former browser budget was only 30 seconds. | Grocery calls allow 120 seconds, including pool and authentication overhead. |
| Provider work, imports and public authentication/support have different budgets. | Provider operations use 120 seconds, large admin imports 180 seconds, login/Google 60 seconds and other authentication/support mutations 90 seconds. Generation status and notifications retain short polling budgets. |
| Navigation can abort a request during the reconnect delay. | Cancelled reads do not retry or initiate refresh; a second abort check covers the delay. Mutations still do not replay after uncertain transport/server failures. |
| Grocery pricing issued food and mapping queries for each ingredient. | One food identity lookup and one mapping/evidence lookup per list. A 40-item fixture verifies constant query count, purchased quantities, skipped pantry/checked/zero items and ambiguous identities. No missing price becomes zero. |
| Approval rechecks dereferenced incomplete evidence. Governance follow-ups assumed array responses. | Incomplete responses produce the existing error state instead of rendering unsafe decision controls or crashing. Approval evidence can be reloaded. |
| Several regression fixtures still described retired canvas controls, sheet names and notification wording; three backend fixtures failed type checking. | Updated fixtures to current behavior without weakening production checks. The retained-plan test explicitly enables its intended rollout instead of inheriting the disabled unit baseline. |

The proposed generic transport wording was discarded after tests showed it would overwrite useful contextual messages, including a successfully saved swap whose subsequent refresh failed. Existing action-specific errors remain in place.

## Verification

- Backend production build and complete `npm test`: **1,066 pass, zero fail, one existing clinical-policy TODO** (1,067 total). The TODO requires qualified approval of calorie bounds; this engineering audit does not resolve it.
- Frontend production build and complete Vitest run: **226 files and 1,157 tests pass**. jsdom reports its existing unsupported media/navigation notices; no test fails.
- Scoped ESLint and diff whitespace checks pass. Impeccable detectors report no findings for the two changed application components. React review retained hook order, parallel independent reads, scoped cancellation, shared components and existing accessible controls.
- Shared localhost API rebuilt and restarted against the verified defense Neon target; frontend remains the normal shared development server. No hosted deployment, migration or data backfill was performed.
- Shared browser: RND verified library displayed **1,874 records** and audit displayed recorded actions/conditions. No console errors on the inspected audit view. Synthetic member login succeeded, and the grocery workspace displayed **11 ingredients** from its existing approved meal. The actual grocery response was HTTP 200 in **111,185 ms**, inside the new budget; the old 30-second default would have aborted it. This confirms recovery, not fast database performance.
- Synthetic admin login and Overview loaded actual platform/food catalogue totals; no console errors on that inspected screen. Browser testing changed no meal decision, claim, flag, purchase or account profile. Ordinary login/logout and protected-context access keep their existing server records.

Browser screenshots and private API logs are retained under `codex_outputs/defense-*-20261014.png` and `backend/.local/defense-timeout-audit-20261014/`. They are local artifacts, not committed member information or credentials.

## Limits

This is a codebase-wide failure-pattern audit with bounded browser checks, not a claim that every provider or user action was exercised. Shared database latency remains variable and the grocery cold load was slow. Budget alignment prevents premature browser aborts; it cannot guarantee an external service never fails. Email delivery, payment processing, provider AI, large imports and real-member clinical mutations were not rehearsed in this pass. No clinical validation is implied.
