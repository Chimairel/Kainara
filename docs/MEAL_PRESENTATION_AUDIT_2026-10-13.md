# Meal names and image handoff — October 13, 2026

Implemented and verified in `C:\Users\chima\Desktop\Nutrimind`, using the normal frontend on port 3000 and API on port 5000. This change is local/development; it has not been published live.

## Names

One shared `formatMealTitle` removes article wording such as “How to Make”, “Recipe”, “Recipes”, “The Basic Recipe”, and promotional prefixes from displayed meal names. It preserves food descriptions, parenthetical translations and meaningful preparation words. Examples:

| Recorded source title | Displayed title |
| --- | --- |
| How to Make French Toast - The Basic Recipe | French Toast |
| Bam-I Recipe | Bam-I |
| Adobong Dilaw Recipe (Yellow Adobo) | Adobong Dilaw (Yellow Adobo) |
| Beef Broccoli Recipe with Carrots | Beef Broccoli with Carrots |
| How to Grill Salmon | Grilled Salmon |

Member cards, history, details and printable export; RND queues, canvas, recipe details, approvals and governance; and admin recipe lists/log headings use the shared formatter. Authoring inputs, raw evidence disclosures, lookup keys and saved database names remain the recorded originals. The audit lists **787 distinct catalogue source titles**, across **1,552 catalogue records**, that now receive cleaner display names. It does not rename or recertify database recipes or rewrite historical evidence.

[Full title mapping](meal-images/audit-2026-10-13/title-cleanup.csv).

## Photos to provide

Start with [images-to-provide.csv](meal-images/audit-2026-10-13/images-to-provide.csv). There is one row per displayed meal name:

- **8 `MISSING_SOURCE_PHOTO` meals** have scraped source pages, but their advertised photographs return HTTP 404 and no exact matching Cloudinary upload was found.
- **58 `NO_SOURCE_PHOTO` meals** have no scraped source-page link or currently assigned photograph. These include authored/generated catalogue entries; the count does not establish that all are used in the current plan or need photos for the defense.
- **4 `BROKEN_SECONDARY_URL` meals** have a failed backup video thumbnail, but their main recipe photographs work. These are optional replacements rather than missing main photographs.

Fill `your_image_filename` and `attribution_or_ownership`, or send photos named after the `meal` column. The `record_ids` column links matching source/library entries; title cleanup never becomes an identity-matching shortcut. Existing approved Cloudinary uploads and reviewed photographs retain priority and provenance. This checklist includes authored/demo entries as well as the imported catalogue; an image assignment is not recipe certification.

[Per-record handoff](meal-images/audit-2026-10-13/image-handoff.csv) retains the original titles, exact IDs, source links and failing URLs.

### Correction after Cloudinary comparison

The initial **96** count described unresolved application presentations, not a complete absence of available photographs. It did not include a Cloudinary account inventory comparison. Do not supply photos for all 96 names.

Read-only Cloudinary Admin API pagination found **1,044 public image uploads**, including **976** in `nutrimind/recipe-catalogue/` and seven older `nutrimind/meals/` uploads. The September upload code in the original conversation derives catalogue public IDs as `nutrimind/recipe-catalogue/` plus the first 28 hexadecimal characters of SHA-256 of the scraped recipe ID. The corresponding `RawRecipeCandidate.sourceRecordId` remains in the current defense database. This identifies **967 exact asset matches**; nine other catalogue uploads have no matching current raw source ID and were not assigned by name similarity.

Those exact matches recover **30 previously unresolved displayed meal names / 50 source and library records**, including French Toast, using **25 distinct Cloudinary files**. All 25 return HTTP 200 with image content types. Library matches use the same exact source-page URL as their matched raw recipe. The available files and record mappings are in [recovered-cloudinary-images.csv](meal-images/audit-2026-10-13/recovered-cloudinary-images.csv); these meals were removed from the photo-request checklist. The per-record handoff marks them `AVAILABLE_IN_CLOUDINARY_NOT_LINKED`.

The current application presentation snapshot references **zero Cloudinary URLs**. The old `prisma/data/panlasang-pinoy-recipes.json` scrape, `panlasang-pinoy-images.json` upload manifest and `import-panlasang-recipe-images.ts` are absent from the shared checkout/current Git history. This follow-up compared persisted scraped fields and source IDs with actual provider inventory, using the historical upload code as matching evidence; it did not claim to read the absent original JSON files. Existing source photos can still work independently of the lost manifest. Finding the Cloudinary files does not restore their application delivery automatically.

The **eight** remaining scraped names are Chai Tea, Italian Sausage, Alfredo Sauce, Mayonnaise, Sweet Tea, Poached Chicken, Strawberry Jam and Tartar Sauce. Their pages return HTTP 200, but each page's advertised `og:image`/`twitter:image` URL returns HTTP 404. The other **58** remaining names lack scraped source links; keep this group separate from missing imported photos. The four broken video backups remain optional.

[Comparison counts and timestamps](meal-images/audit-2026-10-13/cloudinary-comparison-summary.json) record the provider inventory and delivery checks (October 13, approximately 01:05–01:11 Manila time). This was a read-only reconciliation: no database changes, uploads, image reassignment or deployment. Restoring verified Cloudinary delivery is a separate implementation step; source provenance and approved custom-image priority must be retained.

| Meal with a broken backup | Video ID | Result |
| --- | --- | --- |
| Filipino Style Pork and Chicken Barbecue | OkC4sZ3fCR4 | HEAD and GET 404 |
| Chicken Adobo on a Budget | mrPzRpNA6E8 | HEAD and GET 404 |
| Pork and Chicken Sinigang | Uy7bWgPZv2I | HEAD and GET 404 |
| Retiro Beef Pares with Chicharon Bulaklak | aYA5B6Wxzu0 | HEAD and GET 404 |

## Audit evidence and boundaries

The read-only scan inspected defense Neon project `nameless-dust-38810716`, main branch `br-round-art-b355gp02`, database `neondb`, using the configured connection and an explicit host/database guard. It covered **1,967 raw recipes**, **2,027 library entries** and **120 distinct saved-plan name/image presentations**. The saved-plan scan includes historical rows and preserves swapped-recipe identity checks. Two saved-plan presentations have no photo; their recipes are already in the handoff. No account identifiers, health profiles, credentials or saved-plan IDs are included in the published CSV files.

Across **2,927 distinct in-use stored/resolved image URLs**, **2,923** returned an image content type to HEAD or matched an existing bundled reviewed asset; **4** returned 404, confirmed with bounded GET requests. Checks ran October 13, roughly 00:29–00:49 Manila time. Availability is a point-in-time HTTP/file check, not proof that every photograph visually matches its recipe or will remain available. Real image decoding was checked in the browser journeys; all 2,927 images were not individually visually reviewed.

The inventory follows `resolvePlanImage`, `resolveLibraryRecipeImages`, direct raw-recipe relations and the frontend's exact reviewed-image map. It does not treat a missing Cloudinary public ID alone as a missing photo. An initial simplified projection overcounted missing photos; following direct source relations removed those false positives before this handoff.

## Shared fallback

`MealImage` now displays the existing Kainara logo for missing, malformed, unsupported or failed sources, including when both the main image and its real backup fail. It uses the same fallback for thumbnails, cards, compact rows, hero images and review details. It adds no extra category badges, explanatory cards or stock food photographs. Actual recipe photo attribution remains intact. Accessible labels still identify the meal and state “photo unavailable”.

## Verification

- All **61 focused frontend tests** pass and cover title cleanup, preserved translations/preparation words, missing/error/replaced images, double failures, malformed/unsupported URLs, all fallback variants, source attribution, history and RND canvas rendering.
- Four actual Chromium journeys on `http://localhost:3000`, at 390/1440 px in light/dark themes, verify dashboard and Meals titles, loaded logos for absent/failed images, a decoded Bam-I source photograph and no horizontal overflow. API responses are synthetic and intercepted; these tests do not mutate Neon. Screenshots are in ignored `backend/.local/meal-presentation-audit/`.
- All **28 existing backend image/presentation regressions**, the frontend production build (65 pages), backend build and the audit's dedicated TypeScript check pass. The React review retained hook ordering, derived presentation state, raw identity values and shared components. The Impeccable detector's two warnings concern pre-existing category color definitions which the new fallback does not render; no theme redesign was introduced.
- No migration, database rename, image upload, approval change, new AI request or live deployment occurred.

## Repeat the read-only audit

From the shared checkout's `backend` directory:

```powershell
npx tsc --project tsconfig.meal-presentation-audit.json
npx tsx scripts/audit-meal-presentation.ts
npx tsx scripts/audit-meal-presentation.ts --check-images
```

Metadata and cached provider results remain under `.local/meal-presentation-audit`. `--from-cache` regenerates title/handoff reports without database queries or network image checks. URL checks use six concurrent HEAD requests, a 10-second timeout, explicit public hosts and no redirect following. Keep the captured check timestamps when interpreting cached results. The script contains no database write path.

This original script reports application-resolved images; its local output does not incorporate the separate Cloudinary reconciliation above. Use the committed corrected checklist when supplying photographs. Do not overwrite it with the initial unresolved-image list.
