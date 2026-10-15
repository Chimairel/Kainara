# Nara daily records and calculation guide

Date: October 16, 2026 (Asia/Singapore). Branch: `codex/member-assistant`. Base: `0dad1a0f`.

## Scope

- Prepared free answers explain energy calculation, activity/goal adjustments, macro planning, meal allocation/ranges, serving/rice scaling, meal selection versus approval and planned versus consumed totals. They describe executable draft planning behavior, not clinical validation or a new personal prescription.
- Conditions/settings questions link to Health & goals. Meal completion help explains clearance, questions, flags, changed safety evidence, future dates and the existing seven-day retrospective logging window without inferring a diagnosis or weakening a gate.
- Correct meal/profile question destinations: Meals versus Health details. Unknown app help, unsupported scope and missing food-composition matches include the inline Help support link.
- Free authenticated `CURRENT_MEALS` and `GROCERIES` actions work with zero credits and during AI cooldown, without a receipt, reservation or provider request. Current meals use owner/current-cycle/Manila-day scope, exclude cancelled/superseded rows and distinguish planned clearance from consumption. Explicit primary meal types narrow the read; no assumption of what the member should eat now.
- Groceries supplies a day projection from the same cleared meals and aggregation used by the cycle checklist, including recorded rice. Nara consumes that projection and links to the selected date. The page filters the loaded projection without requesting it again per selection. Other dates in chat direct to the selector instead of silently returning today.
- Day requirements are read-only and preserve unknown amounts. They do not subtract guessed pantry inventory or record a cycle purchase. All days retains existing purchases, pantry state, bulk actions and cycle PDF. Frozen cycle purchases and later-cleared day requirements can differ. Hidden/stale lists expose no day projection. Existing read services can synchronize lifecycle/rebuild a list; chat does not execute member actions.
- No schema or dependency change; no embeddings/vector storage. Static browser/server guides remain generated from one source.

## Verification

- 57 affected backend tests pass, zero failures, including new routing/wording, current-day owner scope, zero-credit/cooldown free reads and shared day aggregation. Existing grocery purchase and assistant safety tests remain included.
- 63 affected frontend tests pass across eight files. Coverage includes date quantities, no checkboxes/PDF in day view, returning to cycle purchases, unavailable date links, no fetch per date selection, owner changes, existing checklist rollback and free dynamic reads at zero credits during cooldown.
- Backend production build, backend tests TypeScript, frontend production build, scoped backend/frontend lint, generated-guide parity and whitespace checks pass.
- Fresh disposable `127.0.0.1:55432/kainara_assistant_20261015`: all 111 migrations applied, **12 HTTP/PostgreSQL acceptance scenarios pass**. New scenario verifies actual current menu, held meal exclusion, today's 100 g requirement versus tomorrow's 200 g and cycle's 300 g, no provider/receipt for free reads, and existing credit/role/replay/concurrency gates. Provider output is stubbed and external fetches are blocked. Synthetic accounts are confined to that database.
- Browser on isolated API 5101 / frontend 3101: ordinary synthetic member sign-in, current menu with cleared/held labels, exact owner ingredient wording, no-credit answers, day link, two date quantities, prepared calculation help, Health & goals link and Help fallback inspected. Desktop 1440×1000 and mobile 400×808 day views inspected. Impeccable detector returned no findings. Viewport reset, preview tab closed and both temporary servers stopped.
- Preview setup correction: the first temporary Next server shared `.next` with the already running normal localhost server. It produced conflicting-route/sign-in behavior. Restarting the temporary server with `NUTRIMIND_REPAIR_E2E=true` (`.next-repair`) resolved the preview conflict. Normal localhost processes were preserved. This is a local preview isolation issue, not evidence of a hosted authentication defect.

## Release boundary

Feature branch only. No Neon reads/writes, real Gemini calls, hosted migrations, feature-flag changes or demo deployment. Nara remains unreleased. Existing local test records and the exact earlier capstone documentation handoff are independent artifacts. Tests are software evidence, not clinical approval or general language-understanding validation.
