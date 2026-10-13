# Submission attempts and Sonner feedback — October 13, 2026

Implemented in the shared Desktop checkout on `codex/solar-icons`. Public deployment is separate.

## Enforced policy

| Operation | Identity budget | Connection budget |
| --- | --- | --- |
| Password sign-in | 5 failed attempts per normalized email / 15 minutes | 20 failed attempts / 15 minutes, shared with Google continuation/sign-in |
| Registration | 5 attempts per normalized email / hour | 10 attempts / hour, also covers Google account creation |
| Forgot password | 5 attempts per normalized email / hour | 10 attempts / hour |
| Reset password | — | Separate 10 attempts / hour |
| Email verification | 20 requests per authenticated account / 15 minutes; existing persisted lock after 5 incorrect codes | 20 requests / 15 minutes |
| Resend verification | 5 requests per authenticated account / hour; existing persisted 60-second resend cooldown | 20 requests / hour |
| Contact Support | 5 attempts per verified account / hour | 20 attempts / hour, before authentication |
| Admin support reply | 60 attempts per authenticated admin / hour | Existing general API connection/account budget |

Registration, recovery and support budgets count unsuccessful requests as well as successful ones. Sign-in budgets exclude successful responses. Email keys use the same trim/lowercase normalization as password authentication and retain only a digest in the limiter store. Missing/oversized email input falls back to the connection key. Account middleware follows authentication; unsigned caller identities cannot select that budget. Google credentials are not decoded to choose a limiter identity. Forgot-password responses preserve the existing account-enumeration protection.

These HTTP budgets use `express-rate-limit`'s existing process-local memory store, including in development. They restart with the API and are not a distributed or durable quota across replicas. The existing OTP lock and resend timestamp remain stored on the account. No schema, provider, environment, or secret change is needed.

## Browser behavior

- Shared Axios submission guard covers password/Google authentication, recovery, verification/resend, support requests and admin support replies. It prevents concurrent duplicate sends and observes the server's `retryAfterSeconds`/`Retry-After` without automatically replaying 429s.
- Waits are scoped to the browser account and operation; changing the public form's email does not bypass a received wait. Browser waits are convenience controls, not authorization. Expired waits and completed/failed/aborted requests release their leases. A blocked duplicate cannot release the original active request. Refresh, logout and browsing/polling remain outside this submission guard.
- Sonner shows server submission errors, waiting times and confirmations. Local field validation and persistent page-load failures remain contextual. Support drafts stay in place on failure; recovery success keeps its form and email in place; a successful password reset returns to login. Google recovery actions remain available in the toast. Admin replies remain recorded in the conversation separately from the toast.

## Verification

- **14 backend tests passed:** authentication limiter isolation, canonical email keys, expiry, HTTP support authentication/account limits, request validation, retained provider failures, identity races and existing verification/resend remaining waits. Commands use `tests/runtime-environment.mjs` to pin mocked persistence to an unreachable loopback fixture.
- **28 frontend tests passed:** Axios refresh/transient retry behavior, submission leases, server cooldown expiry, duplicate ownership, cancellation/account separation, retained support drafts, Sonner receipts and Google sign-in recovery.
- **12 intercepted Chromium journeys passed on localhost:3000:** Docs/Contact Support and admin support at 390/1440 px in light/dark, reduced-motion/anonymous support, mascot scroll behavior, and login cooldown followed by a recovery toast with stable form height. One new test initially filled the old input during client navigation; awaiting the recovery URL/heading fixed that fixture race and its focused rerun passed. All API mutations were intercepted; no real support/auth email was sent.
- Both production builds and changed-file frontend ESLint passed. `git diff --check` passed. No hosted records/schema, secrets, deployment or live load test was changed/run.

Screenshots remain in the ignored `backend/.local/docs-support` directory. Full repository test-suite status is not inferred from these focused checks.
