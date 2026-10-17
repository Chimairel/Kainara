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
