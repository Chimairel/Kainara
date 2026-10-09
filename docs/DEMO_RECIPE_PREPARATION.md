# Standardized capstone recipe preparation

The owner authorized culinary estimates for the capstone demonstration and requested ordinary meal presentation, without alteration notices in the UI. Preparation assumptions, source identities and calculated evidence remain internal audit metadata. Existing RND certification, condition approval and quarantine workflows still apply.

## Collection and calculations

Seven new recipe versions have positive per-serving edible gram weights, specific USDA composition identities, four calculated macros and six extended nutrients: sodium, sugar, fiber, potassium, phosphorus and saturated fat.

| Recipe | kcal before any rice side | Sodium mg | Saturated fat g |
| --- | ---: | ---: | ---: |
| Chicken Adobo | 279.4 | 741.2 | 1.4 |
| Chicken Tinola Recipe | 347.6 | 334.4 | 1.5 |
| Basic Tortang Talong | 258.8 | 339.6 | 3.8 |
| Chop Suey | 277.3 | 313.2 | 1.1 |
| Ginisang Monggo with Vegetables | 284.0 | 243.7 | 0.7 |
| Filipino Omelet | 217.7 | 341.6 | 3.5 |
| Pancit | 467.3 | 940.9 | 1.7 |

These are standardized adaptations, not reconstructions of the original recipes. Their exact ingredient choices and weights are defined in `backend/src/domain/demo-standard-portions.policy.ts`. For example, tinola uses the recorded papaya/spinach composition references, and the adobo adaptation omits bay leaf. The model retains all listed edible ingredients, including oil and seasoning; it does not model cooking retention, moisture loss or discarded sauce. Cooked noodles and mung beans use their recorded cooked composition references. Original recipes, published nutrition, historical decisions and member plans are preserved.

The parser recovers ASCII/Unicode fractions and separates amounts from units. It divides source amounts by original servings only when recovering an unparsed quantity; existing per-serving amounts are not divided twice. Source ranges use a recorded midpoint assumption. Salt and pepper “to taste” become separately recorded 0.5 g and 0.05 g per serving in preparation previews. Other unmeasured ingredients remain unresolved. USDA household portions retain delivery hashes, food and portion IDs; household conversions and the 240 ml cup convention are recorded assumptions. They are not measured preparation evidence.

The new collection stores all quantities directly in grams. Source recipe selection supports its internal provider marker. These versions require RND base verification and do not inherit the original Panlasang unrestricted admission shortcut. Their source recipe photographs and cooking links remain available with attribution. A prepared plan's internal selection evidence retains the ten nutrient totals after serving scaling and any governed rice addition. Unknown rice nutrients remain unknown.

## Scope and remaining gaps

This completes the seven-recipe collection, not the entire original corpus. The read-only [preparation audit](verification/DEMO_RECIPE_PREPARATION_2026-10-09.json) checks 1,958 available original recipes. Parsing/mapping previews still have 7,840 unresolved ingredient mappings and 9,224 missing usable gram conversions. Only 11 original recipe previews permit calculation, and three have all ten totals. No partial original recipe is silently filled or published.

The collection's library rows use the existing draft representation: status `APPROVED` with `INCOMPLETE` evidence, no certified revision and no verifier. The status alone does not grant member admission. These recipes appear in the RND **Meal verification** queue and administrator library. Independent verification and applicable profile/condition checks remain required before use.

## Condition proposals

The import creates five inactive policy drafts and three inactive nutrient-rule drafts. The sodium proposals refer to [WHO sodium reduction guidance](https://www.who.int/news-room/fact-sheets/detail/sodium-reduction); the saturated-fat proposal refers to [AHA saturated-fat guidance](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats). Source references, population scope, required inputs and caveats are retained with each rule.

The proposed checks apply to **whole-day totals**, including outside food, rather than using a daily limit independently for every meal. Saturated-fat evaluation requires the daily energy denominator. Broad heart conditions require diagnosis-specific review. Diabetes, kidney disease and pregnancy receive policy drafts without invented numeric thresholds. All five drafts have automation disabled. Activation requires the existing source review, impact assessment and independent RND approval process. The import does not create clinical approval or condition clearance.

## Guarded commands

From `backend/`:

```powershell
npm run demo:recipes:prepare
# Read-only collection preview without the full original-corpus audit:
npm run demo:recipes:prepare -- --collection-only
# Only after confirming the development target and verifying a fresh full backup:
npm run demo:recipes:prepare -- --apply --collection-only --confirm-target TOKEN --allow-shared-development --verified-backup FILE --backup-sha256 SHA256
```

Set `DEMO_PREPARATION_REPORT` to an ignored local file for apply/retry checks so the committed full audit stays intact. Application requires a custom-format PostgreSQL backup with matching SHA-256. Remote targets are restricted to the previously confirmed development branch. One serializable transaction and an advisory lock protect the complete create-only import. Live source signatures/status/holds and food composition are revalidated before creation. Existing preparation versions must retain their signature; changes require a new version. Held sources are excluded, derived recipes inherit an unambiguous parent lineage, and failures roll back all drafts, rules and audits. Repeated imports do not create duplicate recipes or audit events.

The portion derivation command `npm run demo:portions:derive` requires the ignored original USDA deliveries and verifies their pinned hashes. The committed derived portion file permits ordinary preparation without downloading source deliveries.

## Verification

`npm run test:acceptance:demo-recipes` requires the fresh task-owned `127.0.0.1:55488/kainara_recipe_preparation` database, all migrations, `NODE_ENV=test` and empty external provider credentials. Fourteen checks cover dry-run immutability, complete totals, forced rollback, original preservation, held-source exclusion, parent family/lineage retention, draft rule isolation, retry behavior, changed-version rejection, administrator/RND reads, member role denial and preserved onboarding/admission gates. The member fixture intentionally lacks completed clinical onboarding and its compatible-library request returns 409; a separate admission query confirms none of the seven drafts receives general admission.

Unit tests cover fractions, ranges, assumptions, household conversions, unknown nutrients, daily-rule simulation, source admission, photography/cooking links and scaled persisted rice evidence. Full backend tests, application/script TypeScript, lint, build and source architecture checks verify the changed code. These checks establish software behavior, not clinical validation. Shared application evidence is recorded in engineering entry 313. Demo promotion remains separate.
