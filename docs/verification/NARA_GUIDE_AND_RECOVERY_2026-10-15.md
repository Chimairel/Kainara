# Nara help, nutrition and refresh recovery — October 15, 2026

Branch: `codex/member-assistant`. Owner approved applying the [system audit](NARA_SYSTEM_AUDIT_2026-10-15.md), temporary refresh persistence and removal of the green composer highlight. Implementation uses the shared checkout and preserves unrelated working-copy changes.

## Changes

- Expanded the single canonical, generated browser/server guide: Contact Support, registration and email recovery, check-ins, Health details, RND feedback, review states, missing/repeated meals, report acknowledgment, rice totals, photos, trial/checkout, allowance distinctions, grocery holds, exports and related navigation. Specific instructions take priority over generic topics. Common English and selected Tagalog/Bisaya aliases are tested. Open-ended subjects can reach consent-based interpretation without a hardcoded food-name vocabulary; uncertain explicit app questions remain free.
- Added strict `FOOD_FACTS` and `NUTRITION_QUESTION` interpretations with actual handlers. Food composition uses existing bounded FNRI/USDA queries, verified aliases and whole-word filtering. Ambiguous/truncated matches ask for specificity. Values are recorded per 100 g with available additional nutrients; piece weights and missing nutrients are not invented. Public composition results share the existing invalidation-aware ten-minute cache, capped at 64 terms. No vector index or duplicated catalogue was added.
- General education receives short curated WHO healthy-diet and FoodSafety.gov excerpts. Links are selected by validated source IDs, not generated URLs. It is not unrestricted web search. Interpretation plus explanation costs the same one successful member credit and at most two bounded provider attempts. Current capacity, eligibility, receipt identity and credit-locking rules remain intact. Actual-model language quality and clinical interpretation remain unverified by this mocked run.
- Recent conversation, draft, open state, unconfirmed consent and interrupted request key survive refresh through account-keyed sessionStorage. Limits: 40 messages, 80,000 serialized characters and a fixed 24-hour lifetime. Expired/invalid data is discarded on read/write. Storage-denied/quota conditions fall back to memory. Explicit login, sign-out, invalid authentication, account deletion and account switching clear private saved chat; New chat clears history without resetting usage. The existing layout remains keyed to the authenticated owner.
- Restored answers carry an earlier timestamp. Balances and permissions are freshly checked and never hydrated from storage. An interrupted paid request is recovered by owned `GET /api/user/assistant/requests/:requestKey`; it cannot reserve credits or invoke AI. One restore lookup, then explicit **Check reply** for running or uncertain delivery; no polling, automatic provider retry or persisted automatic consent. Completed results deduplicate by request key and use the original server completion time. A not-yet-found receipt is not presented as proof of no spending.
- Removed the composer's green ring and inner square highlight. A neutral rounded boundary retains focus visibility. Additional nutrient facts expand on demand and references use the generic **Sources** label. Restored user timestamps inherit their bubble foreground for light/dark contrast. Impeccable inspection covered desktop and emulated mobile; physical-device keyboard behavior was not exercised.
- Corrected public getting-started, clinical-guidelines and data-protection text that still advertised retired clinical uploads; corrected the retired two-RND quarantine requirement. Added a factual Nara storage/provider/receipt explanation to the privacy guide.

## Water migration and evidence

The service previously removed an entire entry when subtraction left less than 50 mL. The existing SQL constraint also prohibited a positive residual below 50 mL, so a code-only change would fail against real PostgreSQL. Migration `20261015140000_water_residual_precision` changes the stored range to **1–2000 mL**. API additions/removals still accept **50–2000 mL**; only retained residual precision changes.

Applied through the guarded local-database command only to `kainara_local_development@127.0.0.1:55432`, now 110 migrations. A real PostgreSQL transaction created a synthetic user and 275 mL entry, invoked the actual removal service using the transaction client, and confirmed a 250 mL removal retained 25 mL. The transaction was rolled back and absence of the synthetic user was verified. No member water record was changed. Publish the migration before the new API during an authorized release; old API readers can read the smaller positive residuals.

## Verification

| Check | Evidence |
| --- | --- |
| Full backend unit suite and test typecheck | 1,112 pass, zero failures, one existing clinical-policy TODO; 1,113 registered |
| Full frontend suite | 1,238 Vitest tests in 239 files plus eight Node dependency/worker tests pass |
| Focused Nara checks | 25 backend and 32 frontend tests cover wording, no-consent/no-provider behavior, source/basis/missing values, false substring matches, cache invalidation, receipt ownership and states, water residuals, storage bounds/expiry/corruption, account separation, logout, pending consent and recovery without POST replay |
| Production builds and scoped lint | Both builds and scoped backend/frontend ESLint pass |
| Guide parity / architecture / API inventory | Canonical/generated parity passes; architecture budgets pass; source contract inventory finds no unmatched extractable call |
| Actual local composition retrieval | “pandesal” resolves to `Bread, pan de sal`, DOST-FNRI, with 17 recorded nutrients. Whole-word checking excludes unrelated “salvadoran” and “salpora” records. This used bounded local reads without Gemini. |
| Browser, local synthetic member | “how to report issue?” returns Contact Support for free. Refresh restores its messages, open panel and unsent draft with earlier timestamps. The pandesal question reaches AI consent; another refresh retains unconfirmed consent and Cancel works. Balance remains 40/40. Composer computed shadow is `none`, inner border is transparent and the outer focus boundary is neutral. |

Browser screenshots: local `codex_outputs/nara-refresh-desktop-20261015.png`, `nara-refresh-mobile-20261015.png` and `nara-refresh-mobile-dark-20261015.png`. Temporary test/build/lint logs use the `codex_outputs/nara-*` prefix and remain uncommitted. Tests use mocked providers and isolated unit persistence; paid-response recovery is covered by mocks rather than a real paid Gemini request. Existing clinical-policy approval remains a separate gate.

After the full-suite/build run, final inspection found that definite pre-admission credit/rate/disabled rejections could leave the composer waiting for a receipt that never existed. Those known codes now clear recovery; ambiguous failures still recover through GET. The final 32-test assistant suite, frontend typecheck and scoped lint pass, including a new exhausted-credit race regression. The full frontend count above is the preceding 1,238-test run, before adding this regression. The local API was restarted from the verified build; final desktop proof shows the neutral focused composer with restored messages and an unsent draft.

Local Docker, API and frontend had stopped and were restarted using the existing isolated runtime and loopback guard. No Neon query/migration, hosted configuration change, email, payment, clinical decision or real Gemini call was made. No new normal-use account or chat transcript table was created.

## Release boundary

This is a feature-branch/local implementation. Demo is not updated. An authorized promotion must include the water migration, compatible API/frontend code and the previously required assistant migration/activation, then follow [local/demo parity](../DEMO_RELEASE_PARITY.md). Session history remains browser-tab owned and is not copied between environments. Do not restore the local database over Neon.
