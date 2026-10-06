# Whole-catalogue candidate coverage — October 6, 2026

Snapshot: 2026-10-06T02:32:29.133Z; base commit 81ce76c, using the current worktree catalogue policies (including local repairs, if present). All database reads executed inside one PostgreSQL REPEATABLE READ / READ ONLY transaction; read-only mode was verified as on. No accounts, plans, approvals, recipe changes or Gemini calls were made by this scan.

## Scope and counting

Scanned every persisted RawRecipeCandidate (1960) and MealLibrary row (2020), including excluded/flagged rows in the inventory. Evaluated 166 cases: the original 17, every listed condition/food restriction, and all 32 subsets of the five supported food allergens across all four diets.

- Raw ingredient candidates have active source, usable macros/ingredients, matching stored diet tags and no detected ingredient conflict. This is a screening pool, not a clinical recommendation or certification.
- Conservative candidates additionally have complete deterministic ingredient classification and no audit hold for missing title-implied allergens or a side/snack/component misclassified as a main meal. Food-restricted shortlists omit ambiguous packaged/seasoning/sauce/broth ingredients needing label and cross-contact review. A linked FNRI name helps detect conflicts; it does not establish allergen absence. These audit holds do not modify production eligibility.
- B / L / D columns apply the actual pure serving/rice composer to all conservative candidates at an illustrative 2,800 kcal daily target. The JSON also covers 1,800 and 2,400 kcal. These are counts of distinct compatible recipes per slot, not a generated, personalized or clinically cleared seven-day plan.
- Reusable reviewed recipes require current stored admission/evidence and actual library compatibility predicates. No synthetic reviewer or approval is introduced. Condition/user-scoped clearance cannot be inferred for an unspecified member. This count is before calorie/rice fit; JSON supplies fit counts.
- Condition candidate pools are screened for their declared food/diet exclusions only. They are not condition-specific suitability findings. Conditions need current user context, extended nutrients and qualified review.
- Unknown/pollen/myopia/dust cases have no defined supported food scope, so no candidates are claimed until clarification. Zero here denotes undefined scope rather than catalogue exhaustion.

## Inventory

```json
{
  "rawRows": 1960,
  "rawStatuses": {
    "AVAILABLE": 1958,
    "RETIRED": 2
  },
  "rawSources": {
    "PANLASANG_PINOY": 1960
  },
  "rawFlagged": 0,
  "rawNutritionMissing": 0,
  "rawNutritionEstimated": 1100,
  "rawUnmeasuredIngredients": 1096,
  "rawClassificationUnknown": 1636,
  "rawAuditHoldCounts": {
    "SIDE_SNACK_OR_COMPONENT_NEEDS_MAIN_MEAL_COMPOSITION": 14
  },
  "rawByType": {
    "BREAKFAST": 69,
    "LUNCH": 1703,
    "DINNER": 1098
  },
  "libraryRows": 2020,
  "libraryStatuses": {
    "APPROVED": 1969,
    "ARCHIVED": 51
  },
  "libraryBaseComplete": 0,
  "libraryEvidenceReasons": {
    "EVIDENCE_INVALIDATED": 2001,
    "EVIDENCE_NOT_COMPLETE": 2020,
    "EVIDENCE_ORIGIN_NOT_REVIEWED": 1969,
    "LIBRARY_NOT_APPROVED": 51,
    "MISSING_LIBRARY_INGREDIENTS": 3,
    "NON_FNRI_LIBRARY_INGREDIENT": 1959,
    "POLICY_VERSION_UNSUPPORTED": 1969,
    "REVIEWER_NOT_ELIGIBLE": 1969,
    "REVISION_NOT_CERTIFIED": 1969,
    "UNRESOLVED_LIBRARY_INGREDIENT": 1958
  },
  "libraryMissingNutrients": {
    "sodiumMg": 1109,
    "sugarG": 1183,
    "fiberG": 1148,
    "potassiumMg": 1162,
    "phosphorusMg": 2020,
    "saturatedFatG": 1173
  },
  "activeRulePolicies": [],
  "activeApprovedNutrientRuleCounts": {}
}
```

## Findings from the catalogue inspection

- There are ingredient-level candidates for supported food restriction profiles, but source volume alone does not establish reviewed or full-week coverage. Breakfast and dinner variety is particularly limited for plant-based combinations.
- The stored MealLibrary APPROVED enum is not reusable certification. The current snapshot has zero rows satisfying complete, admitted, unflagged base evidence; every case consequently has zero reusable reviewed library recipes in this scan. Unrestricted raw-source eligibility is a separate path and can still function.
- 1,100 raw recipes carry explicit demo nutrition estimates. Many quantities and ingredient identities need reconciliation. Condition-specific clinical suitability cannot be inferred from these values.
- No active rule policies/current approved nutrient rules were present, and every reviewed-library row lacked phosphorus evidence. Condition candidate counts below mean food/diet-filtered review pools, not condition-suitable meals.
- Source spot-check identified eggs misparsed as a measurement unit in Eggplant and Ground Chicken Omelet. The source-backed repair restores the actual food token and retains the original per-serving quantity. Repair evidence is in `docs/MEAL_CATALOGUE_REPAIRS_2026-10-06.md`. [Original recipe](https://panlasangpinoy.com/eggplant-and-ground-chicken-omelet/).
- Source spot-check: Recipe for Barbecue Chicken Marinade describes a marinade to apply to chicken, and Home Fries describes a breakfast side. Those records must not establish a full main-meal slot on their own. [Marinade](https://panlasangpinoy.com/recipe-for-barbecue-chicken-marinade/), [Home Fries](https://panlasangpinoy.com/home-fries-recipe/).
- Audit detection also holds title/ingredient allergen mismatches and obvious side/snack/component records; the full JSON records their IDs and reasons. This scan itself is read-only. The separate guarded repair restored source food tokens and narrowed meal/diet applicability; it granted no clinical approval. Source-by-source web verification was limited to the flagged recipe pages.

## Original 17 cases

| Case | Raw ingredient candidates | Conservative candidates | Conservative B / L / D at 2,800 kcal | Reusable reviewed recipes |
| --- | ---: | ---: | --- | ---: |
| No restrictions | 1958 | 311 | 26 / 191 / 123 | 0 |
| Shellfish allergy | 1552 | 103 | 13 / 56 / 28 | 0 |
| Nuts + eggs + dairy | 1059 | 54 | 2 / 30 / 9 | 0 |
| Diabetes | 1958 | 311 | 26 / 191 / 123 | 0 |
| Hypertension | 1958 | 311 | 26 / 191 / 123 | 0 |
| Kidney disease + shellfish | 1552 | 103 | 13 / 56 / 28 | 0 |
| Heart condition + nuts + MSG | 1895 | 125 | 13 / 69 / 29 | 0 |
| Pregnant/lactating | 1958 | 311 | 26 / 191 / 123 | 0 |
| Gout | 1958 | 311 | 26 / 191 / 123 | 0 |
| Unknown condition + allergy | 0 | 0 | 0 / 0 / 0 | 0 |
| Pollen allergy | 0 | 0 | 0 / 0 / 0 | 0 |
| Myopia + dust mites | 0 | 0 | 0 / 0 / 0 | 0 |
| Lactose intolerance + avoided pork | 926 | 62 | 4 / 32 / 12 | 0 |
| Vegan | 40 | 29 | 0 / 9 / 1 | 0 |
| Vegetarian | 61 | 48 | 2 / 19 / 3 | 0 |
| Pescatarian + no rice | 117 | 103 | 0 / 37 / 10 | 0 |
| Shellfish + gluten | 860 | 79 | 11 / 41 / 18 | 0 |

## All listed conditions and food restrictions

| Case | Raw ingredient candidates | Conservative candidates | Conservative B / L / D at 2,800 kcal | Reusable reviewed recipes |
| --- | ---: | ---: | --- | ---: |
| Diabetes | 1958 | 311 | 26 / 191 / 123 | 0 |
| Hypertension | 1958 | 311 | 26 / 191 / 123 | 0 |
| Kidney disease | 1958 | 311 | 26 / 191 / 123 | 0 |
| Heart condition | 1958 | 311 | 26 / 191 / 123 | 0 |
| Pregnant or lactating | 1958 | 311 | 26 / 191 / 123 | 0 |
| Gout | 1958 | 311 | 26 / 191 / 123 | 0 |
| Celiac disease | 1958 | 311 | 26 / 191 / 123 | 0 |
| Polycystic ovary syndrome | 1958 | 311 | 26 / 191 / 123 | 0 |
| Gastroesophageal reflux disease | 1958 | 311 | 26 / 191 / 123 | 0 |
| Shellfish | 1552 | 103 | 13 / 56 / 28 | 0 |
| Peanuts and tree nuts | 1895 | 125 | 13 / 69 / 29 | 0 |
| Dairy | 1381 | 77 | 8 / 46 / 20 | 0 |
| Gluten | 1084 | 100 | 11 / 53 / 19 | 0 |
| Eggs | 1418 | 86 | 2 / 46 / 14 | 0 |
| Lactose | 1381 | 77 | 8 / 46 / 20 | 0 |
| Soy | 1501 | 122 | 13 / 67 / 28 | 0 |
| Fish | 1525 | 105 | 11 / 56 / 22 | 0 |
| Sesame | 1849 | 121 | 13 / 67 / 29 | 0 |
| Monosodium glutamate (MSG) | 1958 | 125 | 13 / 69 / 29 | 0 |
| Pork | 1391 | 102 | 8 / 50 / 19 | 0 |
| Beef | 1662 | 121 | 13 / 65 / 26 | 0 |

## Shortlists for the original 17

These are recipes to inspect/review, never new safety approvals. The selection prefers source-published nutrition and measured/simple ingredients. Each slot includes up to seven names. Full ingredients, screening flags, IDs, source URLs and all case memberships are retained in the JSON.

### No restrictions

**BREAKFAST:** Chicken Adobo Fried Rice and Tortang Corned Beef; Tapsilog; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Corned Beef Omelet; Eggplant and Sardine Omelet; Longganisa Pasta

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Chicken Adobo Fried Rice and Tortang Corned Beef; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Chicken Bicol Express; Pininyahang Manok

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Quick and Easy Pan-Fried Pork Chops; Chicken Adobo Fried Rice and Tortang Corned Beef; Binagoongan Bagnet with Talong; Galbi Recipe

### Shellfish allergy

**BREAKFAST:** Lugaw Recipe; Pork Tocino with Salted Egg and Chopped Tomato; Spinach Tomato and Cheese Omelette; Oven Baked Pork Chop Silog with Atchara; Pork Tapa with Fried Banana and Salted Egg; Mushroom and Spinach Omelet; Turkey, Egg, and Cheese Breakfast Sandwich

**LUNCH:** Turbo Crispy Liempo; Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Creamy Garlic Parmesan Chicken with Mushrooms; Ginataang Manok with Papaya; Pininyahang Baboy sa Gata

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Creamy Garlic Parmesan Chicken with Mushrooms; Ginataang Manok with Papaya

### Nuts + eggs + dairy

**BREAKFAST:** Lugaw Recipe; Champorado with Tuyo (Chocolate Porridge with Salted Dried Fish)

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Turbo Crispy Liempo; Pinoy Fried Chicken Recipe; Ginataang Manok with Papaya; Pininyahang Baboy sa Gata; Crispy Adobo Flakes Recipe

**DINNER:** Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Pinoy Fried Chicken Recipe; Ginataang Manok with Papaya; Fried Fish Adobo; How to Cook Pork Bagnet; Champorado with Tuyo (Chocolate Porridge with Salted Dried Fish)

### Diabetes

**BREAKFAST:** Chicken Adobo Fried Rice and Tortang Corned Beef; Tapsilog; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Corned Beef Omelet; Eggplant and Sardine Omelet; Longganisa Pasta

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Chicken Adobo Fried Rice and Tortang Corned Beef; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Chicken Bicol Express; Pininyahang Manok

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Quick and Easy Pan-Fried Pork Chops; Chicken Adobo Fried Rice and Tortang Corned Beef; Binagoongan Bagnet with Talong; Galbi Recipe

### Hypertension

**BREAKFAST:** Chicken Adobo Fried Rice and Tortang Corned Beef; Tapsilog; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Corned Beef Omelet; Eggplant and Sardine Omelet; Longganisa Pasta

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Chicken Adobo Fried Rice and Tortang Corned Beef; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Chicken Bicol Express; Pininyahang Manok

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Quick and Easy Pan-Fried Pork Chops; Chicken Adobo Fried Rice and Tortang Corned Beef; Binagoongan Bagnet with Talong; Galbi Recipe

### Kidney disease + shellfish

**BREAKFAST:** Lugaw Recipe; Pork Tocino with Salted Egg and Chopped Tomato; Spinach Tomato and Cheese Omelette; Oven Baked Pork Chop Silog with Atchara; Pork Tapa with Fried Banana and Salted Egg; Mushroom and Spinach Omelet; Turkey, Egg, and Cheese Breakfast Sandwich

**LUNCH:** Turbo Crispy Liempo; Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Creamy Garlic Parmesan Chicken with Mushrooms; Ginataang Manok with Papaya; Pininyahang Baboy sa Gata

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Creamy Garlic Parmesan Chicken with Mushrooms; Ginataang Manok with Papaya

### Heart condition + nuts + MSG

**BREAKFAST:** Lugaw Recipe; Pork Tocino with Salted Egg and Chopped Tomato; Spinach Tomato and Cheese Omelette; Oven Baked Pork Chop Silog with Atchara; Pork Tapa with Fried Banana and Salted Egg; Mushroom and Spinach Omelet; Turkey, Egg, and Cheese Breakfast Sandwich

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Turbo Crispy Liempo; Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Creamy Garlic Parmesan Chicken with Mushrooms

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Creamy Garlic Parmesan Chicken with Mushrooms

### Pregnant/lactating

**BREAKFAST:** Chicken Adobo Fried Rice and Tortang Corned Beef; Tapsilog; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Corned Beef Omelet; Eggplant and Sardine Omelet; Longganisa Pasta

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Chicken Adobo Fried Rice and Tortang Corned Beef; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Chicken Bicol Express; Pininyahang Manok

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Quick and Easy Pan-Fried Pork Chops; Chicken Adobo Fried Rice and Tortang Corned Beef; Binagoongan Bagnet with Talong; Galbi Recipe

### Gout

**BREAKFAST:** Chicken Adobo Fried Rice and Tortang Corned Beef; Tapsilog; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Corned Beef Omelet; Eggplant and Sardine Omelet; Longganisa Pasta

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Chicken Adobo Fried Rice and Tortang Corned Beef; Tortang Talong with Crabmeat (Eggplant Omelet with Crab); Pork Tapsilog; Chicken Bicol Express; Pininyahang Manok

**DINNER:** Broccoli Cheddar Soup; Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Quick and Easy Pan-Fried Pork Chops; Chicken Adobo Fried Rice and Tortang Corned Beef; Binagoongan Bagnet with Talong; Galbi Recipe

### Unknown condition + allergy

Clarify the actual dietary restriction first.

### Pollen allergy

Clarify the actual dietary restriction first.

### Myopia + dust mites

Clarify the actual dietary restriction first.

### Lactose intolerance + avoided pork

**BREAKFAST:** Mushroom and Spinach Omelet; Champorado with Tuyo (Chocolate Porridge with Salted Dried Fish); Tortang Tuna with Spinach - Omelet Recipe; Eggplant and Ground Chicken Omelet

**LUNCH:** Seafood Bicol Express; Tahong Bicol Express; Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Ginataang Manok with Papaya; Fried Fish Adobo; How to Make Hard Boiled Eggs

**DINNER:** Inihaw na Bangus Recipe (Grilled Milkfish); Tahong Bicol Express; Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Ginataang Manok with Papaya; Fried Fish Adobo; Super Tender Juicy Chicken Nuggets

### Vegan

**BREAKFAST:** No conservative fitting candidate found.

**LUNCH:** Sweet and Sour Tofu; How to Make Soy Sauce; Buchi; Easy Sweet and Sour Sauce; How to Make Latik from a Can of Coconut Cream; Latik Recipe; Bibingkang Malagkit Recipe

**DINNER:** Seared Okra and Tomato Recipe

### Vegetarian

**BREAKFAST:** Champorado Recipe; Easy Champorado Recipe

**LUNCH:** Sweet and Sour Tofu; Grilled Swiss Cheese Sandwich; Caramelized Butternut Squash; How to Make Soy Sauce; Buchi; Easy Sweet and Sour Sauce; Sizzling Tofu

**DINNER:** Broccoli Cheddar Soup; Lumpiang Gulay (Vegetable Egg Roll Recipe); Seared Okra and Tomato Recipe

### Pescatarian + no rice

**BREAKFAST:** No conservative fitting candidate found.

**LUNCH:** Ginataang Alimasag Recipe; Tuscan Salmon; Fried Fish Adobo; Grilled Swiss Cheese Sandwich; Halabos na Hipon Recipe; Caramelized Butternut Squash; How to Make Soy Sauce

**DINNER:** Broccoli Cheddar Soup; Ginataang Alimasag Recipe; Ginataang Tilapia; Tuscan Salmon; Fried Fish Adobo; Steamed Eggplant and Okra with Bagoong; Inihaw na Galunggong with Ensaladang Talong

### Shellfish + gluten

**BREAKFAST:** Lugaw Recipe; Pork Tocino with Salted Egg and Chopped Tomato; Spinach Tomato and Cheese Omelette; Pork Tapa with Fried Banana and Salted Egg; Mushroom and Spinach Omelet; Champorado with Tuyo (Chocolate Porridge with Salted Dried Fish); Tortang Tuna with Spinach - Omelet Recipe

**LUNCH:** Turbo Crispy Liempo; Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Ginataang Manok with Papaya; Pininyahang Baboy sa Gata; Tuscan Salmon

**DINNER:** Inihaw na Bangus Recipe (Grilled Milkfish); Pinoy Fried Chicken Recipe; Talong at Tuna Torta; Cheesy Ham Steak with Bacon and Mushroom; Ginataang Manok with Papaya; Tuscan Salmon; Fried Fish Adobo

## Diet and allergy intersections

| Case | Raw ingredient candidates | Conservative candidates | Conservative B / L / D at 2,800 kcal | Reusable reviewed recipes |
| --- | ---: | ---: | --- | ---: |
| OMNIVORE + no allergy | 1958 | 311 | 26 / 191 / 123 | 0 |
| OMNIVORE + SHELLFISH | 1552 | 103 | 13 / 56 / 28 | 0 |
| OMNIVORE + NUTS | 1895 | 125 | 13 / 69 / 29 | 0 |
| OMNIVORE + SHELLFISH + NUTS | 1508 | 103 | 13 / 56 / 28 | 0 |
| OMNIVORE + DAIRY | 1381 | 77 | 8 / 46 / 20 | 0 |
| OMNIVORE + SHELLFISH + DAIRY | 1043 | 67 | 8 / 39 / 19 | 0 |
| OMNIVORE + NUTS + DAIRY | 1344 | 77 | 8 / 46 / 20 | 0 |
| OMNIVORE + SHELLFISH + NUTS + DAIRY | 1022 | 67 | 8 / 39 / 19 | 0 |
| OMNIVORE + GLUTEN | 1084 | 100 | 11 / 53 / 19 | 0 |
| OMNIVORE + SHELLFISH + GLUTEN | 860 | 79 | 11 / 41 / 18 | 0 |
| OMNIVORE + NUTS + GLUTEN | 1052 | 100 | 11 / 53 / 19 | 0 |
| OMNIVORE + SHELLFISH + NUTS + GLUTEN | 841 | 79 | 11 / 41 / 18 | 0 |
| OMNIVORE + DAIRY + GLUTEN | 838 | 68 | 7 / 38 / 16 | 0 |
| OMNIVORE + SHELLFISH + DAIRY + GLUTEN | 652 | 58 | 7 / 31 / 15 | 0 |
| OMNIVORE + NUTS + DAIRY + GLUTEN | 817 | 68 | 7 / 38 / 16 | 0 |
| OMNIVORE + SHELLFISH + NUTS + DAIRY + GLUTEN | 642 | 58 | 7 / 31 / 15 | 0 |
| OMNIVORE + EGGS | 1418 | 86 | 2 / 46 / 14 | 0 |
| OMNIVORE + SHELLFISH + EGGS | 1094 | 65 | 2 / 34 / 13 | 0 |
| OMNIVORE + NUTS + EGGS | 1383 | 86 | 2 / 46 / 14 | 0 |
| OMNIVORE + SHELLFISH + NUTS + EGGS | 1071 | 65 | 2 / 34 / 13 | 0 |
| OMNIVORE + DAIRY + EGGS | 1086 | 54 | 2 / 30 / 9 | 0 |
| OMNIVORE + SHELLFISH + DAIRY + EGGS | 814 | 44 | 2 / 23 / 8 | 0 |
| OMNIVORE + NUTS + DAIRY + EGGS | 1059 | 54 | 2 / 30 / 9 | 0 |
| OMNIVORE + SHELLFISH + NUTS + DAIRY + EGGS | 799 | 44 | 2 / 23 / 8 | 0 |
| OMNIVORE + GLUTEN + EGGS | 880 | 75 | 2 / 40 / 11 | 0 |
| OMNIVORE + SHELLFISH + GLUTEN + EGGS | 685 | 54 | 2 / 28 / 10 | 0 |
| OMNIVORE + NUTS + GLUTEN + EGGS | 857 | 75 | 2 / 40 / 11 | 0 |
| OMNIVORE + SHELLFISH + NUTS + GLUTEN + EGGS | 673 | 54 | 2 / 28 / 10 | 0 |
| OMNIVORE + DAIRY + GLUTEN + EGGS | 715 | 52 | 2 / 28 / 9 | 0 |
| OMNIVORE + SHELLFISH + DAIRY + GLUTEN + EGGS | 551 | 42 | 2 / 21 / 8 | 0 |
| OMNIVORE + NUTS + DAIRY + GLUTEN + EGGS | 696 | 52 | 2 / 28 / 9 | 0 |
| OMNIVORE + SHELLFISH + NUTS + DAIRY + GLUTEN + EGGS | 543 | 42 | 2 / 21 / 8 | 0 |
| VEGETARIAN + no allergy | 61 | 48 | 2 / 19 / 3 | 0 |
| VEGETARIAN + SHELLFISH | 61 | 37 | 0 / 12 / 2 | 0 |
| VEGETARIAN + NUTS | 61 | 37 | 0 / 12 / 2 | 0 |
| VEGETARIAN + SHELLFISH + NUTS | 61 | 37 | 0 / 12 / 2 | 0 |
| VEGETARIAN + DAIRY | 45 | 25 | 0 / 7 / 1 | 0 |
| VEGETARIAN + SHELLFISH + DAIRY | 45 | 25 | 0 / 7 / 1 | 0 |
| VEGETARIAN + NUTS + DAIRY | 45 | 25 | 0 / 7 / 1 | 0 |
| VEGETARIAN + SHELLFISH + NUTS + DAIRY | 45 | 25 | 0 / 7 / 1 | 0 |
| VEGETARIAN + GLUTEN | 47 | 32 | 0 / 10 / 1 | 0 |
| VEGETARIAN + SHELLFISH + GLUTEN | 47 | 32 | 0 / 10 / 1 | 0 |
| VEGETARIAN + NUTS + GLUTEN | 47 | 32 | 0 / 10 / 1 | 0 |
| VEGETARIAN + SHELLFISH + NUTS + GLUTEN | 47 | 32 | 0 / 10 / 1 | 0 |
| VEGETARIAN + DAIRY + GLUTEN | 36 | 24 | 0 / 6 / 1 | 0 |
| VEGETARIAN + SHELLFISH + DAIRY + GLUTEN | 36 | 24 | 0 / 6 / 1 | 0 |
| VEGETARIAN + NUTS + DAIRY + GLUTEN | 36 | 24 | 0 / 6 / 1 | 0 |
| VEGETARIAN + SHELLFISH + NUTS + DAIRY + GLUTEN | 36 | 24 | 0 / 6 / 1 | 0 |
| VEGETARIAN + EGGS | 56 | 34 | 0 / 11 / 1 | 0 |
| VEGETARIAN + SHELLFISH + EGGS | 56 | 34 | 0 / 11 / 1 | 0 |
| VEGETARIAN + NUTS + EGGS | 56 | 34 | 0 / 11 / 1 | 0 |
| VEGETARIAN + SHELLFISH + NUTS + EGGS | 56 | 34 | 0 / 11 / 1 | 0 |
| VEGETARIAN + DAIRY + EGGS | 41 | 22 | 0 / 6 / 0 | 0 |
| VEGETARIAN + SHELLFISH + DAIRY + EGGS | 41 | 22 | 0 / 6 / 0 | 0 |
| VEGETARIAN + NUTS + DAIRY + EGGS | 41 | 22 | 0 / 6 / 0 | 0 |
| VEGETARIAN + SHELLFISH + NUTS + DAIRY + EGGS | 41 | 22 | 0 / 6 / 0 | 0 |
| VEGETARIAN + GLUTEN + EGGS | 43 | 29 | 0 / 9 / 0 | 0 |
| VEGETARIAN + SHELLFISH + GLUTEN + EGGS | 43 | 29 | 0 / 9 / 0 | 0 |
| VEGETARIAN + NUTS + GLUTEN + EGGS | 43 | 29 | 0 / 9 / 0 | 0 |
| VEGETARIAN + SHELLFISH + NUTS + GLUTEN + EGGS | 43 | 29 | 0 / 9 / 0 | 0 |
| VEGETARIAN + DAIRY + GLUTEN + EGGS | 33 | 21 | 0 / 5 / 0 | 0 |
| VEGETARIAN + SHELLFISH + DAIRY + GLUTEN + EGGS | 33 | 21 | 0 / 5 / 0 | 0 |
| VEGETARIAN + NUTS + DAIRY + GLUTEN + EGGS | 33 | 21 | 0 / 5 / 0 | 0 |
| VEGETARIAN + SHELLFISH + NUTS + DAIRY + GLUTEN + EGGS | 33 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + no allergy | 40 | 29 | 0 / 9 / 1 | 0 |
| VEGAN + SHELLFISH | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + NUTS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + DAIRY | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + SHELLFISH + DAIRY | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + NUTS + DAIRY | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS + DAIRY | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + NUTS + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + DAIRY + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + DAIRY + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + NUTS + DAIRY + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS + DAIRY + GLUTEN | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + SHELLFISH + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + NUTS + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + DAIRY + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + SHELLFISH + DAIRY + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + NUTS + DAIRY + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS + DAIRY + EGGS | 40 | 22 | 0 / 6 / 0 | 0 |
| VEGAN + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + NUTS + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + DAIRY + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + DAIRY + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + NUTS + DAIRY + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| VEGAN + SHELLFISH + NUTS + DAIRY + GLUTEN + EGGS | 32 | 21 | 0 / 5 / 0 | 0 |
| PESCATARIAN + no allergy | 117 | 103 | 3 / 51 / 15 | 0 |
| PESCATARIAN + SHELLFISH | 89 | 50 | 1 / 20 / 7 | 0 |
| PESCATARIAN + NUTS | 117 | 63 | 1 / 27 / 7 | 0 |
| PESCATARIAN + SHELLFISH + NUTS | 89 | 50 | 1 / 20 / 7 | 0 |
| PESCATARIAN + DAIRY | 90 | 41 | 1 / 18 / 5 | 0 |
| PESCATARIAN + SHELLFISH + DAIRY | 71 | 36 | 1 / 14 / 5 | 0 |
| PESCATARIAN + NUTS + DAIRY | 90 | 41 | 1 / 18 / 5 | 0 |
| PESCATARIAN + SHELLFISH + NUTS + DAIRY | 71 | 36 | 1 / 14 / 5 | 0 |
| PESCATARIAN + GLUTEN | 93 | 56 | 1 / 24 / 6 | 0 |
| PESCATARIAN + SHELLFISH + GLUTEN | 69 | 43 | 1 / 17 / 6 | 0 |
| PESCATARIAN + NUTS + GLUTEN | 93 | 56 | 1 / 24 / 6 | 0 |
| PESCATARIAN + SHELLFISH + NUTS + GLUTEN | 69 | 43 | 1 / 17 / 6 | 0 |
| PESCATARIAN + DAIRY + GLUTEN | 72 | 39 | 1 / 16 / 5 | 0 |
| PESCATARIAN + SHELLFISH + DAIRY + GLUTEN | 57 | 34 | 1 / 12 / 5 | 0 |
| PESCATARIAN + NUTS + DAIRY + GLUTEN | 72 | 39 | 1 / 16 / 5 | 0 |
| PESCATARIAN + SHELLFISH + NUTS + DAIRY + GLUTEN | 57 | 34 | 1 / 12 / 5 | 0 |
| PESCATARIAN + EGGS | 112 | 60 | 1 / 26 / 6 | 0 |
| PESCATARIAN + SHELLFISH + EGGS | 84 | 47 | 1 / 19 / 6 | 0 |
| PESCATARIAN + NUTS + EGGS | 112 | 60 | 1 / 26 / 6 | 0 |
| PESCATARIAN + SHELLFISH + NUTS + EGGS | 84 | 47 | 1 / 19 / 6 | 0 |
| PESCATARIAN + DAIRY + EGGS | 86 | 38 | 1 / 17 / 4 | 0 |
| PESCATARIAN + SHELLFISH + DAIRY + EGGS | 67 | 33 | 1 / 13 / 4 | 0 |
| PESCATARIAN + NUTS + DAIRY + EGGS | 86 | 38 | 1 / 17 / 4 | 0 |
| PESCATARIAN + SHELLFISH + NUTS + DAIRY + EGGS | 67 | 33 | 1 / 13 / 4 | 0 |
| PESCATARIAN + GLUTEN + EGGS | 89 | 53 | 1 / 23 / 5 | 0 |
| PESCATARIAN + SHELLFISH + GLUTEN + EGGS | 65 | 40 | 1 / 16 / 5 | 0 |
| PESCATARIAN + NUTS + GLUTEN + EGGS | 89 | 53 | 1 / 23 / 5 | 0 |
| PESCATARIAN + SHELLFISH + NUTS + GLUTEN + EGGS | 65 | 40 | 1 / 16 / 5 | 0 |
| PESCATARIAN + DAIRY + GLUTEN + EGGS | 69 | 36 | 1 / 15 / 4 | 0 |
| PESCATARIAN + SHELLFISH + DAIRY + GLUTEN + EGGS | 54 | 31 | 1 / 11 / 4 | 0 |
| PESCATARIAN + NUTS + DAIRY + GLUTEN + EGGS | 69 | 36 | 1 / 15 / 4 | 0 |
| PESCATARIAN + SHELLFISH + NUTS + DAIRY + GLUTEN + EGGS | 54 | 31 | 1 / 11 / 4 | 0 |

## Evidence files and reproduction

- Full per-recipe/per-case results: .codex-runtime/catalogue-coverage/coverage.json (local, ignored).
- Reproduce from backend with CATALOGUE_AUDIT_READ_ONLY=true and the checked development DATABASE_URL: npx tsx scripts/audit-catalogue-case-candidates.ts.
- The script refuses any other database host/name and performs no shared state mutations. Current staff eligibility and evidence can change after this snapshot.
- Ingredient text cannot prove packaged ingredients, preparation cross-contact or unknown medical suitability. Estimated nutrition and missing extended nutrient fields remain explicit in the inventory and JSON; no missing values are replaced with zero.
