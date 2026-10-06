# Candidate delivery, acknowledgement gates and auth layout follow-up

Change ID: **CHG-20261007-02**. Date: **2026-10-07**.

This follows the [delivery audit](MEAL_PREVIEW_DELIVERY_TEST_2026-10-07.md). The owner authorized catalogue edits to supply candidates, including pending previews, and requested consistent pre-acknowledgement actions and illustrations. Additional requests concerned auth-page movement and removing two Google helper lines.

## Causes and repairs

1. **Allergy-only delivery incorrectly used membership/profile review policy.** Known allergies do not mandate an individual profile review, but they still require meal evidence. Composition applied the unrestricted, review-free source filter to these users, leaving empty plans. A separate `requiresMealCandidateReview` policy now permits screened proposals for known allergies, including allergy-only accounts. The same policy applies to the missing-slot AI queue. Membership, unsupported-declaration clarification, clinical evidence and approval gates remain in their respective policies. Source proposals stay pending; they do not become usable just because they match ingredients.
2. **Plant breakfast metadata was incomplete.** Sago pearls and vanilla extract were treated as unknown animal-risk ingredients, making Homemade Taho omnivore-only. Classifier V4 recognizes those precise plant tokens; known milk/egg additions and unknown ingredients still retain conservative classification. A guarded catalogue transaction corrected Taho's dietary tags and standalone rice role, added three breakfast applicability proposals, and assigned Sauteed Spinach's proposed rice pairing. This supplies breakfast choices under the existing serving-scale/calorie/rice rules without rewriting recipes.
3. **Dashboard exposed food logging before report acceptance.** The API already rejected it, but the header button and modal were present. Both now depend on report readiness. The weekly-plan shortcut is hidden at the same stage.
4. **Weight was unnecessarily behind meal readiness.** Both weight endpoints now require verified email, completed onboarding and current consent, without requiring report acknowledgement. Progress history and personalization remain available. Session updates after profile/weight changes use the backend's authoritative `reportAcknowledged` value, preserving a valid accepted planning baseline when a newer draft becomes stale.
5. **Action-required illustrations differed across pages.** The shared action-needed state now defaults to the existing sleeping SVG in both themes. Access-denied states keep their separate illustration.
6. **Auth forms could remount during session resolution; Google arrival and scrollbars could shift geometry.** Public forms remain mounted while protected pages retain their loading/auth guards. The Google button has a reserved 44-pixel slot, and the document reserves a stable scrollbar gutter. Removed the permanent “Google window didn’t open?” link and “New here? Continuing with Google creates your account.” text. Actual timeout/error and embedded-browser recovery remain available.

## Catalogue transaction

`backend/scripts/repair-plant-breakfast-candidate.ts` defaults to a read-only dry-run. Apply requires an explicit target matching either the exact development Neon host/database or the disposable preview database. It uses a serializable transaction, an advisory lock and optimistic source timestamps/signatures. Recipe identity, published nutrients and classification are checked; ingredient/nutrition/signature preservation is asserted after writes.

| Published source | Metadata change | Basis |
| --- | --- | --- |
| [Homemade Taho](https://panlasangpinoy.com/filipino-street-food-homemade-taho-recipe/) | Four compatible diet tags; proposed standalone rice role | Publisher describes breakfast; tofu, sago, water, sugar and vanilla are retained |
| [Sinangag](https://panlasangpinoy.com/sinangag-recipe/) | Proposed BREAKFAST applicability; existing included-rice role retained | Publisher explicitly describes breakfast use |
| [Sweet and Sour Tofu](https://panlasangpinoy.com/sweet-and-sour-tofu-recipe/) | Proposed BREAKFAST applicability; existing rice-pair role retained | User-authorized slot proposal for the unchanged plant dish; no publisher breakfast claim |
| [Sauteed Spinach](https://panlasangpinoy.com/sauteed-spinach/) | Proposed BREAKFAST applicability and rice-pair role | User-authorized slot proposal for the unchanged plant dish; no publisher breakfast claim |

Applied to the verified shared development target after isolated testing. A subsequent dry-run found no remaining changes. **Zero ingredient, serving, published-nutrient or clinical-approval changes.** Three applicability rows are PROPOSED, not nutritionist-reviewed. The read-only post-apply library counts remain 1,969 APPROVED / 51 ARCHIVED, zero active COMPLETE safety evidence and zero profile approvals. Source compatibility does not establish allergen absence, cross-contact clearance or condition suitability.

## Before initial report acknowledgement

| Action | Availability |
| --- | --- |
| Review/generate/acknowledge nutrition report | Available after existing onboarding/consent prerequisites |
| Personalization, health details, account/privacy settings, membership | Available under existing route permissions |
| Progress history and logging today's weight | Available after verified email, onboarding and current consent |
| Food/snack logging, meal preparation/current plan, meal status/swap and water logging | Blocked by existing complete meal-readiness chain; dashboard hides food/weekly-plan controls |
| Grocery checklist | Shows shared action-required state; server blocks until report acceptance |

Safety changes can invalidate the accepted planning baseline. An ordinary weight change does not automatically revoke a still-valid baseline. The report gate is checked on the server even if the UI is bypassed.

## Delivery retest

Reused the 17 original synthetic members and 16 harder combinations in task-owned PostgreSQL on loopback port 55480. No new shared accounts or real clinical decisions were created. Every eligible tested scenario requested 12 starter slots in the execution window. Below are observations before separate reviewer probes.

| Scenario | Previous result | Retest | Pending | Actionable |
| --- | --- | --- | --- | --- |
| No declarations | Complete | 12/12 | 0 | 12 |
| Shellfish | None | 12/12 | 12 | 0 |
| Nuts + eggs + dairy | None | 12/12 | 12 | 0 |
| Diabetes | Complete | 12/12 | 12 | 0 |
| Hypertension | Complete | 12/12 | 12 | 0 |
| Kidney + shellfish | Complete | 12/12 | 12 | 0 |
| Heart + nuts + MSG intolerance | Complete | 12/12 | 12 | 0 |
| Pregnancy | Complete | 12/12 | 12 | 0 |
| Gout | Complete | 12/12 | 12 | 0 |
| Unknown condition/allergy | Clarification | Clarification | — | 0 |
| Pollen | Clarification | Clarification | — | 0 |
| Myopia + dust mites | Clarification | Clarification | — | 0 |
| Lactose intolerance + avoid pork | Complete | 12/12 | 12 | 0 |
| Vegan | Partial | 12/12 | 0 | 12 |
| Vegetarian | Complete | 12/12 | 0 | 12 |
| Pescatarian, no rice | Complete | 12/12 | 0 | 12 |
| Shellfish + gluten | None | 12/12 | 12 | 0 |
| Diabetes + hypertension | Complete | 12/12 | 12 | 0 |
| Diabetes + gluten | Complete | 12/12 | 12 | 0 |
| Hypertension + dairy | Complete | 12/12 | 12 | 0 |
| Diabetes + nuts + eggs + dairy | Complete | 12/12 | 12 | 0 |
| All five predefined allergens | None | 12/12 | 12 | 0 |
| Diabetes + all five allergens | Complete | 12/12 | 12 | 0 |
| Vegan + diabetes + eggs | Partial | 12/12 | 12 | 0 |
| Vegetarian + diabetes + eggs | Complete | 12/12 | 12 | 0 |
| Pescatarian + hypertension + dairy | Complete | 12/12 | 12 | 0 |
| Kidney + heart + hypertension + shellfish | Complete | 12/12 | 12 | 0 |
| Celiac + gluten | Complete | 12/12 | 12 | 0 |
| PCOS + diabetes | Complete | 12/12 | 12 | 0 |
| GERD + hypertension | Complete | 12/12 | 12 | 0 |
| Vegan, 1,401 kcal target | Partial | 12/12 | 0 | 12 |
| Vegan, 3,400 kcal target | Partial | 12/12 | 0 | 12 |
| Diabetes, no rice | Complete | 12/12 | 12 | 0 |

**30 complete, zero partial/failed eligible outcomes, three clarification-required outcomes.** One first gout observation was taken while its job was GENERATING; the runner now waits after the current-plan read that can enqueue preparation. Its corrected rerun produced 12/12. The three unsupported/unclear cases still cannot generate by design.

All **128** predefined-allergen-subset/diet source probes now supply **21/21** screened slots at the fixed 2,400 kcal WITH_RICE target, compared with 80 complete / 48 breakfast-deficient before. These are selector probes, not 128 clinical approvals or exhaustive condition/calorie combinations.

## Verification and limits

- Backend suite: **788 total; 787 passed, zero failed, one existing TODO**. Classifier tests include Taho, milk/egg additions and unknown ingredients; meal-review tests distinguish known allergy review from membership/profile review.
- Frontend: **686 tests across 148 files passed**. Regression checks cover hidden/restored dashboard actions, public/protected route guards, sleeping defaults, removed Google help and accepted-report session updates after weight changes.
- Actual isolated HTTP: allergy-only candidate claim/approval succeeds without an individual profile-review prerequisite, and the approved meal becomes actionable. Condition candidate approval still works. Consecutive rejection replaces the source without revisiting rejected identities, keeps the replacement pending, and retains either composed rice or source-included rice.
- Actual isolated HTTP: five pre-ack meal actions return `409 REPORT_ACKNOWLEDGEMENT_REQUIRED`; both weight paths, personalization and progress history succeed; no generation job exists before acknowledgement. After acknowledgement, current-plan access succeeds and malformed food logging reaches normal validation. Further weight logging preserves the accepted planning baseline.
- Production Chromium: **eight auth layout cases passed**, login/register/forgot/reset at 1440 and 390 pixels. A delayed synthetic Google SDK button leaves form card coordinates/dimensions within one pixel; both removed lines are absent and no horizontal overflow occurs.
- Backend/frontend production builds, audit/repair script TypeScript, changed-file lint, formatting, source architecture and diff whitespace checks passed.

Live Gemini, Google authentication, SMTP, hosted deployment and physical-device speaker/browser behavior were not exercised. Synthetic approvals verify software workflow, not human clinical validation. Existing populated partial cycles are not automatically replaced by this catalogue edit; this retest concerns fresh preparation. Local evidence is retained under ignored `.codex-runtime/meal-preview-audit`; secret-bearing fixture state is not committed. Other tools' uncommitted files and audit containers were preserved. Integration target: development.
