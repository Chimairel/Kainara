# Outside-food logging: nutrition provenance and interface

## Observed behavior

The owner reported an AI food estimate without source citations. Code inspection of `MealLogService.logOutsideMeal`, `resolveFreeItem`, `estimateWithAi`, `outside-meal-ai.policy.ts` and `generateGenerativeJSON` establishes:

1. Submitted label/manual values are validated and treated as user-reported nutrition. They are not independently verified.
2. Eligible saved library servings can supply their recorded macros. An FNRI composition match requires measured grams and is scaled from its per-100 g record. These are database reads, not a live web search. Changing a library/reference value records a user-reported or user-adjusted value.
3. When explicitly requested, Gemini estimates only unresolved food items. Its prompt contains food names, any entered grams and preparation/serving notes. The model is asked for macros, ingredients and a calorie range; no citation field is requested. The shared Gemini call has no Google Search/grounding tool configured and does not return source citations to this flow. These estimates must not be represented as a sourced lookup or as FNRI composition.
4. Photo upload happens separately after a log commits. The photo is not included in the estimation prompt and is not analyzed by Gemini in this path.
5. Estimates remain provisional. Their ranges are model-produced, not statistically validated confidence intervals. Saved source data, recipe review and nutrition estimates do not establish individual condition/allergy clearance.

No new source retrieval, provider tool, citation generation, reference catalogue or backend/API/database change is introduced by this interface refinement. No synthetic source links are displayed. Adding a grounded lookup later would be a separate retrieval/validation change; asking an ungrounded model to invent source URLs would not supply trustworthy evidence.

## Interface changes

- Reuse the shared workspace Modal presentation for a fixed header and bounded scrolling. Distinguish input from “Review your food log”; retain the mounted hidden form during preview so returning does not lose edits.
- Larger meal-category controls with selected-state semantics, readable food/portion controls, accessible clear/upload buttons and shared labeled numeric Inputs. Keep the ordinary textarea, measured FNRI scaling, separate rice item and editable macros.
- Show the nutrition basis as saved library/FNRI only while its displayed values match the reference. Manual edits stop displaying a reference-source label. The authoritative submitted source is still selected by the existing server policy.
- Show empty suggestions and failed suggestion loading separately, retaining the existing debounce, cancellation and stale-response checks. These states do not invoke AI or add requests.
- Explain before AI estimation that unmatched foods are estimated without web search/citations. Distinguish outside-food allowance from Nara chat; keep allowance exhaustion and manual/reference alternatives. State that the saved photo is not AI input.
- Show full-name macro totals, partial-total disclosure, each food's recorded source basis, entered portion or serving assumption, model-provided calorie range, existing warning reasons and separate Edit/Save/RND feedback actions. Preserve preview confirmation, request identity, retry, duplicate prevention, credit limits, unknown exclusions and clinical boundaries.

## Verification

- 33 affected frontend tests pass across `OutsideMealModal`, `OutsideMealPreview` and `useOutsideMealLog`. Coverage includes source disclosure, manual/reference transitions, failed versus empty suggestions, gram/rice scaling, draft retention, stale responses, blank values, duplicate/retry behavior and saving separately from RND feedback.
- Nine existing backend policy/Gemini regressions pass. Provider behavior in those tests is mocked; no actual Gemini request or hosted database access occurred.
- Scoped ESLint, production build (including TypeScript validation), whitespace checks and the scoped Impeccable detector pass. Build uses the shared checkout; unrelated pre-existing working edits are excluded from this change's commit.
- Existing desktop/mobile browser test selectors were updated for Edit/Save actions but those browser tests were not rerun. The incumbent October 6 screenshot was inspected as dated visual context, not as a fresh capture. Fresh desktop/mobile/light/dark browser rendering remains unverified under the earlier browser access-policy limitation; no alternate browser driver was used to bypass it.
- Implemented on `codex/member-assistant` for local review. No staging/live deployment, schema migration, provider-budget change or Neon operation is part of this change.
