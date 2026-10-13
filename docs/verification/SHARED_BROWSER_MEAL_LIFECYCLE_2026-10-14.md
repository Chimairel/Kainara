# Shared-runtime browser lifecycle — October 14, 2026

## Result: PASS

The owner explicitly directed this rerun to the shared localhost servers. Every meal transition was performed using the in-app browser UI: ordinary sign-in/logout, admin authoring form, RND queue, claim controls, confirmation form, flag modal, resolution inputs, library tabs and audit dialogs. There were no intercepted API responses, scripted API mutations, direct SQL writes, account creation or database credential changes during this shared journey.

- Frontend: `http://localhost:3000`; API: normal shared `localhost:5000`. `/health` reports capstone-demo mode. The shared release record identifies its defense Neon database; using localhost does not make the data isolated.
- Checkout: `C:/Users/chima/Desktop/Nutrimind`, implementation commit `bde73bb4`, with pre-existing unrelated changes preserved.
- One new meal: **QA Browser Lifecycle 20261014**, ID `cmv6y90l90004vc1fd3380uli`. Its description and review notes explicitly identify synthetic QA data and deny clinical approval.
- Existing repository-seeded test accounts were reused: Admin User; Andrea Reyes (original verifier); Beatriz Cruz (flagger); Carlo Mendoza (independent reviewer). No account or credential reset was performed.
- Desktop review required a viewport of at least 1024px; the browser was temporarily set to 1440 × 1000. The original viewport was restored afterward.

## Observed browser sequence

| Step | Browser evidence |
| --- | --- |
| Admin creates meal | Author meals form selected Lunch and an existing FNRI “Squash fruit, boiled” record at 100 g; clicking Create unreviewed meal draft yielded **1 submission**, “Awaiting RND evidence review.” |
| Andrea verifies | Reviews → Meal verification → search → exact QA recipe → Claim verification → Approve → Review rationale → Verify base meal. Verified catalogue contained the recipe; detail attributed it to Andrea. Audit time: **01:27, October 14, UTC+8**. |
| Beatriz flags | Exact recipe header → Flag meal → structured sodium concern → Flag and withhold meal. State became Pending re-review, with Beatriz's notes intact. Audit time: **01:29**. |
| Involved RNDs excluded | Beatriz's Claim re-review was disabled. After normal logout/sign-in as Andrea, Reviews → Meal verification → pending incident → Review meal showed both Claim re-review and Re-verify recipe disabled, with the independent-review explanation. |
| Carlo claims | Same pending queue link showed an enabled Claim re-review for Carlo and the original ingredient/portion and Beatriz's exact concern, reference and proposed correction. After claiming, per-concern resolution editing was available. Audit records the claim at **01:32**. |
| Carlo resolves | Filled “How you resolved this concern,” clicked Mark resolved, supplied Independent review findings, checked evidence acknowledgement and clicked Re-verify recipe. State returned to Verified; attribution changed to Carlo. Reopening the Verified catalogue and searching the exact name returned **1 total record**. |
| Beatriz flags again | Normal account switch; same recipe → Flag meal → distinct second-incident notes → Flag and withhold meal. State became Quarantined. Audit time: **01:35**. |
| Correct final queue | Quarantined tab contained the exact QA recipe, state Quarantined, **incident 2**. The RND detail had **zero Claim re-review controls**. Final admin Verified search returned **No Meals Found**; admin Quarantined showed the same incident-two row. |
| Traceable audit | RND audit contained Andrea's verification, both flags/withholding, Carlo's independent claim, saved resolution and re-verification. Admin activity contained the meal creation at **01:23**. Admin → RND history → Resolved meal concerns Details → Review change → Incident 1 Independent confirmation rendered Carlo's exact saved per-concern resolution alongside Beatriz's original notes, with incident 1 marked Released. |

The selected audit confirmation displayed:

> QA resolution: independently inspected the saved squash ingredient, 100 g portion, preparation instructions and recorded sodium field. Values remain synthetic; no health-context approval was granted.

## Scope and final state

- The synthetic record remains **Quarantined, incident 2**, preserving both incidents and audit history for owner inspection. No unrelated meal was flagged, verified or edited.
- Returning to the meal page was verified in the staff **Verified catalogue and recipe detail**. This rerun did not exercise member planning or grant serving/health-context approval. The prior isolated member-Library evidence remains separately documented.
- No console error was recorded by the browser during this walkthrough. Async server refreshes briefly showed prior state/loading; final assertions waited for visible results.
- Audit currently presents both its flag event and legacy flag summary, plus the separate withholding change. This preserves the trace but means a single flag has multiple summary rows; no deduplication change is claimed here.
- The owner-started shared servers remained running at ports 3000 and 5000. The aborted isolated helper at port 5002 was stopped; no configuration file was changed. Test account logged out, temporary viewport reset and temporary browser tab closed.
- No application source changed in this rerun and no release was deployed. This is browser acceptance evidence, not a new build/test-suite claim.

## Local evidence

Screenshots are saved under `backend/.local/shared-browser-lifecycle-20261014/`:

- `01-original-verification.png`
- `02-first-flag.png`
- `03-original-verifier-excluded.png`
- `04-independent-resolution.png`
- `05-republished-by-carlo.png`
- `06-returned-to-verified.png`
- `07-quarantined.png`
- `08-rnd-audit.png`
- `09-admin-resolution-audit.png`
- `10-final-verified-exclusion.png`
- `11-final-shared-quarantine.png`

These show actual shared UI state. Credentials, cookies and tokens are excluded from this tracked report.
