# Condition relevance assessments

RND profile confirmation can separately record `NO_ADDITIONAL_RESTRICTIONS` for an individual custom condition. The diagnosis, original text, canonical code and intake support state remain unchanged. The member is never relabeled as having `NONE`.

## Review workflow

In **Reviews → Member queue**, claim the profile and review its current health details. For a condition outside the existing dietary catalogue, select **No additional meal restrictions identified**, provide a rationale, and explicitly confirm assessment of both dietary/treatment effects and foodborne illness/handling needs. Submit **Confirm for planning**. Missing health forms, other unresolved declarations, expired credentials, competing claims or stale scope/version prevent confirmation.

The existing dietary catalogue (including heart/kidney conditions, diabetes, hypertension, pregnancy and recognised custom dietary conditions) retains its governed checks. Food allergies, intolerances and avoided ingredients cannot use this condition exception. The feature is a member-specific RND assessment, not an automatic diagnosis classifier or a white-blood-cell cutoff.

## Recorded evidence and enforcement

- `SafetyProfileEntry.mealPlanningAssessment` is the server-maintained active assessment cache. It records the explicit result, condition/member identity, reviewed profile/safety revision, RND identity and name, linked profile review, time, rationale and the two confirmations.
- The signed `ClinicalProfileReview.profileSnapshot.conditionAssessments` and `CLINICAL_PROFILE_REVIEWED` audit metadata retain historical decisions. Admin case-scoped, read-only oversight exposes them and records sensitive access. Ordinary audit summaries continue excluding private clinical rationale.
- The central restriction adapter omits only a valid assessed condition from effective planning restrictions. Complete declarations and assessment attribution remain available for profile/history displays. Saved nutrition report declarations retain the diagnosis, while calculated guidance uses effective restrictions. Recipe verification, holds, allergy checks and remaining condition checks still apply; this assessment never certifies or releases a recipe.
- User profile and health-details responses expose the recorded assessment. The health details page displays it and keeps treatment details editable. RND case sheets show the relevance result alongside the original declaration.
- Profile revision changes clear active assessments. Changed treatment/context answers, document uploads/replacements/withdrawals and document review changes clear them, invalidate assessment-bound profile approval and retain historical evidence. Clinical writes serialize against profile assessment. Signed scope includes material document identity/revision/status/hash, but not claim-only timestamps.
- Member, admin and RND HTTP mutations cannot import an assessment through ordinary intake/profile fields. Only the eligible RND profile-confirmation endpoint writes it. No shared accounts are preclassified.

## Deployment and verification

The additive migration `202610090002_condition_planning_assessment` adds one nullable JSONB column without rewriting existing records. Apply it before starting the updated API. Shared database application requires the README database-target confirmation and backup procedure; hosted demo promotion is separate.

`npm run test:acceptance:condition-assessment` requires a fresh disposable `127.0.0.1:55488/kainara_condition_assessment` PostgreSQL database, `NODE_ENV=test` and disabled external providers. It tests actual RND/member/admin HTTP and database behavior. Run it only against that fixture target; it intentionally creates synthetic records and rejects nonempty targets. It is software verification, not clinical validation.

The distinction informing the workflow is supported by [CDC foodborne illness risk guidance](https://www.cdc.gov/food-safety/risk-factors/index.html), [FoodSafety.gov guidance](https://www.foodsafety.gov/people-at-risk/people-with-weakened-immune-systems), and [AHA dietary guidance](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics/aha-diet-and-lifestyle-recommendations). These sources do not establish an automatic condition-exclusion rule.
