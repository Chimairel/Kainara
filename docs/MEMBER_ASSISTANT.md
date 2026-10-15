# Member assistant

Branch: `codex/member-assistant`. Status: implemented on this feature branch; shared/hosted activation is separate.

## Accepted design

- Member portal only. **Nara** reuses the existing Tanod mascot as the floating chat button and chat identity. The button clears the mobile bottom navigation; its accessible name is **Open Nara chat** and tooltip is **Chat with Nara**. Member bubbles and their current profile avatar sit on the right; Nara's bubbles and static portrait sit on the left.
- At desktop widths (1280 CSS pixels and above), a drawer starts at 420 px and overlays the workspace, flush with the right and bottom edges, without resizing the page. Drag its left edge or focus the resize separator and use Left/Right (24 px), Home (360 px) or End (up to 800 px, preserving 320 px of workspace). Width is retained in the authenticated layout across closing/reopening, without browser storage. Its top sits below the portal header, leaving the theme toggle and notification bell accessible; header menus stack above the assistant. It slides in from the right in 280 ms and closes in 180 ms, with immediate transitions for reduced motion. Closing content becomes inert during its exit. Smaller widths use a full-screen dialog with keyboard focus containment. The chat header and composer stay fixed while messages scroll.
- The closed launcher alone tracks the pointer. The open header faces front, loops upper left → front → upper right every 700 ms while awaiting a response, and uses the existing dizzy reaction while a request error or exhausted-credit confirmation is present. Retry, cancellation or New chat restore the appropriate state. Thinking pauses in hidden documents and remains front-facing for reduced motion; message portraits never track or animate. Artwork is decorative; text statuses and recovery controls remain accessible.
- KAINARA's current light/dark tokens, fonts, shared buttons and Solar icons are reused. No new dependencies, illustrations, vector database or duplicated food catalogue.
- The panel contains New chat, Close, free shortcuts, bounded conversation history, meal details, saved-guidance references, AI consent and recoverable errors. Closing/navigation preserve draft and conversation in the authenticated layout. Reload ends that in-memory conversation; signing out/account changes unmount it and abort pending browser requests. New chat clears context, never usage.
- Internal result links dismiss the covering dialog below 1280 CSS pixels so members can read the destination. Desktop navigation preserves the dock; both retain conversation state.

## Hybrid routing and credit consent

`GET /api/user/assistant` reports rollout status and the authenticated member's current allowance. `POST /api/user/assistant/messages` accepts a UUID request key, message (1000 characters maximum), optional fixed action, `allowAi` (false by default), and at most six context messages of 500 characters each. No caller-supplied owner, membership, tool names or arbitrary URLs are accepted.

Free shortcuts: Find a meal (opens the search conversation), Today's nutrition, My nutrition guidance, and View my plan. Narrow greetings/help/credit FAQs and equivalent direct commands also return prepared system responses. **Free requests have no confirmation prompt and never call Gemini.**

Unrecognized text first returns an inline confirmation: **This request uses 1 AI credit**, current balance, Continue and Cancel. This preflight does not reserve a credit or call Gemini. Only explicit `allowAi: true` proceeds. Cancel does not create a receipt or call the provider. A completed-response retry is recovered before asking for another credit.

| Current entitlement | Weekly AI credits |
| --- | ---: |
| Free / trial not yet started / membership rollout disabled | 5 |
| Lifestyle | 20 |
| Health / active Health trial | 40 |

No member daily reply cap. Weekly windows run Monday 00:00 to Monday 00:00 Asia/Manila. Credits do not roll over. Existing usage is retained across upgrades/downgrades. One successful AI-assisted request spends one credit, including requests where AI asks a clarification or identifies unsupported scope. Failed/expired attempts do not spend member credits. A guidance explanation can make two bounded provider calls for that one member credit. Provider attempts still consume shared capacity even when member work fails.

## Data and safety boundaries

- Natural language is interpreted into a strict intent/filter schema. Existing code performs retrieval, eligibility and arithmetic. Supported recipe filters: name, meal type, included/excluded ingredient keywords, protein minimum, energy maximum, fat maximum. Ambiguous qualitative limits and other nutrient operators require clarification; no guessed numeric thresholds.
- Results use the existing compatible certified library query with its base verification, current profile, allergy, condition, flag and clearance gates. This first version searches that compatible library; the wider browse-only raw-source catalogue is still available in the existing Meal Library screen. AI cannot add a source meal or grant approval. Displayed recipe-serving nutrition excludes separately paired rice.
- Numeric recipe filters compare at the same one-decimal precision displayed in chat. Existing medical admission checks and stored measurements retain their authoritative values.
- Today's totals use owned, non-voided DONE logs and the existing nutrition eligibility predicate, with Asia/Manila day bounds. Missing logs are not inferred; incomplete entries are explicitly described as partial.
- Guidance comes from the member's acknowledged active planning report and preserves the current policy/safety revision checks. Direct guidance is free. AI explanations receive only bounded saved guidance and recent conversation; external source links come from saved references, never model-created citations.
- No chat action changes meals, logs, targets, profile or RND decisions. Links open existing screens. Clinical advice/diagnosis/clearance requests are outside scope.

## Persistence and abuse controls

Additive migration `20261015100000_member_assistant` adds the `MEMBER_ASSISTANT` usage operation and `AssistantRequest` receipts. Receipts contain owner, request key, payload digest, state, times and bounded result payload for retries. Full prompts and chat transcripts are not stored in this table or browser storage. Personalization is per authenticated request.

A PostgreSQL advisory transaction lock per member serializes admission across API instances. Active reservations consume available credits until completed, failed or expired (90 seconds). One active AI request per member; at most three AI admissions per rolling minute. A separate 30 requests/minute route limiter bounds direct/preflight traffic, in addition to the existing API limiter. Request keys bind to the payload and authenticated owner; changed-payload reuse is rejected.

Receipts older than eight days are removed on the member's next AI admission and by the daily check-in cron while the feature is enabled. Operate that existing cron to enforce cleanup for inactive users. Export includes retained receipts when enabled; account deletion cascades them. Disabling the rollout pauses its cron cleanup too; purge retained receipts before a prolonged shutdown if required.

Each provider call passes through existing project-wide capacity admission. Chat additionally defaults to **10 provider attempts per rolling 24 hours**, capped so **20 project requests remain outside chat** under the default 40-request project limit. Member credits do not guarantee immediate provider capacity. Each model call has a single attempt, the existing 15-second provider timeout and an explicit output-token ceiling; no hidden fallback cascade or automatic browser retry. At most two calls per assistant request.

## Rollout

1. Review/apply the additive migration to a confirmed target, using `prisma migrate deploy`; regenerate Prisma clients for all API/worker instances. Do not use `db push`.
2. Deploy the compatible code with the assistant disabled, then enable after all readers support the new enum value. Default: disabled. Existing portals continue operating without the new table when disabled.
3. Set `MEMBER_ASSISTANT_ENABLED=true`. Optional settings:
   - `MEMBER_ASSISTANT_FREE_WEEKLY_CREDITS=5`
   - `MEMBER_ASSISTANT_LIFESTYLE_WEEKLY_CREDITS=20`
   - `MEMBER_ASSISTANT_HEALTH_WEEKLY_CREDITS=40`
   - `MEMBER_ASSISTANT_PROJECT_RPD=10`
   - `MEMBER_ASSISTANT_CORE_RESERVE_RPD=20`
4. Verify normal member login, free action without consent, AI consent/cancel, one confirmed response, idempotent retry, current membership allowance and cleanup scheduling. Existing Gemini credentials/capacity configuration apply.

This feature branch has not applied its migration to Neon, changed hosted secrets, or deployed the assistant. Isolated tests use synthetic data and stubbed provider responses; these do not establish real-model language quality or clinical validation.

## Verification

### Nara conversation UI — October 15, 2026

The Nara identity, member/right and Nara/left bubbles, profile-avatar fallback, desktop resize controls, mobile dialog and light/dark presentation were checked on isolated localhost. Main-content bounds matched exactly with chat open and closed. The 13 focused frontend tests cover existing consent/lifetime behavior plus gaze order, front-facing recovery, hidden-document/reduced-motion handling, dizzy artwork for errors and zero-credit requests, pointer capture, keyboard resizing and viewport bounds. Scoped ESLint and the frontend production build/TypeScript passed; the Impeccable layout scan reported no findings. Captures: `codex_outputs/nara-chat-desktop-20261015.png` and `nara-chat-mobile-dark-20261015.png`. UI verification used a free shortcut; no Gemini request or hosted/database change was made.

### Normal localhost activation — October 15, 2026

The owner chose the isolated local database. Ports 3000 / 5000 now serve the member assistant against `kainara_local_development@127.0.0.1:55432`, with all 109 migrations applied and its local flag enabled. The older local records are separate from demo. No Neon migration or hosted rollout was performed. Local API/database verification and ordinary browser login confirmed the launcher, desktop dock, free totals and AI credit confirmation/cancellation. The existing Health fixture retained 40/40 credits; no provider call was made. Runtime and rollback instructions are in [local development](LOCAL_DEVELOPMENT_AND_DEFENSE.md#current-local-runtime--october-15-2026).

The subsequent desktop overlay refinement preserves identical main-content bounds with chat closed/open, places the panel below the portal header and keeps the notification dropdown above it. Light/dark desktop and mobile-dialog browser checks pass, along with seven assistant tests, scoped ESLint, the frontend production build/TypeScript and an empty Impeccable layout scan. Screenshots: `codex_outputs/member-assistant-overlay-light-20261015.png`, `member-assistant-overlay-dark-notifications-20261015.png` and `member-assistant-overlay-mobile-20261015.png`. No provider request or hosted release was performed for this layout change.

- Focused backend policy/service tests cover consent default, strict inputs/context, direct routing, weekly boundaries, tier caps/upgrades, combined recipe constraints, disabled rollout, provider faults, shared capacity and replay.
- Frontend tests cover free actions, confirmation, duplicate clicks, cancellation, draft/history lifetime, new chat, account unmount cancellation and exhausted credits.
- `backend/scripts/member-assistant-local-acceptance.ts` refuses all targets except the named task-owned loopback database. It tests real HTTP/auth, PostgreSQL entitlements/receipts, concurrency and authoritative meal admission using provider stubs and blocks external fetches.
- Run it with `npm run test:acceptance:member-assistant` only against a fresh migrated `127.0.0.1:55432/kainara_assistant_20261015`, `NODE_ENV=test`, `MEMBER_ASSISTANT_ENABLED=true`, `MEMBERSHIP_ENABLED=true`, local JWT secrets and `GEMINI_API_KEY=isolated-provider-stub` (not a real key). This fixture key enables the stubbed SDK path; outbound provider traffic is forbidden. Synthetic browser accounts remain only in that disposable database.
- Browser captures and final verification results are recorded in the engineering record. No production member data or provider quota is needed for these tests.
