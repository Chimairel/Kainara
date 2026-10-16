# Staging and presentation isolation — October 16, 2026

## Topology and release identity

Owner approved one existing Vercel project with a branch preview, a temporary laptop API and two separate Neon projects. Railway rejected additional provisioning on the owner's free setup; no billing upgrade was made. The two task-created Vercel projects were removed, along with the unused task-created Railway staging project. The existing live project remains in place.

| Environment | Frontend/code | API | Database |
| --- | --- | --- | --- |
| Live | Existing `nutrimindv1` Vercel production, Git `demo`, `efdc6923c300dde0a1f25b1eb0a2dbb52c74b03f` | Existing Railway deployment | Existing Neon `nameless-dust-38810716` / `br-round-art-b355gp02` |
| Staging | Same Vercel project, preview `codex/staging`, `c8675a149969177bd8f42ba8f0a57c4672b20f19` | Laptop port 5102 through Cloudflare quick tunnel | Neon `dark-cake-36096216` / `br-royal-sky-azsc3kcv` |
| Presentation preparation | No application connected yet | None | Neon `late-grass-59329912` / `br-floral-paper-aoa7pln0` |

Staging alias: `https://nutrimindv1-git-codex-staging-chimairels-projects.vercel.app`. Current ready deployment: `dpl_AAPD2QsCtZE2i8nGfYVgpACpdhMk`, superseding the initial `dpl_G3uQ3yGVQpsC57pNoGnos5LtcrjN` at `33455a61`. Vercel project: `prj_DxetpuW3fd5zY2ezP4wpdOtQrk8K`. Production branch tracking stays `demo`.

Only four Vercel overrides were added, all scoped to **Preview + codex/staging**: `NEXT_PUBLIC_API_URL=/api`, `INTERNAL_API_URL` pointing to the staging tunnel, the existing public Google client ID and `NUTRIMIND_DEPLOYMENT_MODE=capstone-demo`. The owner confirmed adding the staging alias to the existing Google Web client's JavaScript origins, preserving live origins. A complete OAuth round trip remains unverified.

Project-wide deployment protection remains enabled. A seven-day shareable link was created for the staging alias only; app authentication is still required. Its private URL is saved locally and must not be committed.

## Database preservation and migration evidence

Both new databases were restored independently from the same live snapshot started **October 16, 2026 at 07:13:38 UTC+8**. They do not continuously synchronize. Staging test actions will not be copied into the presentation database. New activity on live after the snapshot is absent from both copies.

The archive is 15,325,271 bytes; SHA256:

`b6d2c9f82ac30a7446d62b97ab43953092bb50bd141f7eabe0b666be043f4932`

Snapshot counts: 31 users, 11 accounts, 15 nutritionist profiles, 410 meal plans, 20 meal logs, 3 clinical clarification forms, 5 responses, 15,072 food records, 2,036 library records and 1,967 raw recipe candidates. The export transport timed out, but the completed archive passed a full transactional restore into disposable local PostgreSQL before cloud restoration. The interrupted first staging restore rolled back to an empty database; the saved archive was reused without another live export.

Presentation retains the source ledger: **110 rows, 109 successful plus one historical rolled-back entry**. Staging applies `20261015100000_member_assistant` and `20261015140000_water_residual_precision`: **112 rows, 111 successful plus that historical rolled-back entry**, no unresolved failed entries. Inherited migration names/checksums match the snapshot, and the two additional migration checksums match the exact candidate Git bytes. Previously documented delivery-format differences and unmatched baseline hashes were retained; no migration ledger rewrite or `db push` occurred.

The snapshot contains personal records. Credentials, encryption keys, dump, detailed receipts and access links remain in the private local task directory, excluded from Git. Keep the archive and its required document encryption key together securely; deleting or losing that local folder removes this local recovery material.

## Staging differences

- Independent signing, refresh and scheduler secrets; production-signed tokens are rejected. Retain the source document encryption key to read copied encrypted content.
- Removed 55 copied sessions and seven copied AI reservations from staging. Existing account credentials remain, but users must log in again.
- Paused 21 inherited generation jobs as failed with `STAGING_SNAPSHOT_PAUSED`, clearing retry time and processing token. This prevents inherited jobs from automatically replaying. It is an intentional staging-only difference.
- Nara enabled with weekly Free/Lifestyle/Health caps of 5/15/30. Conservative staging provider ceilings: global 2 RPM, 10 attempts per rolling day, one concurrent call, estimated 50,000 TPM; chat four attempts per rolling day with six reserved; background one RPM/two attempts per day. These are application ceilings, not guaranteed Gemini capacity.
- The Gemini credential still belongs to the same provider project. Separate databases do not isolate provider quotas. Local/live/other tools can consume that shared quota.
- Email delivery blocked using loopback port 1, push disabled, payments disabled and image-upload credentials omitted. New email registration, password resets, invitations, payment and admin image-upload workflows cannot be fully tested in this configuration. Existing account sign-in is the intended testing path.
- API initially ran the audited `33455a61` snapshot. It now runs a clean `git archive` of `c8675a14` compiled under `backend/.local/environment-isolation-20261016/releases/c8675a14/backend/dist/server.js`, with the same explicit private staging environment. Private `staging-release.private.json` pins the source SHA and runtime entry used by both startup and preview redeployment helpers. It does not load the shared checkout's ordinary runtime configuration.

## Verification and limits

At **October 16, 2026 07:58:53 UTC+8**, platform metadata confirmed production Vercel `dpl_J94qPJzuvYq7vT4TZBkpTjVZEsNw` and Railway `6fcbc98e-13cd-4b94-a2c8-48fb7997f4d2` still served `efdc6923`. Railway non-platform configuration values were unchanged, including its database binding. The final check used metadata and saved configuration comparisons, with no additional source-database SQL.

Staging HTTP checks passed for database readiness, anonymous 401, production-signature 401, member assistant access, RND/admin 403, free support help, AI-credit preflight without admission, member meal clarification reads, preview API rewrite and landing page. Valid short-lived tokens were issued by the staging server for these checks. Ordinary password login, OAuth round trip, browser rendering, real-device behavior, actual Gemini answers and new meal-swap/review mutations were **not** established by these checks. No real Gemini request or member credit spend occurred; receipt count stayed zero and the 553 inherited usage events stayed unchanged.

Quick tunnels require the laptop, API, tunnel and internet connection to remain available. Restarting the tunnel can change its hostname and requires updating/redeploying the preview. Requests showed several seconds of latency; no latency guarantee is made. Cloudflare documents quick tunnels as testing tools and does not support SSE on them; the app's polling fallback may refresh cross-user updates later. Immediate notification behavior was not verified. [Cloudflare quick tunnel limitations](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Local operation

Private task directory:

`C:\Users\chima\Desktop\Nutrimind\backend\.local\environment-isolation-20261016`

From PowerShell, resume:

```powershell
& 'C:\Users\chima\Desktop\Nutrimind\backend\.local\environment-isolation-20261016\resume-staging.ps1'
```

The helper verifies port/process ownership and starts hidden task processes. If the tunnel changes, it updates only the staging preview variables and redeploys the pinned candidate. Wait for that deployment to become READY. It needs the existing local Vercel CLI authentication and installed Node/cloudflared runtimes. It does not migrate or restore databases. Syntax validation and the already-running/no-deployment path passed; a full stopped-to-restarted cycle was not exercised.

Finish active test requests before stopping:

```powershell
& 'C:\Users\chima\Desktop\Nutrimind\backend\.local\environment-isolation-20261016\stop-staging.ps1'
```

The stop helper checks recorded process identities and stops only this API and tunnel. Cloud databases and the live site remain. Its syntax was verified; stopping was not exercised during handoff.

Private `staging-test-link.private.txt` contains the shareable test URL. If its seven-day access expires, renew the staging-only share link through the existing Vercel project; do not remove project-wide protection.

## Promotion gate

The owner should verify Google/password login, the Nara composer/confirmation/recovery, member meal swaps and the profile-versus-meal clarification cycle on staging. Confirm acceptable shared Gemini availability before presentation. Passing these HTTP checks does not imply every workflow is regression-free.

### Staging update at October 16, 2026 09:28 UTC+8

Candidate `c8675a14` adds the profile-dialog improvements, free planning/RND/water help and seven-day water history. Vercel confirms its preview READY on the same alias. The pinned API was compiled from the exact committed backend archive and restarted with the existing database/settings and tunnel; no new migration was required. This exercises API restart with a retained tunnel, not a full tunnel replacement/redeployment cycle.

HTTP checks return 200/SYSTEM/zero credits for the RND definition, the reported availability wording and water-history help. The preview progress response includes seven owner-scoped days with bounded entries. Before/after assistant receipts and usage counts are unchanged by those checks. No actual Gemini work was admitted. Production metadata/configuration remains at the original `efdc6923` deployment and database binding. These use short-lived server-issued test tokens; ordinary browser login and fresh visual layout checks are separate from HTTP verification. See [water history and local verification](WATER_HISTORY.md).

No live cutover is authorized by this setup. When staging is accepted, explicitly review the code SHA, database age, migrations, environment settings and rollback target before connecting an app to the presentation copy or promoting code to `demo`. Preserve environment-owned records; do not import staging test changes into presentation.
