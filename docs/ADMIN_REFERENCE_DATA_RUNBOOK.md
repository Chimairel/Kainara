# Admin Reference Data Runbook

This runbook governs source metadata, retained release history and FNRI aliases. The ENNS aggregate-consumption and regional-planning workflow was retired on October 11, 2026. Its authenticated endpoints return `410 FEATURE_RETIRED`, its controls are removed, and its retained metadata is historical. Source/release operations for other nutrition domains remain available. Publishing reference data does not confer clinical approval.

## Current operation

Use **Admin → Nutrition data → Sources & releases** for current source metadata and **FNRI catalogue** / **USDA catalogue** to inspect nutrient evidence. Verified aliases must identify the same FNRI food, preserve attribution, and avoid collisions with canonical food names or other aliases. Successful catalogue changes invalidate the backend matching cache immediately; otherwise its lifetime is ten minutes. Canonical nutrient corrections require the separately reviewed composition workflow.

The recovery copy omits 2,620 retired ENNS rows while retaining source, release, activation and audit references. Original archives retain the rows. See [October 16 recovery](DEFENSE_RECOVERY_2026-10-11.md) for verification and rollback boundaries. Do not reactivate a `FOOD_CONSUMPTION` release: the API rejects source writes, staging and activation for that retired domain.

## Historical workflow — no longer available

The sections below describe the former importer and publication workflow for interpreting old audit records. Their screen names and commands are not instructions for the current application.

## Responsibility boundary

- Administrators register sources, preserve provenance and terms, import aggregate evidence, resolve source-to-FNRI identity, and publish or restore releases.
- Nutritionists alone clinically approve meals and safety evidence. Publishing a data release never certifies a recipe.
- Application code owns schemas, validation, calculations, authorization, and safety rules.
- The database owns dynamic source metadata, immutable published observations, mappings, and activation history.
- Canonical FNRI nutrient values are read-only in the admin workspace. Corrections require a separately reviewed composition-data workflow rather than an in-place edit.

## Accepted inputs

The first implemented importer accepts a UTF-8 aggregate CSV with no more than 1,000 rows and a request body below the API's 256 KB JSON limit. It does not accept respondent-level records.

Required columns:

```text
population_group,geography_level,food_name
```

Supported optional columns:

```text
region_code,region_name,province_huc_code,province_huc_name,place_type,rank,percent_consuming,mean_intake_g,sample_size
```

Geography rules:

- `NATIONAL`: region and province/HUC must be blank.
- `REGION`: `region_name` is required and province/HUC must be blank.
- `PROVINCE_HUC`: both `region_name` and `province_huc_name` are required.

The template is downloadable from **Admin → Data → Aggregate consumption import**. Every file is parsed strictly, duplicate row identities are rejected, and the exact uploaded text receives a SHA-256 fingerprint.

## Publication workflow

1. Register the official source, agency, homepage, access/terms URL, required attribution, and expected update cadence.
2. Create a uniquely labelled draft release with its official source URL, survey year where applicable, and retrieval timestamp.
3. Import the aggregate CSV. Importing again replaces only that draft's rows in one transaction.
4. Inspect mappings. Exact canonical FNRI names and verified aliases map automatically. Ambiguous names remain `REVIEW_REQUIRED`; unknown labels remain `UNMAPPED`.
5. Map ambiguous rows manually to the intended FNRI record. The actor and mapping are recorded in the audit log.
6. Stage the release. A consumption release cannot be staged with zero rows, no file hash, or unresolved ambiguity. Unmapped aggregate labels may remain visible because they can retain survey value without pretending to have nutrient identity.
7. Publish the staged release after reviewing the confirmation. Publication atomically retires the current active release from the same source and records an activation event.
8. Verify generation behavior. Active, nationally aggregated, explicitly mapped foods become familiarity/accessibility hints for unmatched-slot generation; clinical and calorie constraints always take priority.

Published consumption rows are immutable. Corrections require a new release.

## Rollback

Only a retired release can be restored. From its release card, choose **Restore** and confirm. The operation atomically retires the current release, reactivates the selected historical release, and writes both an activation record and an audit event. It does not delete newer evidence.

## FNRI aliases

Use a verified alias only when two labels refer to the same FNRI food identity. The system normalizes spelling separators and rejects a label that collides with another canonical food or verified alias. Aliases can improve both runtime FNRI lookup and future consumption imports, so they are administrative evidence—not informal search tags.

## Source freshness

The source record keeps an update-cadence expectation, while every release keeps publication and retrieval dates. When an official agency issues new evidence:

1. keep the old release;
2. create a new version;
3. import and reconcile it independently;
4. compare mapping and coverage counts;
5. stage and publish it;
6. restore the previous release if downstream review finds a defect.

This preserves historical reproducibility. NutriMind does not scrape or silently replace official survey data on a schedule.

## Restricted FNRI survey files

If DOST-FNRI requires a personal user agreement for public-use files, the person obtaining the data must personally accept those terms. Do not automate acceptance, redistribute restricted raw files into the repository, or upload personally identifiable/respondent-level data through the admin CSV endpoint. Derive and document an authorized aggregate table first.

## Local verification

The committed acceptance script is locked to the task-owned loopback database name and port used during development:

```powershell
Set-Location backend
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55463/nutrimind_admin_data?schema=public'
npm run test:acceptance:admin-data-local
```

Migration application against any shared database is a separate, target-specific action. Confirm authorization, snapshot the target, and apply migrations before starting application code that queries the new models.
