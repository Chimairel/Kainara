# Shared normal-use runtime release — October 12, 2026

## Release

The owner approved normal localhost use of the live defense database, isolated automated tests, matching application behavior, and continuation of the pending release. Implementation and verification used `C:/Users/chima/Desktop/Nutrimind`. Published tested application commit **`3a07a42c43f5e533bf096b6cadfbebf26d3c05ce`**; `demo` was advanced without force. Unrelated uncommitted shared-folder edits were preserved and excluded from the Git deployments.

| Component | Verified deployment | Application commit |
| --- | --- | --- |
| Railway API | `d3b17ffc-608e-4a5b-a147-8ccb88ee398f` — SUCCESS | `3a07a42c43f5e533bf096b6cadfbebf26d3c05ce` |
| Vercel frontend | `dpl_3m29sW25nTa1CkBKERNS4wrXXbne` — READY | `3a07a42c43f5e533bf096b6cadfbebf26d3c05ce` |

Public aliases include [www.kainara.site](https://www.kainara.site) and [kainara.site](https://kainara.site). The API was deployed first (`c21a309a-3594-47ae-83d6-6e92b954a3e6`, SUCCESS), and `/ready` returned 200 before promoting `demo`. That promotion triggered a second successful Railway deployment of the same commit, recorded above. Vercel subsequently built the exact Git commit in its production environment. Project metadata briefly retained a BUILDING snapshot after deployment readiness; the deployment endpoint and CLI independently confirmed READY and the public aliases.

This release includes the prior tested restoration, onboarding/feedback updates, local actor defect fixes and practical replacement/food-guidance implementation. No migration, restore, clinical decision or saved-plan repair was performed during this release. The schema/migration diff from the preceding live release is empty.

## Database and configuration parity

- Normal localhost API at port 5000 and Railway select Neon project `nameless-dust-38810716`, main branch `br-round-art-b355gp02`, database `neondb`. Both select the same endpoint/database and retain the same document encryption key, compared privately.
- Localhost matches live's nine checked behavior settings: capstone-demo mode, membership, clinical clarifications and six AI quota settings. Normal-use localhost no longer exposes the development-only synthetic-account creation feature. Synthetic browser journeys and automated mutations remain on the isolated loopback database/API at port 5001.
- All 47 deployed Railway variables compare unchanged before/after. Vercel environment configuration compares unchanged; no environment update command was issued. Signing, refresh, scheduler, document and provider secrets were retained.
- Local origins, ports, development compilation and production transport settings remain environment-specific. Sharing records does not automatically synchronize future code edits: subsequent application changes still require a tested release. Uncommitted shared-folder edits are outside the verified application commit.

## Verification

- Existing implementation evidence: backend 993 passing tests, zero failures and one existing TODO; frontend 1,015 passing tests plus eight Node checks. Actual isolated member/RND/admin journeys, provider simulation distinctions, PDF parity and screenshots are recorded in [the implementation report](PRACTICAL_REPLACEMENTS_FOOD_GUIDANCE_2026-10-12.md).
- This release: frontend production build passed with all 62 pages generated, in addition to the already passing backend build. Both hosted builds used the exact committed source, excluding local uncommitted edits.
- Local `/ready`, local `/login` and hosted `/ready` returned 200. Local `/health` confirms capstone-demo mode.
- One ordinary-login public browser smoke completed at **2026-10-12 07:34:28 UTC**: mobile member dashboard/progress/planning, RND reviews/library and admin overview/meals. There were 51 API responses, no browser page errors, no API 5xx responses and no horizontal page overflow. Staff library list/detail images and verification labels agree, and both checked photos loaded.
- The existing restricted synthetic member returned one 422 on `/api/user/meals/current`. A targeted authenticated local/live comparison confirmed **`CLINICAL_EVIDENCE_REQUIRED`** in both environments at **07:39:00 UTC**, with matching saved profile identity, revision, calorie target and readiness. These fields were required to be present before comparison. This is the retained clinical gate, not a successful meal-clearance check.
- No forms, acknowledgments, claims, clinical decisions, profile edits, new synthetic accounts or explicit generation requests were submitted on live. Ordinary login/access records and normal background processing remain application behavior. Repeated mutation/provider/load testing stayed isolated.

Private evidence is in `backend/.local/mvp-20261012/`: deployment/configuration snapshots, `guidance-release-live-smoke.json`, role screenshots and `shared-runtime-parity.private.json`. Credentials and clinical payloads are not included in this tracked release record.

## Reported usage

One explicit-project Neon read at **2026-10-12 07:33:38 UTC** reported **1,016,933,393 transfer bytes**, **19,478 compute seconds**, and `data_storage_bytes_hour=0`. Reported transfer is **20.34%** of the conservative 5,000,000,000-byte operating budget, below the 50% warning threshold. The project response does not confirm the account's transfer allowance; counters can be delayed, and zero storage-byte-hours is a reported value rather than proof of no storage use. The reported billing period ends November 1 UTC. No Free consumption-history request was made. Existing daily monitoring continues through October 16.

## Rollback and local fallback

The immediately preceding compatible application pair is commit `8def2a0872e71b37c408b8d6d0e5f75235d40fa0`: Railway `a4a01519-303c-4b1e-9509-86a92a980634`, Vercel `dpl_9mcxgbtKF5Dd3drFS3iJ9wfuXG8b`. For a regression, redeploy that exact backend commit against the existing defense database, verify readiness, then promote the corresponding previous production frontend. Preserve current secrets and member activity; no database restore is required for this code rollback. It removes the new guidance/replacement fixes, so prefer a focused forward fix when appropriate.

The isolated local database remains available for tests and a deliberate offline defense fallback. **Normal localhost now shares Neon**; using localhost alone does not bypass a hosted database outage or transfer quota. Before an offline fallback, select the verified loopback database configuration explicitly and verify readiness/login, preserving the private hosted settings for restoration. The earlier recovery record's statement that ordinary localhost runs an independent database is superseded by this owner-approved configuration.
