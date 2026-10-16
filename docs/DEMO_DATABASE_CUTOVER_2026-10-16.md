# Demo database cutover — October 16, 2026

## Authorization and current topology

After accepting staging, the owner explicitly selected **“Switch live after a fresh backup.”** The existing live Vercel/Railway projects now serve the tested release using a fresh copy of live records in the separate presentation Neon project. No staging test activity was promoted.

| Environment | Code / hosting | Database |
| --- | --- | --- |
| Live, `https://www.kainara.site` | Existing Vercel `nutrimindv1`, production branch `demo`; existing Railway service | Neon `late-grass-59329912`, branch `br-floral-paper-aoa7pln0`, **`kainara_demo`** |
| Staging | `codex/staging`, existing Vercel preview and laptop API/tunnel | Neon `dark-cake-36096216`, branch `br-royal-sky-azsc3kcv`, `neondb` |
| Previous live preservation | No active application binding after cutover | Neon `nameless-dust-38810716`, branch `br-round-art-b355gp02`, `neondb` |
| Initial presentation preservation | Unconnected 07:13 snapshot, retained separately from the final database | Neon `late-grass-59329912`, branch `br-floral-paper-aoa7pln0`, `neondb` |

`https://kainara.site` retains its 308 redirect to `https://www.kainara.site`. The public proxy checks below use the canonical host. Production branch tracking remains `demo`. No new Vercel/Railway project, paid plan, billing upgrade or OAuth-origin change was required for this cutover.

## Fresh backup and data verification

Times below are **UTC+8 on October 16, 2026**.

- **10:19:15:** stopped the old Railway deployment to freeze application writes. Service/project configuration remained available. This was a maintenance interruption; the site/API was not continuously available during the copy/build.
- **10:19:35–10:20:23:** exported the original live database after the deployment was confirmed removed. Archive size **15,325,159 bytes**, SHA256 `bee23e9610f5eaac18f39d440ddb8390f3836321a8da058792b5968273a83293`.
- Rehearsed a full transactional restore into disposable local PostgreSQL, then restored that same archive once into the empty hosted `kainara_demo`. No source-database write, new test seed or staging import was performed.
- The hosted restore command transport timed out after 600 seconds while its original container process continued. It was not started again. Completion was established from the original process ending, the single transaction committing the full schema, comparison with the full local restore, and matching record counts/digests for all 13 tables below. A normal remote command exit status was not recovered and is not claimed.
- **10:38:15:** final data/migration verification completed. **10:46:22:** both hosting platforms reported the new release ready/successful. **10:47:18:** bounded live HTTP checks passed. This brackets restoration of checked service availability; it is not an exact downtime measurement.

| Fingerprinted table | Fresh backup / restored count |
| --- | ---: |
| User | 31 |
| UserProfile | 12 |
| Account | 11 |
| NutritionistProfile | 15 |
| Session | 55 |
| MealPlan | 410 |
| MealLog | 20 |
| WaterLog | 0 |
| ClinicalClarificationForm | 3 |
| ClinicalClarificationResponse | 5 |
| FoodItem | 15,072 |
| MealLibrary | 2,036 |
| RawRecipeCandidate | 1,967 |

The entire archive was restored, not only these tables. These 13 table comparisons provide bounded identity/content checks rather than a claim that every table received a separate digest comparison. Source sessions, accounting and background jobs were preserved; the staging-only session/reservation cleanup and job pause were not applied to live. The earlier 07:13 archive and original hosted database remain intact.

### Schema

The final ledger has **112 rows: 111 successful and one historical rolled-back entry**, with no unresolved failed entry. All inherited migration names/checksums were retained. Additive migrations `20261015100000_member_assistant` and `20261015140000_water_residual_precision` match the exact tested Git bytes. Previously recorded historical checksum/delivery differences were preserved, not rewritten. No `db push`, reset or seed was used.

## Release identity and configuration

| Evidence | Identity |
| --- | --- |
| Tested source tree | `c8675a149969177bd8f42ba8f0a57c4672b20f19` |
| Actual production release | `7b96e8b5b2d698e90f52aa9ef2003425c0b655cb` |
| Vercel production READY | `dpl_9uTdkbgXSjNXX1h8oYricKBWARRh` |
| Railway SUCCESS | `28fa4922-daf2-464e-a244-702056a3342c` |
| Previous compatible code | `efdc6923c300dde0a1f25b1eb0a2dbb52c74b03f` |
| Previous Vercel / Railway deployments | `dpl_J94qPJzuvYq7vT4TZBkpTjVZEsNw` / `6fcbc98e-13cd-4b94-a2c8-48fb7997f4d2` |

The production merge commit has the previous production and tested candidate as parents. Its complete tree equals the tested candidate; a normal fast-forward push updated `origin/demo`. No checkout switch, forced push, unrelated working changes or conflict-generated code entered the release. Staging stays at `c8675a14`.

Eight Railway variables changed: `DATABASE_URL`, `DIRECT_URL`, `MEMBER_ASSISTANT_ENABLED`, the three `MEMBER_ASSISTANT_*_WEEKLY_CREDITS`, `MEMBER_ASSISTANT_PROJECT_RPD`, and `MEMBER_ASSISTANT_CORE_RESERVE_RPD`. The pooled/direct URLs now select `kainara_demo` in the final project. Nara is enabled with weekly Free/Lifestyle/Health allowances **5/15/30**. Existing membership and clarification flags remain enabled.

Global Gemini ceilings remain **2 attempts/minute, 40 attempts per rolling day**, estimated 50,000 TPM and one concurrent call. Nara has **20 attempts/day with 20 reserved for core workflows**; the existing background limits remain. These are application controls, not a guarantee of Google's quota or capacity. Local, staging and live still share the provider project; separate databases do not isolate that quota.

All other non-platform variable values were compared equal before/after and read back again at **10:48:07**. Existing signing/refresh, document encryption, Google, Gemini, email, push, payment, storage and CORS settings were preserved. No local/staging signing credentials replaced live secrets. Database URLs/credentials, auth exports and provider secrets are excluded from this document.

## Verification and practical limits

The preceding candidate verification includes 1,152 backend passes with one existing TODO, 297 affected frontend passes, both builds, scoped lint, guide parity and a disposable SQL water-history regression. See [staging evidence](STAGING_AND_PRESENTATION_2026-10-16.md) and [water history](WATER_HISTORY.md).

After both production hosts became ready, checks through the actual public frontend proxy passed for:

- Direct API database readiness; anonymous 401; staging-signature token 401; eligible member assistant access; RND assistant 403.
- Three prepared replies: RND definition, the reported planning-unavailable wording and water-history navigation. Each returned SYSTEM with zero credits.
- `/ai Explain protein in meals` with `allowAi=false`: fresh credit confirmation required, no provider admission.
- Member progress with seven Manila days and at most 50 water details/day; member meal clarifications; eligible RND profile-review queue; public landing page.
- No assistant receipt for the verification request identities; zero provider work/credit spending from these checks.
- Current live configuration, canonical redirect, production branch/deployment and unchanged staging Git identity.

These authenticated checks used privately issued short-lived server tokens. They do not establish a new ordinary password login, Google OAuth round trip, browser rendering, real mobile keyboard behavior, an actual Gemini response, or a fresh live meal-swap/clinical mutation. The owner's earlier staging acceptance and prior swap test are separate evidence. No claim of exhaustive regression freedom or clinical validation is made.

## Preservation and recovery

Private archives, credentials and detailed receipts are under `backend/.local/environment-isolation-20261016/cutover`, excluded from Git. Preserve the local archives with the required document encryption key securely; losing this folder removes those local recovery materials. Original hosted data is also retained separately.

The previous deployment IDs/code and privately saved original Railway settings provide a recovery reference, not an automatic rollback. Live activity after cutover belongs to `kainara_demo`. Switching back to the old database or restoring the snapshot without reconciling new records would lose that activity. Prefer a compatible code correction against the new database; any database rollback needs a new backup and deliberate reconciliation. Staging remains independent and must never overwrite live records.
