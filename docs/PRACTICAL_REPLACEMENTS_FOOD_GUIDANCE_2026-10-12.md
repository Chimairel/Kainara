# Practical replacements and food guidance — October 12, 2026

## Scope and routing

Work was performed in `C:/Users/chima/Desktop/Nutrimind`. The owner approved normal localhost sharing the existing live defense database: Neon project `nameless-dust-38810716`, main branch `br-round-art-b355gp02`, database `neondb`. Only the private localhost database configuration changed; deployed secrets and database routing were retained. A bounded read verified the owner's current plan has 21 saved and 21 cleared slots. Earlier local rice-evidence repair used a verified backup and preserved meal identities, nutrients and approval history.

Automated and browser mutations use `kainara_local_development@127.0.0.1:55432`. Backend unit tests force an unreachable loopback database; `npm run dev:isolated` requires an ignored test environment file, port 5001 and loopback database URLs. Actual test-browser API requests went to the real isolated API at 5001, including database persistence; responses were not mocked. Live events were disabled in these browser contexts. Normal browser use still connects to API 5000. Synthetic fixtures, auth states, backups, environment files and original logs stay outside Git.

Sharing a database establishes data parity, not deployed-code parity. This implementation is local/development; no migration or hosted release is part of this phase. The live demonstration remains on its recorded release until explicitly published.

## Implemented behavior

- An empty successful certified search says **No certified replacements match this search.** **Reject and find replacement** opens the existing required-reason dialog. Broader preparation retains certified-library → stored-recipe → AI order and uses the member's existing restrictions and targets. Manual nutrient filters are identified as certified-search filters.
- **Reject and leave unavailable** retains the signed search outcome and existing explicit hold, preventing automatic preparation. Both choices record the rejection before preparation. The response adds compatible `replacementResult`: `READY_FOR_REVIEW`, `HELD`, `NO_CANDIDATE` or `PREPARATION_FAILED`, while retaining existing fields/endpoints. A preparation or advisory-notification failure cannot turn a saved rejection into an apparent failed decision.
- All rejection replacements are pending. Certified fallback uses an internal pending mode without changing unrelated deadline fallback. AI preparation now shares ingredient identity/restriction checks, composition-revision validation and current-profile locks; unresolved evidence remains `NEEDS_REVIEW`. Existing recipe and member approval gates remain authoritative.
- Food-guidance format 1 is saved in existing report JSON alongside its profile snapshot. It covers the five supported condition codes and five supported allergens, preserves custom restrictions and distinguishes allergy, intolerance and preference. Four sections provide examples, reasons and preparation/label tips. Kidney and unfamiliar contexts defer conflicting choices and individual limits to the RND. No new personal numerical limits or planning-policy version were introduced.
- Member and staff saved-guidance views share `FoodGuidanceSections`; the report remains one continuous document. Phone reports display readable text without shrinking a fixed-width paper. PDFs include equivalent saved content and sources. Archived report JSON and snapshots are not rewritten or enriched on read.
- Current legacy reports offer **Update food guidance** through the existing generation/acknowledgment flow. Server-identified educational updates preserve the active planning report when declarations, profile revision and macro targets match. Changed targets or inputs do not qualify. This preserves exact-context review enforcement rather than broadening its applicability. A tiny numeric tolerance addresses PostgreSQL JSONB floating-point round trips, not substantive target changes. The UI recognizes an acknowledged educational update after reload without repeatedly asking for activation.

## Verification

| Check | Evidence |
| --- | --- |
| Backend build, compiler and complete tests | 993 passed, zero failed; one existing TODO (994 total) |
| Frontend complete tests | 1,015 passed in 209 files; eight Node checks passed |
| Changed backend/frontend lint and frontend type check | Passed |
| Empty search and stored replacement | Actual RND browser: search empty; rejection saved; stored replacement pending with same member/date and zero approvals |
| Explicit hold and duplicate submission | Actual browser: held without replacement or automatic fallback; both replayed decisions return 409 |
| AI fallback and provider failure | Simulated SDK transport through real rejection/preparation services with mocked persistence; eligible AI remains pending/unknown evidence, three dairy conflicts yield no candidate, provider failure preserves rejection, expired claim cannot mutate |
| Guidance cases | Supported/combined conditions, all supported allergens, custom restrictions and intolerance covered by deterministic tests |
| Guidance update preservation | Actual browser and SQL assertions for unrestricted, diabetes, kidney, hypertension and heart fixtures: unchanged meals, membership usage, revisions and archived versions; original planning bindings preserved |
| Review availability after educational update | Actual RND browser successfully opens, claims and decides a pre-existing kidney case after its update |
| Receipt after reload | Actual browser verifies acknowledged current educational reports do not offer another activation |
| Saved staff guidance | Actual member generation and RND saved-guidance canvas expose the same recorded format |
| PDF parity | Three actual PDF exports; every saved food item name, reason and tip found after normalizing extraction whitespace; all pages of one three-page export visually checked |
| Responsive/themes | Actual member browser at desktop and 390px phone, light/dark; phone text at least 14px and no horizontal page overflow |

The first browser run exposed a real regression: advancing the planning report during an educational update made previously saved meal contexts unavailable. The corrected replay preserves the original binding and then successfully reviews the same case. Synthetic fixture bindings affected by that intermediate run were restored only after checking unchanged inputs; report history was preserved. Intermediate failed attempts are not counted as passing evidence.

## Evidence and limits

Sanitized results and SHA-256 hashes are in `verification/practical-replacements-food-guidance-2026-10-12.json`. Original private browser evidence is under `backend/.local/mvp-20261012/`, including desktop/mobile light/dark screenshots, the RND saved-guidance canvas, empty certified search and exported PDFs. These contain marked synthetic profiles and are not committed.

Provider availability and clinical appropriateness are not established by simulated AI tests. No new load rehearsal or hosted mutation was run for this feature. Original exact-context, licensing, allergy, rice-evidence and certification gates remain necessary; an empty certified library is not made eligible by educational guidance. No live records, migration history or deployed release were repaired/published here. Normal localhost edits now affect hosted records, so future synthetic work must explicitly select the isolated target.

## Rollback and release

Revert the feature commit to roll back code; no schema rollback is needed. New report versions remain honest saved records. Restoring localhost's prior private environment selects the separate local copy again; it does not synchronize hosted member activity. Any hosted promotion must use the tested frontend/backend pair and existing defense secrets, and be recorded separately from this local verification.
