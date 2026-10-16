# Meal recovery, screening and nutrition guidance

## Scope and boundaries

Implement the approved starter/upcoming recovery, complete-meal selection, shared food guidance and screening, versioned patient constraints and saved report layout. This release is authorized for local and online staging. Demo promotion is separate; do not run demo app requests, test logins or SQL feature checks.

Automated checks identify documented conflicts and missing evidence. They do not establish medical suitability. Recognized onboarding choices retain their routine profile-classification bypass; unresolved declarations, existing questions/declines and required individual meal reviews remain holds. No recipe approval, professional credential or universal diabetes carbohydrate ceiling is invented.

## Recovery and exact decisions

Coalesce acknowledgment wakeups that arrive during preparation into a fresh pass, including when an obsolete revision fails. Completion of queued starter work wakes upcoming preparation. Rebuilding the acknowledged upcoming window carries the signed repair context and replays its original membership admission instead of billing a replacement. Existing job/cycle uniqueness and profile locks remain authoritative.

Exact approval identity now includes the shared food-choice version, applicable activated/suspended policy versions and effective patient constraints. The meal stores a compact clinical-rule fingerprint rather than rereading historical canvas snapshots on every plan read. Changed ages, portions, evidence, rule versions or effective patient limits require revalidation. Future-effective limits are evaluated at the meal's scheduled date. Logged meals and signed review decisions remain historical records. Filling another slot preserves an unchanged manual decision and active pending claim.

## Selection and catalogue operation

Identify taho/desserts/drinks and plain bread/pandesal/condiments/components before primary-slot selection. Distinguish prepared sandwiches, breaded chicken and savory fishcakes. The shared applicability guard covers library serving selection, raw sourcing, generated ingredient preparation, fallback and swaps; final cycle screening is a backstop. Foods remain in the catalogue for logging; classification is not a judgment that a food can never be eaten.

`backend/scripts/reconcile-primary-meal-classifications.ts` defaults to a bounded read-only audit. It requires explicit expected host and database. Apply additionally requires an exact count and a new private rollback receipt path. Only loopback or the explicitly identified existing staging endpoint is admitted. It removes primary-slot applicability, cancels affected future uneaten slots and marks groceries stale, preserving recipes, prior decisions and consumption. Existing partial-plan recovery handles the resulting gaps through normal generation and review; this operator tool makes no provider call and grants no approval. Restore classifications only from a reviewed receipt; do not restore an older database over later member activity.

## Structured guidance and clinical governance

One ingredient preference definition supplies educational Limit/Choose text and bounded ranking adjustments. Exclusions/allergies remain hard gates; ranking cannot override them. Kidney profiles do not inherit general positive food preferences automatically.

Existing condition policy, nutrient/ingredient rule and evidence-source tables remain the default-rule authority. New admin/RND workspaces create inactive, source-attributed drafts. Store population, exact source locator, inputs, units, per-serving/day basis, caveats and version. No deploy is needed to draft another version. Activation uses the existing impact check and two independent current RND approvals, serialized against other policy/profile changes. Admins cannot activate. Screening drafts never enable automatic clinical clearance. Policy decisions and suspension are audited.

Additive migration `20261017050000_patient_nutrition_limits` adds immutable-version patient constraints and `MealPlan.clinicalRuleKey`. Only a currently eligible RND holding the active pending meal claim may list/set/revoke a patient's limits. Lock the member and recheck the profile revision. A replacement names one default rule; unrelated restrictions remain. Independent minima and maxima have separate version scopes. Effective dates, revocation, rationale, source and audit are retained. Saving/revoking updates the safety revision and publishes guidance requiring acknowledgment.

All selection paths screen applicable approved defaults and patient overrides. Hard failures block selection; warnings and unknown measurements require review. Daily rules need complete daily evidence and include recorded outside intake; a missing nutrient remains unknown. Extended micronutrients are reused only for an unchanged library plate with matching base macros. Raw/rescaled/composed plates without exact extended evidence remain unevaluable for those rules. This deliberately limits automation instead of treating missing sodium/sugar as zero. Patient rules do not rewrite old consumption or establish eating clearance.

## Report, PDF and Nara

Use the selected report's snapshot for every available onboarding field, including age, biological sex, activity, measurements, preferences, restrictions, meal times and shopping day. Absent historical fields say Not recorded. Order: recorded profile; explanation; daily planning estimate; BMR/TDEE/goal calculation; protein/fat/carbohydrate calculations; food guidance and sources. Saved grams and energy drive the macro formulas (4/9/4 kcal per gram); rounded percentages are explained. Keep meaningful medical limitations and sources; remove repetitive implementation attribution. Both browser and PDF consume the same saved data. The orange selection outline is disabled only for the member report; canvas zoom and staff selections remain available.

New reports record applicable approved screening rules and patient limits with citations. Existing report snapshots are not silently rewritten. Nara's system help explains screening, exact reuse, meal categories and the remaining review boundary without granting clinical clearance.

## Local evidence

- Full backend suite: **1,187 passing, zero failing, one existing TODO**. Backend build and dedicated script/source TypeScript checks pass. Scoped lint passes with one existing unused-import warning. Full backend lint remains blocked by seven pre-existing Node-global errors in the separate capstone seed script; do not describe it as fully clean.
- **191 affected frontend tests** pass across report, RND and admin-data features. Frontend production build, TypeScript and full lint pass. New tests cover inactive admin drafts, impact/rationale requirements, patient input preservation, role/claim boundaries, rule fingerprints, effective dates, independent minima/maxima, missing evidence, daily totals and report order/border removal.
- Actual fresh loopback PostgreSQL/HTTP: identical diabetic/shellfish accounts reuse an exact omelet decision; age 25 to 24 plus acknowledgment and three concurrent recovery attempts produce six starter and 21 weekly slots. Completed plan admissions remain two. Changed profile rejects old approval; no taho/pandesal primary slots. Actual claimed patient-limit mutation is isolated, refreshes guidance and blocks a synthetic conflict. Member/admin/unclaimed RND/anonymous requests fail. Admin draft cannot activate; two concurrent independent RND decisions activate a non-automating synthetic ruleset. **Zero AI usage events**.
- Real prior-review HTTP/SQL regression: 17 grouped checks across diabetes/allergy, hypertension, kidney disease, heart condition and pregnancy pass. Preserve private context, flags, claims, reviewer expiry, historical decisions, explicit consumption and exact serving evidence. Joined context reads use four SQL queries versus 20 relation-query reads. Update stale fixtures to obey one-active-claim and flag-draft protocols; use an actual declined-profile hold rather than obsolete routine-PENDING classification behavior.
- Four Chromium journeys (390/1440 pixels, light/dark) pass with intercepted API fixtures. Inspect report screenshots and all four generated PDF pages. The report keeps its readable paper surface in both themes and contains desktop zoom. These fixtures do not prove real provider calls or browser sign-in.
- Disposable reconciliation rehearsal narrows taho/pandesal and withdraws one synthetic future slot; a second audit finds zero changes. No catalogue deletion or provider call.

## Release status

The candidate must be archived from its finished commit, built cleanly, migrated on confirmed local/staging targets and pinned to the staging API plus Vercel preview. Preserve credentials and environment-owned member/reference data. Record actual migration checksum, catalogue counts, deployment identity and bounded staging checks below when complete. Demo stays at the previously released application until separately authorized.
