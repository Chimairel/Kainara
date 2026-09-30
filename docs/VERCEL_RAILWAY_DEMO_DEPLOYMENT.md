# Hosted capstone demonstration on Vercel and Railway

Status: deployment preparation implemented; hosted deployment and live integrations not yet verified.

The publicly accessible website itself is the capstone demonstration. Normal registration, Google login, onboarding and professional applications remain available; there is no demo email allowlist or extra account-access restriction. It is not a clinical service or a clinical approval. No approved policy version is claimed. Existing email verification, role checks, allergies, review decisions, independent reviewers, document claims and audit logs still apply. Use synthetic health information for demonstrations.

## 1. Select accounts, database and release

- Use a separate demo database or a reviewed sanitized copy. Do not point the demo at a database with real patient records or run test-account seeds against the shared development database.
- Prepare demonstration accounts for all three roles and rehearse registration/application journeys. Existing credentials, email/Google identity verification and role prerequisites still apply; demo mode does not create accounts or grant nutritionist/admin roles.
- Select a release branch deliberately. Continuing to use `development` as the live deployment branch would publish our routine future pushes. Do not create or switch branches over another tool's unfinished changes.
- Review required public assets before release. Untracked `frontend/public/sources/` and `Documentations/` are not automatically included in a Git deployment; do not publish their contents without reviewing them.

## 2. Railway backend

Import the repository, choose the approved branch, set root directory `/backend`, and use the checked-in Dockerfile (Node 24). Start command: `node dist/server.js`. Configure pre-deploy command `npx prisma migrate deploy` with a finite timeout after confirming the demo database and taking a backup. Do not use `migrate dev`, `db push`, reset, or automatic seeds on deployment. Configure Railway's healthcheck path as `/ready`; `/health` only confirms the process is alive. The server reads Railway's `PORT`, and the Docker healthcheck reads the same value.

| Railway variable | Demo configuration |
| --- | --- |
| `NODE_ENV` | `production`, never `test` or `development` to bypass deployment checks |
| `NUTRIMIND_DEPLOYMENT_MODE` | `capstone-demo` |
| `CLINICAL_POLICY_APPROVED_VERSION` | Unset/empty; setting it in demo mode fails startup |
| `DATABASE_URL` | Dedicated PostgreSQL demo connection, appropriate SSL/pooling settings |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` | Separately generated secrets of at least 32 characters |
| `FRONTEND_URL` | Final exact HTTPS Vercel/custom origin, without a trailing slash or path |
| `CORS_ORIGINS` | Exact approved HTTPS frontend origins; no wildcard, arbitrary preview domain or localhost |
| `TRUST_PROXY` | Configure only after confirming Railway/Vercel forwarding topology and testing client IP/rate-limit behavior; do not blindly increase hop count |
| `GOOGLE_CLIENT_ID` | Approved Google Web client ID, matching Vercel |
| `GEMINI_API_KEY` and Gemini quota variables | Server-only key and conservative project quotas |
| `CLINICAL_DOCUMENT_ENCRYPTION_KEY` | Base64-encoded 32-byte key; securely retain it across redeployments and database restore |
| `CLOUDINARY_URL` | Server-only credential for administrator meal image uploads |
| Email credentials and `EMAIL_FROM` | Depend on the delivery method selected below |

The database holds encrypted clinical document bytes. Railway local disk is not their persistence mechanism. Do not lose or replace their encryption key: a new key cannot decrypt previously uploaded files. Never commit secrets, test OTP capture paths or local environment files.

## 3. Vercel frontend

Import the same repository/release branch. Set root directory `frontend`, framework Next.js, Node 24, install command `npm ci` and build command `npm run build`; let the Next.js integration determine the output. Enable access to source files outside the root directory if required by the existing output tracing configuration. Do not enter a development start command.

| Vercel variable | Demo configuration |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `INTERNAL_API_URL` | Railway public HTTPS origin without `/api` or trailing slash |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same Web client ID as backend |
| `NUTRIMIND_DEPLOYMENT_MODE` | `capstone-demo`, matching backend |

The existing Next rewrite proxies `/api/*` to Railway. This keeps browser requests and the host-only secure `SameSite=Lax` refresh cookie on the frontend origin. Do not point browser calls directly at an unrelated Railway domain without separately reviewing cookie behavior. API responses explicitly disable browser/shared CDN caching; account-scoped in-memory UI caching remains unchanged. Verify Set-Cookie, refresh rotation, logout and expired sessions on the actual hosted URLs. Confirm large document requests and long AI estimates fit the proxy's actual limits.

The demo notice is server-rendered on every frontend page without browser-dependent hydration branches. Treat these frontend variables as build configuration: rebuild/redeploy after changing URLs or mode. Never put database, mail, encryption or JWT secrets in `NEXT_PUBLIC_*`.

## 4. External services before release

### Email (decision still required)

The current transport is Nodemailer SMTP. Railway Free/Trial/Hobby blocks outbound SMTP; those plans require an HTTPS email delivery integration. Pro permits SMTP. Choosing an SMTP provider alone does not solve a blocked SMTP port. An HTTPS provider adapter has not yet been added. Choose the provider, configure its approved sender/domain, then verify real OTP, resend, password-reset, applicant-status and invitation mail. All action links must use the final `FRONTEND_URL`. No hosted release should claim working email from local captured-mail tests.

### Google and images

Register the final frontend origin in Google Authorized JavaScript origins. The current callback-based Google sign-in does not require inventing a redirect callback endpoint. Confirm consent settings, Google login/register intent, popup/FedCM behavior and account switching. Confirm Cloudinary uploads and permitted image origins; never make private clinical documents publicly readable.

### Scheduling and latency

Configure one authenticated external caller for `POST /api/cron/daily-checkin`, with `Authorization: Bearer <CRON_SECRET>`, following the current runbook (00:10 Manila = 16:10 UTC on the preceding date). Do not put this secret in browser code. Running the API alone does not create the daily schedule. Choose backend/database regions together and explicitly assess sleep/cold-start settings; hosted services do not guarantee removal of remote database delays.

## 5. Hosted verification and release

- Confirm `/ready` and `/health`; the latter labels capstone mode without exposing the allowlist or secrets.
- Test normal new-user registration, email verification and Google login/register intent. Confirm invalid credentials, stale/revoked sessions and cross-role access remain denied.
- Test demonstration USER/NUTRITIONIST/ADMIN accounts, onboarding/report acknowledgment, current/upcoming planning and swaps, groceries, outside food, independent review/dispute/recheck rules, suspension and notifications.
- Verify image/PDF upload, private file claims and access logging, downloads, live email links and refresh after access-token expiry. Measure first load and cached navigation with hosted request timings.
- Confirm the notice in both themes/mobile. Its wording states the demo is not clinically approved and asks for test data only.
- Check final URLs for localhost calls, mixed-content errors, unexpected CDN cache hits and secret exposure. Set spending alerts for hosting, email and AI.
- Record the exact commit and actual hosted evidence in the engineering record. Build/unit passes are not evidence that external integrations work live.

## 6. Future fixes

Edit locally, test, commit and push to the chosen deployment branch (or review and promote from development). Local saves alone do not update hosted code. Vercel and Railway can automatically rebuild that branch. Deployments are independent, so preserve API compatibility while both versions may be live. Normal deployments preserve the external database; migrations need backups and additive compatibility. Reverting code does not reverse a database migration. Preserve the last working code deployment and a tested database restore path.

To offer a nutrition service later, obtain and record qualified clinical approval, complete its required changes, configure the exact approved version, switch both modes to `public`, and rerun the service release gates. Capstone deployment is not an approval substitute. The word `public` here names the service mode; it does not describe whether the capstone URL can be opened on the internet.

## Provider references (checked September 30, 2026)

- [Vercel external rewrites and cache controls](https://vercel.com/docs/routing/rewrites)
- [Vercel deployment environments](https://vercel.com/docs/deployments/environments)
- [Railway monorepo setup](https://docs.railway.com/guides/deploying-a-monorepo)
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway outbound mail restrictions](https://docs.railway.com/networking/outbound-networking)
- [Google Identity setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
