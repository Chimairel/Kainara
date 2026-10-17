# Administrator-managed Nara instant answers

## Workflow

Open **Admin → Nara answers** (`/admin/nara`). Write an app-help or general-nutrition question, up to five alternative phrasings and a plain-text answer. Save the draft, try its wording in the editor, then publish. Alternatives can be in Tagalog/Bisaya; the response is the authored answer, not an automatic translation. Editing retains the previous published text. Unpublish or delete to stop serving it. Failed saves keep the input; reload after a stale-revision conflict.

Matching normalizes case, punctuation and the existing small typo vocabulary. It uses no substring similarity, embeddings or AI. Longer/mixed requests do not match a shorter question. Limits: 100 entries, six phrasings per entry, 240 characters per question and 2,500 per answer. A transaction lock prevents duplicate published normalized questions, including concurrent publication. Member replies use SYSTEM / No credit used and the existing animation. They remain available during AI cooldown and at zero credits.

`/ai` bypasses custom answers with existing confirmation/credit/recovery rules. Live personal status/clearance and explicit shortcut actions take precedence. Built-in help remains the fallback; custom content can replace matching general static explanations. Custom text never changes a profile, grants clinical clearance or activates clinical policy.

## Persistence and content scope

Reuse `WebsiteContent` with isolated `nara-answer-<uuid>` keys. Landing media keeps its existing key. No schema migration/dependency is required. Only authorized administrators can manage entries. Every mutation records actor/action/revision in the same transaction; stale writes return 409. Drafts never appear in member results.

Publishing stores normalized lookup keys. Member status projects those keys only; each reply fetches only matching published candidates and revalidates content/scope, failing closed on ambiguity. Answer bodies are not process/browser cached. Unpublication applies on the next server request. The browser question index uses the existing 60-second allowance cache and eligible focus/open/status refreshes. A new override can take until the next refresh to replace browser-local built-in help; reload the member page to refresh immediately.

Authoring conservatively rejects recognized personal-permission, treatment, protected-status, AI-command and unrelated questions. These lexical checks are not medical or semantic fact checking. Administrators remain responsible for accurate educational copy. Responses render as plain text. All members may receive them; do not enter private account/patient information. Synthetic QA answers remain environment-owned and must not be copied to demo.

## Local verification

- 69 affected backend tests pass. Backend build, tests TypeScript and scoped lint pass.
- 92 affected frontend tests pass: drafts/publication, alternatives/preview, stale saves, unpublication, zero-credit/cooldown custom routing, and existing typing/session/AI regressions.
- Fresh loopback PostgreSQL/HTTP verifies anonymous/member/RND denial, draft privacy, publish/edit/unpublish/delete, stale revisions, concurrent duplicate rejection, multilingual matching and audits. Five synthetic spent receipts remain unchanged; zero new credit reservations/provider calls. The disposable database is removed afterward.
- Four desktop/mobile/light/dark Chromium fixture journeys pass; screenshots are inspected. API responses are intercepted, not real sign-in. Fix the first failed fixture's unset optional cookie base URL before the successful rerun.
- Frontend production build/TypeScript, full frontend lint, architecture check and Impeccable detector pass. Unrelated pre-existing full backend lint limitations remain. No demo tests or operations.

Clean candidate/local/staging rollout evidence follows when complete. Demo remains `484de97d` until separately authorized. Existing `MEMBER_ASSISTANT_ENABLED=true` is required for member access; no new rollout flag or content seed is needed.

## Verified local and online-staging release

Commit **`eb91ee7dc021ae7531d5b3b4feec3ce317e9c7d1`** is on development and `codex/staging`. Build both packages from its clean Git archive, excluding all unrelated shared-checkout work. Both builds succeed; Windows retains the existing standalone dependency-junction trace-copy warning. Normal localhost serves that archive's frontend on 3000 and full API on 5000 against loopback PostgreSQL; frontend HTTP 200 and unauthenticated admin API 401 pass. This does not prove a portable Windows standalone bundle or fresh OAuth login.

Vercel staging **`dpl_5GTfxdoNWuJwhuQA6isEEG3Mipha`** is READY and the actual branch alias resolves to it at the exact SHA. Restart the laptop's Cloudflare tunnel and update only the `codex/staging` preview-scoped `INTERNAL_API_URL`; preserve the existing `/api` public setting and production configuration. No migration is needed because the committed Prisma structure is unchanged.

At **20:28 UTC+8, October 17**, eleven actual preview HTTP assertions pass: app-layer anonymous/member denial, private draft, publication, question index, multilingual zero-credit/cooldown answer, `/ai` confirmation, unpublication and deletion. Five synthetic prior spent receipts remain unchanged, provider-event delta is zero, and temporary content/accounts are removed. The first attempt incorrectly supplies the existing share-link metadata as an automation-bypass header; discard that failed run, obtain the existing share-link cookie through its proper flow, and require application response envelopes in the successful rerun. Do not treat a Vercel access response as an app authorization check.

During this bounded FAQ check, the staging API uses the exact compiled app with background workers and provider keys disabled in its process. Afterward restore the standard staging server launcher at the same commit, preserving the original staging environment file and normal worker/provider configuration. The normal runtime is separate from the zero-provider verification receipt. The tested FAQ route does not need background work. Localhost also uses the same clean candidate; committed code parity with staging passes while unrelated dirty files remain excluded. No actual browser sign-in or provider response is claimed.

Demo remains **`484de97d`**: no demo deployment, requests, SQL checks, configuration changes or content publication. Custom entries are separate in each environment. After an authorized promotion, the admin should author/publish intended content in that environment; QA fixtures are not release data. Private detailed receipts are in `backend/.local/guidance-update/`, excluded from Git.
