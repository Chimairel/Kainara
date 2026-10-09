# Catalogue nutrient evidence

Change: CHG-20261009-14. This is source-data completion, not clinical certification.

## Data and calculations

The old FNRI seed discarded sugar, phosphorus and saturated fat. The USDA projection discarded those nutrients, B vitamins, niacin, water and other nutrient entries. FoodItem now has nullable sugar (g), phosphorus (mg), saturatedFat (g), plus sourceNutrientEvidence containing all available source nutrient entries, their units/definitions and source identifiers. Composition is per 100 g of the named food/preparation. USDA derivation codes and hash-pinned deliveries are preserved; compiled data is not relabeled as measured Philippine data.

Original FNRI blank, trace or unavailable cells are retained with a null numeric value. USDA missing entries remain absent. Existing non-null canonical values are preserved. Source IDs are matched first. Legacy FNRI rows require an exact name and matching energy, protein, carbohydrate and fat; duplicate names require exactly one matching composition. Conflicts appear in the audit and are not overwritten.

Recipe preparation, derivation, governed corrections and certification use sugar, phosphorus and saturated fat from current food records. Every ingredient needs an explicit mapping and edible grams per serving. A nutrient total remains null if any ingredient lacks it. Certification checks all six extended totals.

Reviewed/used recipes and saved member meal totals are preserved. Food composition revisions advance when source evidence changes; affected complete certifications become stale and dependent clearances require revalidation. Quarantine/flag/archive holds remain. Unreviewed unused recipes may receive missing values only for an identical published source serving or a fully measured composition whose macros match the saved serving. Neither path grants RND approval.

## Commands and safeguards

```powershell
Set-Location backend
npm run nutrients:complete
# After confirming the printed target and verifying its backup:
npm run nutrients:complete -- --apply --confirm-target TOKEN --allow-shared-development --verified-backup FILE --backup-sha256 SHA256
```

Apply uses one serializable transaction and the shared evidence advisory lock. Row revision, identity, macro, prior nutrient and source-evidence checks reject concurrent edits. A failure rolls back all writes. Backup verification and ignored rollback snapshots precede writes. Repeating an unchanged import makes no writes or audit events. Remote databases other than the configured development branch are refused. Production/demo deployment is separate.

USDA projection: `npm run usda:derive`. Source JSON deliveries must match the pinned SHA-256 values. Nutrient tuples `[id, amount, derivationCode]` reference `nutrientDefinitions`. Total sugar uses nutrient 2000, falling back to explicit total-sugar nutrient 1063; added sugars are not substituted. The FNRI fingerprint is pinned in `food-nutrient-source.policy.ts`. New deliveries require review before updating fingerprints.

## Remaining recipe gaps

The authorized development import on October 9 retained source evidence for all 15,072 ingredient records (1,073,898 nutrient entries) and filled 94,365 previously missing indexed fields. A final repeat audit found zero additional recoverable updates and zero source conflicts. Ingredient sources still omit some values: 180 sodium, 2,162 sugar, 332 phosphorus and 886 saturated-fat entries remain unknown. These are not zero and cannot be recovered from the current pinned deliveries. The verified backup, migration, verification and counts are recorded in engineering entry 312.

The [per-recipe audit](verification/CATALOGUE_NUTRIENT_AUDIT_2026-10-09.json) contains recipe/source identities and completeness findings, without member identities or clinical information.

October 9 findings: 1,100 recipes have explicitly labeled comparable-recipe demonstration macro estimates; 1,597 included ingredient amounts lack a usable amount/unit; 11,811 included ingredient entries lack composition mappings. Mapped household amounts can still lack measured gram conversions. Every raw recipe has an original serving count, which does not establish edible grams or nutrition totals.

The 2,020 library rows include 1,109 missing sodium values and 2,020 missing phosphorus values. These recipe-serving gaps are distinct from ingredient composition. No library serving qualified for the conservative automatic backfill on this snapshot; reviewed/used rows were preserved.

The original [Adobong Baboy sa Gata recipe](https://panlasangpinoy.com/adobong-baboy-sa-gata-pork-adobo-in-coconut-milk/) lists salt to taste and currently provides a serving description without numeric nutrition totals. Such a recipe needs a measured standardized version with defensible mappings and preparation evidence. Approximation cannot make it fully sourced or clinically cleared. [USDA documentation](https://fdc.nal.usda.gov/data-documentation/) distinguishes analytical, compiled and historical data types.

## Verification

Eight focused policy/calculation tests cover source zero/unknown distinction, exact serving identity, complete ingredient sums, conflicts and JSONB key-order-independent retries. Full backend tests, application/script TypeScript, lint, builds and source architecture checks cover the implementation.

The guarded `npm run test:acceptance:nutrient-completion` requires a fresh task-owned `127.0.0.1:55488/kainara_nutrient_completion` PostgreSQL fixture with NODE_ENV=test. Twelve checks cover dry-run immutability, both sources, source nutrient entries, measured servings, unknown household units, atomic rollback, reviewed values/decisions, stale certification, audit and idempotency. No provider calls are used. Shared database application and final verification are recorded in the engineering record.
