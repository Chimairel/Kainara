# Membership V2 operations

Membership adds a single 14-day trial and bounded Lifestyle and Health benefits to the existing account and meal workflows. Public Pricing and signed-in Membership share the same plan component. **Get Lifestyle** and **Get Health** open PayMongo hosted checkout in the isolated development payment sandbox. Real purchases, automatic renewal and automatic charges remain unavailable.

| Plan | Monthly | Yearly, rounded whole peso |
| --- | --- | --- |
| Lifestyle | ₱249 | ₱2,390 |
| Health | ₱1,499 | ₱14,390 |

The annual amount applies the approved 20% discount to twelve months, rounded to the nearest peso. Amounts are owned by the server in centavos. The public catalogue supplies displayed prices; checkout requests contain only the tier, period and request key.

## Access and allowances

| Feature | Free after trial | Lifestyle | Health / trial |
| --- | --- | --- | --- |
| General weekly plans without declared conditions/allergies | Active planning report | Included | Included |
| Save profile edits and correct mistakes | Included | Included | Included |
| First planning report / genuinely unchanged weekly report | Free | Included | Included |
| Apply changed ordinary planning context | Previous eligible report remains usable | Included | Included |
| Apply changed case context / new case plans after trial | Unavailable | Unavailable | Included, subject to clearance |
| Swaps per plan cycle | 3 | 6 | 6 |
| AI estimate requests per Manila week | 2 | 10 | 10 |
| Optional replans per Manila week | 0 | 2 | 2 |
| Progress insights and weigh-in tracking | Unavailable | Included | Included |
| Case plan-review episodes per target Manila week | Existing episode follow-up | Existing episode follow-up | 1 |
| Requested outside-meal review episodes per Manila week | Existing episode follow-up | Existing episode follow-up | 1 |

The one 14-day Health trial starts when a cleared current plan becomes usable; a starter counts. Pending review and future cycles do not start it. Reports, check-ins, cycle changes and tier changes never restart the trial or reset usage. Existing verified membership grants map to Health; explicit Lifestyle grants have no new review allowance. Overlapping Lifestyle access cannot extend expired Health case access.

### Planning reports and weekly check-ins

`UserProfile` stores editable declarations; its `planningReportVersion` selects the latest actually accepted `NutritionReportVersion` used for planning. A first-ever activation is free. Subsequent changed report inputs require Lifestyle for general planning or Health for case context. Existing clinical prerequisites still apply. The API retains its `/acknowledge` path for compatibility; the interface says **Use this report for meal planning**.

Every due weekly **Still the same** submission atomically creates a dated report version and weekly record. The server compares actual snapshot values and declarations against the planning baseline; a client flag cannot hide saved changes. Selecting this identical report remains free. Genuine corrections that restore the prior context also remain free. Duplicate/concurrent submissions create one weekly record and one report. A stale observed profile revision rejects the submission. Check-in confirmations are separate from paid progress tracking; they do not automatically change calorie targets.

Profile saving does not activate optional planning changes. Declining an upgrade can retain the previous eligible report, with an unapplied-update banner. New safety declarations immediately invalidate affected slots and cannot be hidden by retaining an older report. An overdue check-in reminder has no dismiss control and clears once a current check-in is recorded. First report acknowledgment time and last check-in time govern due dates.

Plan composition, schedules, queued candidates, catalogue compatibility, swaps and replacement inputs use the accepted report snapshot. New cycle snapshots store the report version; nutritionist meal review presents that planning context alongside current declarations and warns about differences. Historical cycles remain immutable. A nutrition report is not professional approval or evidence that a meal has cleared its restrictions.

Admission reserves allowance under an account lock. Failed work releases its reservation; successful persistence consumes it atomically. In-flight reservations expire after 30 minutes. AI requests only spend an allowance when provider estimation is actually needed and the preview is saved. Manual and exact-source resolution do not spend it. Replace-plan requests use a client request key, and completed retries return the saved cycle. Swaps count across revisions of the same cycle period. Initial items in one outside-meal log share a requested review episode; reopening after a final decision starts another episode. Replies and completion of an already submitted review are not newly charged. Automatic safety review is never suppressed by an exhausted allowance.

An optional replacement of a case plan starts a new plan-review episode and must fit both the replan and case-review allowances. Safety repair and follow-up of the admitted plan do not start another episode. One episode is a bounded workflow, not unlimited consultations, continuous monitoring, or guaranteed approval. Existing profile-document, reviewer eligibility, independent approval, safety revision and meal actionability rules still apply.

## Configuration

Only the backend needs membership settings:

| Variable | Default | Valid range |
| --- | --- | --- |
| `MEMBERSHIP_ENABLED` | `false` | `true` or `false` |
| `MEMBERSHIP_WEEKLY_SWAPS` | 6 | 3–21 |
| `MEMBERSHIP_WEEKLY_ESTIMATES` | 10 | 2–100 |
| `MEMBERSHIP_WEEKLY_REPLANS` | 2 | 1–7 |
| `MEMBERSHIP_WEEKLY_PLAN_REVIEWS` | 1 | 1–7 |
| `MEMBERSHIP_WEEKLY_OUTSIDE_REVIEWS` | 1 | 1–20 |

Manila weeks start Monday at 00:00. Swap limits follow the plan cycle, including starter cycles; revisions do not reset them. Case plan admission is counted against the target plan week. The status page shows current-week usage and the active cycle's swap count. Backend admission remains authoritative when cached frontend status changes or expires.

The feature flag defaults off for staged deployment. Disabled membership bypasses payment/allowance gates. Once an active planning-report pointer exists, its baseline remains authoritative; disabling membership does not discard that pointer. `GET /api/user/membership` requires a regular authenticated user and returns status/allowances without private profile details. `POST /api/user/membership/checkout` returns `503 MEMBERSHIP_PURCHASES_UNAVAILABLE` outside the configured isolated test environment.

## Migration and activation

1. Recheck the intended `demo` commit and current Railway database target. The owner's shared database is also used by the hosted application; preserve its encryption key and take a verified backup before migration. Do not seed, reset, or use `db push`.
2. Review the initial additive migration `20261001120000_membership_trials_and_allowances` and the V2 migration `20261002130000_report_planning_membership_tiers`. V2 adds the tier, planning-report pointer, first-activation date, confirmation kind and report/cycle references; it backfills the latest accepted baseline and maps historical grants to Health. It does not change trial dates, usage, meal rows or old report content. Only deploy V2 to an isolated development database during development testing; the shared Neon database also serves demo. The initial migration creates one enum, three membership tables, indexes, defensive checks and cascading User relations. It does not update existing user/meal rows or recreate the archived billing schema.
3. Deploy the verified code with `MEMBERSHIP_ENABLED=false`. Confirm Railway's pre-deploy command is `npx prisma migrate deploy`, or run that command against the verified target through the normal controlled deployment process. Confirm the new migration succeeded before activation.
4. Verify backend `/ready` and the frontend deployment. Set Railway `MEMBERSHIP_ENABLED=true` and apply the variable change. No additional Vercel membership variable is needed.
5. Confirm a regular user's membership status, trial start, Free/Lifestyle/Health gates and allowances. Confirm nutritionist/admin membership access remains forbidden. Purchases must remain unavailable.
6. If activation causes an operational problem, set `MEMBERSHIP_ENABLED=false`; retain the additive tables and trial/usage records for investigation. Code rollback does not reverse a database migration.

`MembershipGrant.tier` is LIFESTYLE or HEALTH and defaults to HEALTH for backward compatibility. `MembershipGrant` is a future trusted entitlement boundary. The reused historical policy accepts only verified paid-invoice or audited administrator-adjustment evidence, with bounded effective dates and revocation. This release provides no route that creates grants and no production test grants. A later payment adapter must verify payment server-side and persist its durable evidence reference; browser checkout-return flags must never grant membership. Old checkout flags and old test-premium endpoints are not restored.

## Verification

The deterministic suites are `npm --prefix backend test` and `npm --prefix frontend test`; build both packages and run lint/architecture checks. `npm --prefix backend run test:acceptance:membership` requires an explicitly configured local PostgreSQL database named `membership_acceptance` at localhost/127.0.0.1 and refuses other targets. Apply migrations to that disposable database before running it. The script creates synthetic fixtures, cleans them in `finally`, and does not call Gemini or send email.

`npm --prefix backend run test:acceptance:report-membership` uses the same guarded disposable target and additionally checks report activation, free profile saving, draft isolation, unchanged versions, mistake recovery, tier expiry, review caps and concurrent confirmations. Neither script targets the shared/hosted database.

Acceptance covers durable trial start, pending/current/future starter timing, correction versus optional updates, concurrent quotas, provider failure refunds, successful retries, verified/revoked grants, case expiry and active-cycle safety repair, cycle revision swap counts, role boundaries and disabled checkout. It stubs only the relevant provider/clearance decision where noted. These checks establish software behavior on disposable fixtures; they do not establish clinical validation or live provider/device behavior.

## Isolated local preview

To try the profile/report/tier screens without migrating demo, use the disposable local database above and run `npx tsx scripts/preview-report-membership.ts` from `backend`. It binds the API to `127.0.0.1:5018` and provisions three synthetic accounts (`free@preview.invalid`, `lifestyle@preview.invalid`, `health@preview.invalid`) with the fixture password `Development123!`. Existing preview edits are retained across restarts. The runner refuses other database targets and grants no real account access.

Run the isolated frontend on port 3108 with `NEXT_PUBLIC_API_URL=/api` and `INTERNAL_API_URL=http://127.0.0.1:5018`; set those values for its build as well as its start. These settings are process-local; do not replace the shared checkout's environment files. This preview does not send email or generate provider-backed meal plans. PayMongo test checkout requires the explicit opt-in below. The two acceptance scripts independently verify the business and concurrency rules. Local preview accounts are development fixtures, not clinician-approved records.


## PayMongo development checkout

Apply the additive migrations `20261002150000_membership_test_checkout` and `20261002150100_membership_payment_notification` to the disposable database only. This has a separate `MembershipTestCheckout` ledger; successful test payments never create a real `MembershipGrant`.

All of these conditions are required:

- `MEMBERSHIP_ENABLED=true`, `PAYMONGO_INTEGRATION_ENABLED=true`, `PAYMONGO_ENVIRONMENT=TEST`.
- `NODE_ENV=development` or `test` and a valid backend `sk_test_` key.
- Database hostname localhost/127.0.0.1 and database name `membership_acceptance`.
- `FRONTEND_URL` points to the loopback preview, normally `http://localhost:3108`.

The preview runner optionally reads only the test key, environment and webhook secret from a file named by `PAYMONGO_PREVIEW_KEYS_FILE`. It never copies the shared database or provider return URLs. Existing hosted environment files are unchanged. Never commit keys or put them in `NEXT_PUBLIC_*`.

The server creates a v2 checkout session, persists its identity and later retrieves that session through PayMongo v1. Test mode, reference, payment/intent identity, amount, currency, paid status, refund/dispute state and timestamps are checked. The creation response need not contain a reference; the retrieval response must match it. Secret keys and provider client keys are not returned or logged.

Anonymous visitors choose a tier/period and continue to login. Account setup, consent and first-report selection precede checkout. Selection is retained for up to 24 hours in session storage; arriving after login opens plans, **never automatically purchases**. A server request key and account lock prevent duplicate creation; a recent open checkout is reused. Closing or abandoning checkout is navigation only and cannot activate access. The return page polls a bounded number of times and offers an explicit retry.

Verified payment is recorded atomically. Duplicate return checks and webhooks do not add another period or notification. Existing applicable trial/paid periods are preserved; a Health upgrade can start immediately over Lifestyle, while a Lifestyle purchase waits for existing Health coverage. A monthly or yearly purchase adds one or twelve Philippine calendar months with end-of-month clamping. No proration, auto-renewal, scheduled debit, real purchase, refund administration or production subscription is implemented.

### Webhook

The raw-body endpoint is `POST /api/payments/paymongo/webhook`; configure the PayMongo test event `checkout_session.payment.paid` and backend `PAYMONGO_WEBHOOK_SECRET` once a reachable isolated development endpoint is available. It verifies the test `te` HMAC over timestamp and original bytes with a five-minute tolerance, then retrieves the known session directly before recording payment. Unknown/unrelated signed events are acknowledged without granting access. Production/shared-database activation is refused.

Loopback URLs cannot receive PayMongo webhooks from the internet. Local checkout testing uses server retrieval on return instead, so no tunnel or provider webhook registration is required. A production payment release needs a reachable verified webhook and additional approved live-payment/refund/renewal design; do not register the undeployed Railway route for this local-only release.

### Tests and provider evidence

`npm --prefix backend run test:acceptance:membership-checkout` refuses other database targets and uses synthetic provider responses. It tests ownership, role/selection admission, concurrent idempotency, unpaid returns, wrong amounts, duplicate payment/webhook delivery, one notification, renewal dates and isolation. It cleans its synthetic users in `finally` and never calls a real provider. The actual local browser trial also completed a PayMongo hosted test-card payment using the existing test key; this does not establish live merchant readiness or payment collection.
