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

- **96 `MISSING` meals** have no usable assigned/source/reviewed image in the current presentation contract, across 124 source/library records. Supply those photos first.
- **4 `BROKEN_SECONDARY_URL` meals** have a failed backup video thumbnail, but their main recipe photographs work. These are optional replacements rather than missing main photographs.

Fill `your_image_filename` and `attribution_or_ownership`, or send photos named after the `meal` column. The `record_ids` column links matching source/library entries; title cleanup never becomes an identity-matching shortcut. Existing approved Cloudinary uploads and reviewed photographs retain priority and provenance. This checklist includes authored/demo entries as well as the imported catalogue; an image assignment is not recipe certification.

[Per-record handoff](meal-images/audit-2026-10-13/image-handoff.csv) retains the original titles, exact IDs, source links and failing URLs.

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
