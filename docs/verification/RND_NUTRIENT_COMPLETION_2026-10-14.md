# RND source nutrient completion — October 14, 2026

## Authorization and boundary

The owner asked to fill the remaining recipe nutrients and authorized estimates after looking for sources. Published numeric recipe values remain authoritative. The Chicken Enchilada and Morcon publisher pages do not supply the missing six numeric facts; they are not treated as official measurements. Supplementary estimates remain labeled and attributable.

Sources inspected: [Chicken Enchilada](https://panlasangpinoy.com/chicken-enchilada-casserole-recipe/), [Morcon](https://panlasangpinoy.com/beef-holiday-christmas-new-year-food-menu-morcon-recipe/), and the repository's pinned [USDA FoodData Central datasets](https://fdc.nal.usda.gov/download-datasets/). Pinned catalogue SHA-256: `829b6af18b30a67414dae6b795d8acb2d2191bf75aa86cef6f5ad6a0c9cc29d0`.

Comparable-food estimates use three known reference foods per nutrient, dish/ingredient tokens and macro density, then scale to saved recipe energy. Sugar/fiber cannot exceed recorded carbohydrate and saturated fat cannot exceed recorded fat. This method does not measure ingredient salt, cooking loss or final recipe yield; no clinical accuracy claim is made. Unknown values remain unknown if no usable reference exists.

## Data changes

- Seven unused/unreviewed standardized demo recipes: expose 42 existing calculated extended values after validating saved macros and measured ingredients.
- Other available sources: 1,958 recipes receive separate `extendedNutritionEstimates` metadata; 7,499 missing fields become available to RND previews. Metadata includes six fallback estimates for changed preparations, donor identifiers, input/source hashes and version.
- Rice: one missing potassium value supplied through separate `reviewNutrientEstimates` metadata. Original canonical food fields and composition revision stay intact.
- RND comparison labels estimates on both sides. Current pending meal presentation reads supplements only when the source portion, macros and complete ingredients match; rice supplements also require a valid input fingerprint. RND-selected source swaps save their exact displayed estimates separately with source identity and whole-plate macros. Ordinary provider reads exclude estimates unless explicitly opted in; certified library and member generation paths do not opt in.
- No schema change, ingredient edit, saved macro rewrite, approval or verification grant.

## Backup and rehearsal

Exact shared target: Neon `nameless-dust-38810716`, branch `br-round-art-b355gp02`, database `neondb`. Scripts reject other remote targets. Full backup created at `2026-10-14T10:17:59.338Z`: 13,991,343 bytes, 119 table-data entries, SHA-256 `59d1f6ad24d8b1f5ee0dcf4e38393041d0327ef0ebf5d2abdab22f94c0b00252`.

The archive was fully restored into the owned loopback database `kainara_recipe_nutrient_rehearsal_20261014` on port 55432. Both scripts applied successfully there; original facts, macros, ingredient JSON and signatures were preserved. Repeat dry runs propose zero changes.

The actual cloned Lomi context returns 926 candidates, 24 displayed, all pending and all ten nutrient fields present. Source preparation changes use labeled fallback estimates rather than inheriting incompatible publisher measurements. Search took 2,961 ms in this rehearsal; this is not a general performance guarantee.

## Software verification

21 focused backend tests and 14 frontend tests pass. Covered native zero/missing/invalid values, source fingerprint invalidation, opt-in estimates, macro caps, saved estimate replay identity/macros, compatible current-plate supplements, full catalogue paging and comparison labels. Backend production build, frontend TypeScript, dedicated backfill script TypeScript and scoped ESLint pass. Broad test fixture typing has the previously recorded unrelated failures.

## Shared application

Applied successfully to the exact shared target at approximately 18:51 PHT. Seven existing calculations exposed 42 facts; 1,958 additional sources received 11,748 supplementary fallback values covering 7,499 native gaps. Available-source coverage reports **zero remaining extended-nutrient gaps** when valid supplements are included. Both repeat dry runs propose zero writes.

At `2026-10-14T10:52:19.133Z`, database size was 120,422,400 bytes versus 114,999,296 before apply: growth **5,423,104 bytes (5.17 MiB)**. Estimate JSON represents 4,860,963 bytes. This is database storage, not a provider network allowance measurement.

Before/after aggregate hashes match for source macros/ingredients/signatures/status, member-plan macros/status, complete approval decision rows and library identity/signature/macros/status. Counts remain 59 users, 413 plans and six approval decisions. Canonical rice potassium remains null and composition revision remains one; supplementary rice metadata is present. Seven per-recipe data-maintenance audit entries and one aggregate estimate-maintenance entry were added.

Read-only shared Lomi replacement search still returns **926 pending candidates**, 24 on the first page, all ten nutrient fields present, with estimate labels in the payload. Shared search took 11,074 ms; it is not a latency guarantee. The current Lomi RND projection also supplies all ten fields: published sodium 3,047.48 mg, sugar 11.005 g, fiber 7.83 g and saturated fat 7.0425 g are unchanged; potassium 1,037.753 mg and phosphorus 497.524 mg are explicitly estimated.

The shared browser opened the actual Lomi evidence and confirmed its Swap button requires an active claim. No real-member claim, swap or clinical decision was submitted for this check. The final comparison labels and table are verified by component tests, and the actual shared service projections by read-only database/service checks; a browser swap confirmation was not performed. Code commits remain local; no hosted deployment or push is included.
