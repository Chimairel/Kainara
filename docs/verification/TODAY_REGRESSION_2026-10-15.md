# October 15 regression verification

## Scope and environment

Verified the member and RND review changes through `53ff23bb`, including structured swap filters, meal reference ranges, planned-day projection, canvas controls, claims, decisions and optional outside-food feedback. Testing used the shared checkout and normal localhost frontend/API on ports 3000/5000. Existing unrelated working-copy edits were preserved and are not part of this test-repair commit.

Database fixture scripts explicitly guarded the existing defense target: Neon project `nameless-dust-38810716`, branch `br-round-art-b355gp02`, database `neondb`. All mutation cases belonged to the existing synthetic `devfixture_exact-browser-1014_first` member. No real-member decision was submitted. No migration, restore, seed, nutrient backfill, secret change, provider AI request or hosted deployment was performed in this regression pass.

## Automated results

| Check | Result |
| --- | --- |
| Full backend `npm test`, including test TypeScript compilation | 1,079 passed, 1 existing TODO, 0 failed |
| Full frontend `npm test` | 233 Vitest files / 1,198 tests passed; 8 Node checks passed |
| Frontend `tsc --noEmit` | Passed |
| Scoped ESLint for six repaired test files | Passed |
| Frontend production build | Passed; 66 pages generated |
| SavedApprovalCanvas follow-up after strengthening the mobile assertion | 7 passed |

The first frontend run exposed tests rendering themed canvases without their real ThemeProvider. Six test files now supply it. The saved-review mobile test also checked an outdated toolbar element rather than its hidden drawer ancestor; that assertion now requires the view toolbar to exist and have a hidden ancestor. Global browser stubs are restored in `afterEach` even when an assertion fails. No production component was altered for these repairs.

One unsent-draft workspace test failed on the initial concurrent run, then passed unchanged in isolation and in the complete rerun. This remains an observed timing-sensitive test result, not evidence of a production defect or a fix to that test. Non-failing jsdom media/navigation notices were present in the full run.

## Browser, API and stored-state checks

### Canvas and exclusive claims — passed

- An unclaimed synthetic case allowed Move/Hand while Swap, Approve, Reject and Add page were disabled.
- Fullscreen expand/collapse, theme switching, the view-control drawer and Move/Hand switching worked. The expand tooltip did not remain after toggling fullscreen.
- The profile information sheet displayed nutrition guidance, while meal evidence listed ingredients and all ten nutrition fields. This old copied fixture legitimately lacked some historical micronutrients; these stayed unknown. The selected current source candidate contained all ten fields.
- Claiming a case, returning to the queue and reopening it preserved the claim. The claimed row appeared first. A second synthetic case could be previewed but its claim was blocked with the finish-current-review state.

### Structured replacement search and ranges — passed

- The initial search returned **24 of 40** eligible candidates with continuation, rather than a single recommendation.
- Applying food term **pork**, **protein at least 20 g** and **sodium at most 1,500 mg** returned four candidates. Selecting Pork Tapsilog showed 31.5 g protein and 865.5 mg sodium, alongside the remaining nutrition facts.
- Breakfast planning ranges were energy **634–860 kcal**, protein **18.7–28 g**, carbohydrate **102.7–140.1 g** and fat **12.5–24.9 g**, using the saved daily-reference fixture and existing allocation policy.
- Expanding the planned-day comparison identified missing lunch/dinner and labeled the totals incomplete. It did not claim a partial day met the full daily range.

### Actual swap, approval and rejection — passed

- Confirmed a real browser/API swap from `qa-today-approve-20261015` to Pork Tapsilog. The old row was superseded and cancelled; replacement `b7b9de6a-340e-433e-bd12-f80ec41c646a` stayed pending and claimed. Only the swap dialog closed; the fullscreen canvas remained open with the replacement evidence.
- Submitted an explicit approval rationale. Approval closed the canvas and removed the case from the pending queue. The member dashboard and plan subsequently displayed the approved replacement.
- The second copied Pandesal fixture initially matched an existing approval and was automatically approved. To exercise a distinct rejection case, only that synthetic fixture's serving totals were changed by 0.4 kcal / 0.1 g protein, with a fixture audit entry. This observation is not claimed as a new two-member exact-reuse E2E test.
- Opened a replacement search, recorded no suitable replacement, and submitted a rejection rationale. The canvas closed, the case left the queue, and the UI reported that the slot was held unavailable with automatic replacement stopped.
- SQL checks confirmed one PRIMARY APPROVE, one PRIMARY REJECT and the corresponding `MEAL_PLAN_SLOT_REPLACED_PENDING_REVIEW`, `MEAL_PLAN_APPROVED` and `MEAL_PLAN_REJECTED` audit events.
- Sonner success calls for swaps and decisions passed the automated hook/component regressions. The short-lived browser toasts were not captured reliably; browser evidence establishes the resulting canvas and queue states, not toast duration.

### Optional outside-food feedback, both roles — passed

1. A saved synthetic food already counted in member intake before any feedback request.
2. The member opened its history details, saw **Get RND feedback** and the existing Health Plan allowance, and submitted the request through the normal UI/API. History changed to **RND feedback requested**.
3. The RND's Outside food logs activity count increased from one to two while Pending retained its independent count. The synthetic food appeared in the queue.
4. The RND opened the shared canvas, inspected the recorded food, used Write feedback to create a reasoning page, and sent a clearly identified software-test message. No approve/reject or claim step was needed. Submission closed the canvas, removed the request and returned the outside-feedback count to one.
5. The member signed in again, received the **RND feedback on your food** notification and saw **RND feedback received** with the saved message in history.
6. Before cleanup, SQL assertions confirmed exactly one feedback message, notification and `OUTSIDE_MEAL_FEEDBACK_SENT` audit event. Energy/protein/carbohydrate/fat stayed **200 kcal / 10 g / 20 g / 8 g**; source, nutrition status and item revision 0 stayed unchanged by feedback.
7. The member then voided the synthetic food through the normal UI. Active totals became zero; history and the revision-0 feedback were retained. The normal void action advanced the item revision to 1.

No captured browser console errors were present at the end of these checks. Browser/API requests for the synthetic swap, decisions, feedback request and feedback submission succeeded.

## Cleanup — verified

- Both synthetic root plans and their replacement are CANCELLED with no remaining claim.
- The synthetic food log is VOIDED and absent from active intake; its message and audit remain.
- The original synthetic saved nutrition-report content was restored exactly from the private backup and compared after restoration.
- The two decision records and the swap/approval/rejection/feedback audit records remain traceable.
- Existing accounts, other queued records and the older voided feedback fixture were preserved.

Private local verification scripts and logs are under `backend/.local/` and are not committed. Final cleanup assertions passed in `today-regression-cleanup-check.ts`.

## Evidence and limits

Local screenshots, intentionally not committed:

- `codex_outputs/today-regression-swap-ranges-20261015.png`
- `codex_outputs/today-regression-feedback-draft-20261015.png`
- `codex_outputs/today-regression-member-feedback-20261015.png`

This establishes the listed software behavior on shared localhost. It is not clinical validation, a hosted deployment check, a live AI-generation test, a load test, or a new browser rehearsal of every older workflow. Automated coverage supplies the broader regression checks, including saved review replay, independent-reviewer restrictions and revision/concurrency failures.
