# Membership V1 operations

Membership adds a single 14-day trial and bounded member benefits to the existing account and meal workflows. Purchases are unavailable until the owner chooses a price and an approved payment adapter is implemented. There is no sandbox purchase, public activation endpoint, automatic renewal or automatic charge.

## Access and allowances

| Feature | Free after trial | Member / trial |
| --- | --- | --- |
| General weekly plans without declared conditions/allergies | Saved planning profile | Included |
| Optional goal, food preference, location and shopping changes | Unavailable | Included |
| Swaps per plan cycle | 3 | 6 |
| AI estimate requests per Manila week | 2 | 10 |
| Optional replans per Manila week | 0 | 2 |
| Progress insights and weekly adaptation | Unavailable | Included |
| Case plan-review episodes per target Manila week | Existing episode follow-up | 1 |
| User-requested outside-meal review episodes per Manila week | Existing episode follow-up | 1 |

The trial starts once a cleared current plan is usable; a starter plan counts. Pending review and future cycles do not start it. Existing accounts receive their trial prospectively when membership is first observed, not retroactively from an old plan. Before the trial starts, enhanced admission uses the same weekly limits. Moving to another cycle never restarts the trial.

General accounts continue plans, groceries, manual outside-meal logging and saved-record access. Declared conditions, allergies and custom safety restrictions require enhanced access for a new case plan after expiry. An existing eligible active cycle can finish, with all normal clearance gates retained. A safety correction can repair that active cycle without consuming an optional replan; it does not open another week. Changes to body/health information and new hard dietary restrictions remain available; optional planning changes require enhanced access. Progress chart endpoints, weigh-in tracking and adaptive check-ins require enhanced access; existing record export does not.

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

The feature flag defaults off for staged deployment. Disabled membership does not query its new tables and preserves previous access. `GET /api/user/membership` requires a regular authenticated user and returns status/allowances without private profile details. `POST /api/user/membership/checkout` always returns `503 MEMBERSHIP_PURCHASES_UNAVAILABLE`.

## Migration and activation

1. Recheck the intended `demo` commit and current Railway database target. The owner's shared database is also used by the hosted application; preserve its encryption key and take a verified backup before migration. Do not seed, reset, or use `db push`.
2. Review the additive migration `20261001120000_membership_trials_and_allowances`. It creates one enum, three membership tables, indexes, defensive checks and cascading User relations. It does not update existing user/meal rows or recreate the archived billing schema.
3. Deploy the verified code with `MEMBERSHIP_ENABLED=false`. Confirm Railway's pre-deploy command is `npx prisma migrate deploy`, or run that command against the verified target through the normal controlled deployment process. Confirm the new migration succeeded before activation.
4. Verify backend `/ready` and the frontend deployment. Set Railway `MEMBERSHIP_ENABLED=true` and apply the variable change. No additional Vercel membership variable is needed.
5. Confirm a regular user's membership status, trial start, free/member gates and allowances. Confirm nutritionist/admin membership access remains forbidden. Purchases must remain unavailable.
6. If activation causes an operational problem, set `MEMBERSHIP_ENABLED=false`; retain the additive tables and trial/usage records for investigation. Code rollback does not reverse a database migration.

`MembershipGrant` is a future trusted entitlement boundary. The reused historical policy accepts only verified paid-invoice or audited administrator-adjustment evidence, with bounded effective dates and revocation. This release provides no route that creates grants and no production test grants. A later payment adapter must verify payment server-side and persist its durable evidence reference; browser checkout-return flags must never grant membership. Old checkout flags and old test-premium endpoints are not restored.

## Verification

The deterministic suites are `npm --prefix backend test` and `npm --prefix frontend test`; build both packages and run lint/architecture checks. `npm --prefix backend run test:acceptance:membership` requires an explicitly configured local PostgreSQL database named `membership_acceptance` at localhost/127.0.0.1 and refuses other targets. Apply migrations to that disposable database before running it. The script creates synthetic fixtures, cleans them in `finally`, and does not call Gemini or send email.

Acceptance covers durable trial start, pending/current/future starter timing, correction versus optional updates, concurrent quotas, provider failure refunds, successful retries, verified/revoked grants, case expiry and active-cycle safety repair, cycle revision swap counts, role boundaries and disabled checkout. It stubs only the relevant provider/clearance decision where noted. These checks establish software behavior on disposable fixtures; they do not establish clinical validation or live provider/device behavior.
