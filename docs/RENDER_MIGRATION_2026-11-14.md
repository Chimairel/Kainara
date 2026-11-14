# KAINARA backend migration to Render — November 14, 2026

## Status and scope

Prepared locally; **not yet deployed or switched**. The owner authorized replacing
the expired Railway backend with Render Free. Vercel remains the frontend, Neon
remains the database, and Cloudinary remains media storage. No database migration,
restore, seed, account rewrite, approval change or new package is required.

The shared Desktop checkout had been removed at the owner's earlier request. A
fresh GitHub clone restores it for this work. The release baseline is
`bfdfc477ce875dff0251f7f62c331b2fec10413d`, the current remote `demo` and
`codex/staging` heads at inspection. Development is separately ahead with member
and native-app changes; do not silently include those in this hosting migration.

The Render plugin is connected. The owner selected **My Workspace**
(`tea-dbs7the1egvs73d3j1mg`). Its initial service inventory is empty. Brevo access
is confirmed. The initial suggestion to adopt Resend is superseded: current demo
already uses a shared SMTP/Brevo HTTPS adapter. The older surviving worktree was
not current deployment evidence.

## Reviewed configuration

`render.yaml` defines **one** Free Node web service, `kainara-api`:

- Root: `backend`; Node 24; build: install locked dependencies, generate the Prisma
  client, then compile TypeScript. Start: `npm start`.
- Proposed region: Singapore. Confirm this against the selected Neon endpoint's
  region before applying the plan. Backend/database distance affects latency.
- Manual deployment while the migration is in progress. No automatic preview
  instances, new database, disk or paid worker/cron resource.
- `/health` probes process health without querying Neon. Check database readiness
  separately and only on staging during acceptance.
- Production security plus the existing `capstone-demo` mode; no clinical approval
  is invented. Exact CORS origins, proxy trust, secure cookies and route gates stay
  in place. Verify forwarded client-IP handling behind Render/Vercel.
- `EMAIL_PROVIDER=brevo`. Render production startup rejects accidental SMTP
  selection. Six operational email templates and the existing 10-second HTTPS
  deadline, redirect rejection, safe errors and no ambiguous automatic retries are
  preserved. A local configuration check does not prove inbox delivery.
- All keys, URLs and feature flags marked `sync: false` require the matching
  environment's real values. No secrets are hardcoded or auto-generated.

Render may sleep after 15 minutes without inbound traffic and may restart the
service. Persisted queue leases/recovery remain the existing implementation;
there is no claim that work or device reminders continue while the API is asleep.
Do not add an always-on monitor merely to prevent sleep: it keeps background
database polling alive and consumes shared provider budgets.

## Preserve the original environment

Import the existing backend environment through the hosting dashboards or a
secure local export. Do not paste credentials into chat or commit them.

Preserve at least:

- The correct environment's pooled `DATABASE_URL`; no new Neon project is needed.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` and
  `CLINICAL_DOCUMENT_ENCRYPTION_KEY`. Do not generate replacement signing or
  encryption keys for an existing database.
- `BREVO_API_KEY` and the exact verified plain `EMAIL_FROM` address.
- Google, Gemini, Cloudinary, web-push and payment credentials where configured.
- Every membership/assistant/clarification/push/payment feature flag and quota
  override. Import the full reviewed configuration rather than guessing defaults.

Keep `CLINICAL_POLICY_APPROVED_VERSION` unset for this capstone release. Omit
Railway platform-injected variables and let Render supply its own `PORT` and
platform identifiers. Do not run the historical setup helper against this
existing database: that helper can generate replacement secrets.

## Local → staging → demo

1. Build and test the restored local candidate with synthetic/mocked fixtures.
   Review the Blueprint plan before applying it. The Render approval contract
   requires owner authorization of the concrete planned resources.
2. Bring up the candidate against **separate staging** credentials/database first.
   Configure the staging Vercel preview's `INTERNAL_API_URL` to the Render HTTPS
   origin **without `/api`**. Retain `NEXT_PUBLIC_API_URL=/api` so browser auth uses
   Vercel's same-origin rewrite and existing cookies/CSP behavior.
3. Verify staging OTP/reset email, login/refresh/logout, report holds, current and
   upcoming plans, free Nara, media and PDF paths. Keep provider usage bounded and
   do not submit paid AI work merely to test hosting. Record the actual tested SHA
   and deployment identity; mocked tests alone do not satisfy this step.
4. For a single-service cutover, disconnect the staging frontend from this service
   **before** binding it to the demo database. Leave staging using its isolated
   laptop API or clearly unavailable; it must never route test traffic to demo.
   Replace the service's environment with the reviewed demo configuration as a
   deliberate operation; do not merge staging-only values into demo.
5. Promote only the exact staging-tested application changes, then point the
   production Vercel deployment's `INTERNAL_API_URL` to the Render origin. Preserve
   `demo` as Vercel's production branch. Record Render/Vercel commit/state and
   configuration metadata. No demo test logins, API smoke tests or test SQL reads.
6. Retarget the existing authenticated external daily caller to
   `POST /api/cron/daily-checkin` on the new API, preserving `CRON_SECRET`, its
   00:10 Manila schedule, and single ownership. Do not run the old and new
   schedulers together. A health monitor is not a job scheduler. A wake-up request
   may be delayed by Render's cold start; deadlines/reminders are not guaranteed
   on the sleeping Free plan.

Do not run Prisma migrations as part of every service start/build. This change
needs none. If pending schema differences are discovered, stop and review their
separate target/backup/migration requirements before cutover.

## Verification and remaining gates

Local verification completed: backend source/test TypeScript, production build
and changed-file ESLint pass. All **16** affected email/production-config tests
pass, covering six email templates, safe links, provider errors, timeouts, SMTP
compatibility and the Render HTTPS requirement. All mail traffic is mocked; no
Neon connection, SMTP session or real provider message is used. Existing Prisma
Client generation is local code generation, not a schema migration.

Hosted rollout receipts will be appended here.
The first Render plan (`exs-dbs83fm1egvs73d45ei0`) rejected a custom shutdown
delay on Free; the unsupported override was removed before re-planning. No
resource was deployed by that failed plan. Railway OAuth discovery returned no
projects; original environment values have not been recovered. Vercel returned
403 for `chimairels-projects`; team access was requested through its consent flow.
After correction, Render accepted plan `exe-dbs83os9v7es73bvld70` for source
`d2865b9814037482b76f9deaf4be83a1a7da882f`, with no notices: create one Free
Node service, `kainara-api-txqu`, in Singapore, with previews and automatic deploys
off. The required manual environment values remain unset; the plan is not
applied. The owner approved the reviewed Free plan, conditional on recovering
the original staging settings. Vercel team consent subsequently succeeded and project
`nutrimindv1` (`prj_DxetpuW3fd5zY2ezP4wpdOtQrk8K`) is accessible. Existing
`codex/staging` preview overrides and production `INTERNAL_API_URL` entries are
present; none has been changed. Railway identity is `chimairelp2@gmail.com`, whose
project inventory is empty. The owner was asked to recover the original account
or private backend environment, rather than create replacement secrets.
The development integration also passes the same 16 mocked tests, test/source
TypeScript and production build after regenerating its local Prisma Client for
the existing development schema. No schema was applied to any database.

Original environment transfer, bounded staging acceptance,
daily scheduler retargeting and production Vercel cutover remain required. Do not
describe this release as complete until each applicable gate is recorded.

## Provider references (checked November 14, 2026)

- [Render Free limits](https://render.com/docs/free)
- [Render Blueprint fields](https://render.com/docs/blueprint-spec)
- [Render built-in environment variables](https://render.com/docs/environment-variables)
- [Render MCP server](https://render.com/docs/mcp-server)
- [Brevo transactional HTTPS delivery](https://developers.brevo.com/docs/send-a-transactional-email)
