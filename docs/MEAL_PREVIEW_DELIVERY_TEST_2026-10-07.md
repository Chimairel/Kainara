# Meal-preview delivery follow-up — October 7, 2026

## Objective and success criteria

Baseline: development `cc80ccd`. Recheck the earlier member fixtures using the owner's clarified criterion: a member sees actual eligible meal previews or approved meals, without refreshing. Pending review is an acceptable delivery result. A technically correct block or safe coverage failure is **not** counted as successful meal delivery.

Keep four outcomes separate: COMPLETE_DELIVERY (all requested slots), PARTIAL_DELIVERY (some meals plus unresolved slots), NO_DELIVERY (zero meals), and CLARIFICATION_REQUIRED (declared scope cannot yet be evaluated). Report generation-job failure separately from whether meals remain visible. Synthetic reviewer decisions verify software workflows; they are not clinical validation.

## Isolation and batches

1. Clone the retained October 6 disposable system-audit database into task-owned `kainara_meal_preview` on loopback port 55480. Reuse its synthetic members/reviewers. Preserve the original audit database and independent auditor's database. Restore a deleted synthetic fixture only if necessary.
2. Refresh only food/source-recipe references from the shared database using a verified READ ONLY transaction. Import no real members or real review/certification/clearance decisions. Existing synthetic library fixtures remain archived in the baseline, so they cannot disguise actual corpus gaps.
3. Reconfigure the original 17 scenarios through ordinary intake/context/report/profile-review services and authenticated API endpoints. Reset only cloned synthetic plan state and introductory access to remove unrelated prior tracking/expiry effects. Record each reset and retain the original database unchanged.
4. Add selected combined conditions, condition plus multiple allergies, plant-based restrictions, no-rice profiles and calorie-target variation. Reuse a synthetic member between scenarios; no extra real accounts are required.
5. Exercise the production source selector for all 32 subsets of the five predefined allergens across four diets. These are sourcing probes, not 128 new end-to-end accounts or condition suitability findings.
6. Verify source/allergen/diet conflicts are not admitted; pending previews remain non-actionable; generation repeats preserve existing meals; member/staff authorization remains enforced. Test a reviewer decision against an actual selected candidate where available.
7. Save sanitized per-scenario counts and failure codes here, with raw evidence in ignored `.codex-runtime/meal-preview-audit/`. Stop task-owned resources after completion.

## Provider boundary

No live Gemini, email, Google, payment or media calls. Email uses local test capture. Provider keys are disabled in the test process; absence of Gemini means unfilled slots cannot be attributed to a successful AI fallback. Do not invent a replacement recipe, nutrient value or review approval to make delivery pass.

## Results

**Executed October 7, 2026, Manila time.** The original 17 fixture scenarios plus 16 selected harder scenarios were replayed against the cloned database. The harder scenarios reuse one synthetic member between runs. The privacy-deleted pescatarian fixture was restored through registration and captured OTP. These are 33 scenarios, not 33 new accounts or every possible combination.

| Delivery result                          | Original 17 | Harder 16 |  Total |
| ---------------------------------------- | ----------: | --------: | -----: |
| All requested meals delivered            |          10 |        12 | **22** |
| Some meals delivered                     |           1 |         3 |  **4** |
| No meals delivered                       |           3 |         1 |  **4** |
| Clarification required before generation |           3 |         0 |  **3** |

Thus **26/33 scenarios received actual meals**, including pending previews. All four partial scenarios retained their meals in the current-plan API despite the generation job ending FAILED. Full coverage and an absence of failed generation jobs are **not** established.

### Original scenarios

Each attempted current starter plan requested 12 slots on the test date. Counts below precede the subsequent reviewer decisions.

| Scenario                                 | Delivered/requested | Pending | Actionable | Outcome                    |
| ---------------------------------------- | ------------------: | ------: | ---------: | -------------------------- |
| No conditions/allergies                  |               12/12 |       0 |         12 | Complete                   |
| Shellfish allergy only                   |                0/12 |       0 |          0 | No delivery                |
| Nuts + eggs + dairy allergies only       |                0/12 |       0 |          0 | No delivery                |
| Diabetes                                 |               12/12 |      12 |          0 | Complete                   |
| Hypertension                             |               12/12 |      12 |          0 | Complete                   |
| Kidney disease + shellfish               |               12/12 |      12 |          0 | Complete                   |
| Heart condition + nuts + MSG intolerance |               12/12 |      12 |          0 | Complete                   |
| Pregnancy                                |               12/12 |      12 |          0 | Complete                   |
| Gout                                     |               12/12 |      12 |          0 | Complete                   |
| Unlisted condition + unlisted allergy    |    0; no generation |       0 |          0 | Clarification              |
| Pollen allergy                           |    0; no generation |       0 |          0 | Clarification              |
| Myopia + dust mites                      |    0; no generation |       0 |          0 | Clarification              |
| Lactose intolerance + avoid pork         |               12/12 |      12 |          0 | Complete                   |
| Vegan                                    |                8/12 |       0 |          8 | Partial; breakfast missing |
| Vegetarian                               |               12/12 |       0 |         12 | Complete                   |
| Pescatarian, no rice                     |               12/12 |       0 |         12 | Complete                   |
| Shellfish + gluten allergies only        |                0/12 |       0 |          0 | No delivery                |

The last scenario retains its historical fixture key `positive-multi-allergy`; its earlier positive result depended on a separately reviewed synthetic recipe. That fixture was archived for this natural-corpus baseline, so it is not presented as current real-catalogue delivery proof.

### Harder combinations

| Scenario                                    | Delivered/requested | Pending | Actionable | Outcome                    |
| ------------------------------------------- | ------------------: | ------: | ---------: | -------------------------- |
| Diabetes + hypertension                     |               12/12 |      12 |          0 | Complete                   |
| Diabetes + gluten                           |               12/12 |      12 |          0 | Complete                   |
| Hypertension + dairy                        |               12/12 |      12 |          0 | Complete                   |
| Diabetes + nuts + eggs + dairy              |               12/12 |      12 |          0 | Complete                   |
| All five predefined allergens only          |                0/12 |       0 |          0 | No delivery                |
| Diabetes + all five predefined allergens    |               12/12 |      12 |          0 | Complete                   |
| Vegan + diabetes + eggs                     |                8/12 |       8 |          0 | Partial; breakfast missing |
| Vegetarian + diabetes + eggs                |               12/12 |      12 |          0 | Complete                   |
| Pescatarian + hypertension + dairy, no rice |               12/12 |      12 |          0 | Complete                   |
| Kidney + heart + hypertension + shellfish   |               12/12 |      12 |          0 | Complete                   |
| Celiac disease + gluten                     |               12/12 |      12 |          0 | Complete                   |
| PCOS + diabetes                             |               12/12 |      12 |          0 | Complete                   |
| GERD + hypertension                         |               12/12 |      12 |          0 | Complete                   |
| Vegan, 1,401 kcal report target             |                8/12 |       0 |          8 | Partial; breakfast missing |
| Vegan, 3,400 kcal report target             |                8/12 |       0 |          8 | Partial; breakfast missing |
| Diabetes, no rice                           |               12/12 |      12 |          0 | Complete                   |

Other profiles used a 2,238 kcal report target; pregnancy used 2,010 kcal. Targets came from ordinary hypothetical intake/report calculations, not inserted clinical nutrient measurements. The structured catalogue calls diabetes/hypertension **SUPPORTED**; kidney, heart, pregnancy, gout, celiac, PCOS and GERD are **RECOGNIZED_UNSUPPORTED** and require individual review. A pending preview for those cases does not establish condition suitability.

### Exhaustive predefined-allergen sourcing probes

The production raw source selector was exercised for every subset of NUTS/EGGS/DAIRY/SHELLFISH/GLUTEN across four diets, requesting 21 slots at 2,400 kcal with rice permitted.

| Diet        | 21/21 source slots | 14/21 source slots |
| ----------- | -----------------: | -----------------: |
| Omnivore    |                 32 |                  0 |
| Pescatarian |                 32 |                  0 |
| Vegetarian  |                 16 |                 16 |
| Vegan       |                  0 |                 32 |

**80/128 source probes filled every slot; 48 were missing breakfast slots.** All vegetarian subsets containing EGGS lacked breakfast. Every probe produced some source candidates. The deterministic ingredient screen detected no definite declared allergen/diet conflicts in the selected meals. Unknown ingredient/cross-contact evidence still requires review. Candidate repetition is permitted by the production fallback; 21 selected slots does not mean 21 unique recipes. These probes omit macro-coordination targets and clinical condition rules, and are not account journeys or a demonstration of safe meal use.

### Findings and remaining work

1. **Allergy-only admission gap:** the four allergy-only scenarios fail with `NO_REVIEW_FREE_SOURCE`. Their raw recipe pools are not necessarily empty, but supported allergy-only profiles do not enter individual case preparation, and source recipes cannot grant reviewed allergy clearance. Adding a condition sends an account through profile approval and permits pending case candidates. Do not advise members to add a false condition; any allergy-only pending workflow needs an explicit policy decision and equivalent review/actionability gates.
2. **Current shared catalogue lacks complete safety evidence:** a verified READ ONLY count found 2,020 library records: 1,969 APPROVED and 51 ARCHIVED. **Zero active library records have COMPLETE safety evidence; zero profile-matched approvals exist.** There are 51 base verification records marked VERIFIED, which do not confer complete allergy/condition certification. This corroborates the isolated allergy-only admission failure. No real patient/reviewer records were copied or modified.
3. **Vegan breakfast coverage:** all four vegan journeys have real lunch/dinner meals and four missing breakfasts. Raw probes also lack vegan breakfast at 2,400 kcal. The unrestricted vegan jobs fail `NO_REVIEW_FREE_SOURCE`; the diabetes/vegan job fails because Gemini was deliberately unavailable after the source gap. Genuine compatible breakfast sources or a reviewed adaptation are needed. This run does not establish whether a live Gemini fallback would fill that gap.
4. **Clarification cases:** unmapped pollen, dust mites/myopia and invented restrictions remain blocked. These are intended clarification gates, not successful meal delivery. No unsafe bypass was added.
5. **Partial-plan recovery remains limited:** repeated generation preserved populated cycles rather than deleting their existing meals. As recorded in the earlier independent audit, that idempotency does not refill every unresolved slot of a populated failed cycle.
6. **Repeated rejection loop found and repaired:** consecutive reviewer rejections originally produced `Bam-I → Danggit Fried Rice → Bam-I` for the same member/date/meal slot. The selector excluded only the most recently rejected source. Replacement selection now excludes all rejected library IDs, raw source IDs and exact base signatures for that slot; persistence rechecks under the profile lock. Certified fallback uses the same guard, and AI persistence rejects an identical rejected base signature. Rejection audit records and pending-review status are preserved. The AI link also uses conditional slot replacement so an intervening replacement rolls back instead of leaving an extra candidate.

### Reviewer and integration verification

- Ordinary authenticated profile approval enabled generation for recognized cases; unmapped cases rejected approval with `PROFILE_CLARIFICATION_REQUIRED` and created no meals.
- Pending meals rejected DONE mutations with HTTP 409 and did not become actionable. Members received HTTP 403 on admin/nutritionist endpoints. Delivered cycles had unique dated slots, finite positive calorie values, and preserved their cycle on repeat generation.
- Both no-rice journeys persisted no COOKED_RICE components.
- A claimed actual sourced hypertension meal was approved unchanged and immediately appeared as an actionable member meal. Four successive approval probes each saved one audit decision and increased actionable meals from one to four. These were synthetic software decisions, not real clinical review.
- Reviewer rejection saved one decision, preserved the rejected row and offered a new PENDING_REVIEW candidate. Before repair the first replacement included rice within Danggit Fried Rice. After repair, with three and then four prior rejected rows in that slot, replacements used sources absent from the rejection history and persisted a COOKED_RICE side. The member still had zero actionable meals for that restricted plan. Real-database guard probes also rejected another library ID pointing at the rejected source, rejected an identical AI/base signature, and permitted that source in a different dated slot.
- Initial harness corrections (wrong job enum/status expectation and a restarted runner's abandoned background job) were excluded from final product results. The repeated-rejection finding was reproduced independently from those harness errors. Journey batches must run sequentially; the final runner enforces a file lock.

### Evidence and execution

Runner: `backend/scripts/meal-preview-coverage-audit.ts`, phases `original`, `harder`, `sources`, `reviewers`. It requires the exact disposable database, test mode, local mail capture and disabled provider credentials. Setup/preload must occur before imports: direct invocation without the isolated environment is intentionally rejected. Fixture identities/tokens, reference refresh counts, read-only catalogue counts, API logs and sanitized result snapshots are retained in ignored `.codex-runtime/meal-preview-audit/`; they must not be committed.

The source refresh copied 15,072 food references, 1,960 public raw recipes (1,958 available, two retired) and 3,055 meal-applicability rows. It copied no patient records, profile approvals or reviewer governance. Original and independent audit databases were preserved. Task-owned database and API processes are stopped after verification.

HTTP/API and database assertions establish backend delivery and transitions without a browser refresh. This run adds no browser E2E evidence, live Gemini/provider evidence or clinical validation. It does not prove every condition/allergy combination receives a complete plan. **The owner's broader no-failed-plan objective remains unmet for the identified allergy-only and breakfast gaps.**

Final verification: backend suite **786 tests, 785 passed, zero failed, one existing TODO**; backend production build, audit-script TypeScript, changed-file lint/formatting, source architecture and whitespace checks passed. Two older source tests failed initially because they still inspected the former large landing/outside-food files. Their inputs now include the extracted sections; all existing assertions remain. No frontend application change, migration, live provider call or shared database write was made by this task.
