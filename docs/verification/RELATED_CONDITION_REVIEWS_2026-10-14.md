# Related condition reviews — October 14, 2026

## Behavior

An eligible RND can open **Related reviews** beside the current case's claim action. The control adds and focuses a movable reference sheet inside the canvas, where the RND can choose a condition recorded in that case and search completed meal decisions by their saved meal name. Supported filters are diabetes, hypertension, kidney disease, heart condition and pregnancy. The control is absent for a case without one of these conditions. Opening history does not require a claim or change the current review draft.

The list uses the latest human decision for each other meal case, matched against its immutable recorded condition. Results include approvals and rejections; a shared condition is sufficient for browsing even when the profile and serving differ. Today's source-member condition is not substituted for the reviewed condition. Older decisions without saved condition evidence cannot appear through reconstruction of today's profile.

Each row shows the saved meal name, outcome, original RND name and review date. **View** expands saved nutrition and ingredient amounts/units/references. Missing values are labelled as not recorded. An approved source case that is no longer approved or needs safety revalidation is labelled **No longer cleared**. These are historical decisions, not eligibility endorsements; the existing exact full-context approval-reuse policy remains separate.

## Access and implementation

- `GET /api/nutritionist/queue/:id/condition-reviews` requires current RND eligibility and access to the active target case. The selected condition must belong to that case. Current profile/guidance readiness and the supplied review-context version are checked, including a post-query context recheck.
- The response contains meal evidence and reviewer attribution only. Other member identities, case/plan identifiers, profile fields, documents, answers, reviewer notes, rationale and private fingerprints are excluded. There is no link or approval action granting access to the source case.
- Requests validate condition, page and search length. Search uses bound literal substring parameters. Database pagination is ten rows, with ingredient projection capped at 100 per decision and calculated after selecting the page. No full clinical snapshot is transferred to the application for listing.
- The reference sheet reuses ReviewDocumentPage, Input, NativeSelect, WorkspaceTable, Pagination and MealIngredientTable. It loads on demand, debounces search, aborts stale requests and uses Sonner for failures. Account, target and context changes invalidate the request. The original modal implementation was superseded by the owner's canvas-placement correction below.
- No schema migration or provider/configuration change is required.

## Initial verification (modal placement, subsequently superseded)

Final checks completed around **2026-10-13 18:48 UTC / October 14 PHT**.

- **16 real PostgreSQL/HTTP scenarios passed**, extending the exact-reuse acceptance suite. A fresh ownership-checked loopback database contains 15 fictional accounts and is removed after the run. Related-review coverage verifies saved heart-condition evidence, differing recorded profiles/servings, source-member condition changes, approval and rejection, pagination without duplicate rows, literal search/injection resistance, privacy canaries, non-RND denial, invalid filters and stale context. Browsing leaves the target pending. Existing exact-reuse scenarios continue to pass.
- **Six focused frontend tests passed**, covering demand loading, saved evidence including zero nutrition, condition/page changes, failed loading and retry, no-condition cases, stale-response suppression and existing case-document rendering. Scoped ESLint, backend build, acceptance-script TypeScript and frontend production build passed.
- **Shared browser verification:** normal UI sign-in with the existing seeded RND account on localhost:3000/5000; open a current heart-condition case without claiming it; open Related reviews; observe three real completed reviews; expand Chicken Enchilada Casserole's saved macros and ingredient table; search an absent name and observe the empty result; close with Escape and reopen with Enter; inspect light and dark themes. The narrower desktop check reported a 1233 CSS-pixel viewport, 1221-pixel page width and a 1024-pixel dialog, with no page overflow. No mobile RND journey is claimed.
- The API briefly restarted during compilation and the existing account boundary recovered. Final browser console inspection returned no errors. Theme/viewport overrides were restored, the test account logged out and the temporary tab closed.

No new shared account, meal, profile, claim, decision or hosted fixture was submitted for this check. The browser used the existing shared database; synthetic acceptance writes stayed in the disposable local database. No deployment or clinical validation is claimed.

## Reproduce

From `backend`:

```powershell
npx tsx scripts/exact-meal-approval-reuse-local-acceptance.ts
npx tsc --project tsconfig.exact-meal-reuse.json
npm run build
```

From `frontend`:

```powershell
npx vitest run src/features/nutritionist-reviews/RelatedConditionReviews.test.tsx src/features/nutritionist-reviews/CaseReviewDocument.test.tsx
npx eslint src/features/nutritionist-reviews/RelatedConditionReviews.tsx src/features/nutritionist-reviews/RelatedConditionReviews.test.tsx src/features/nutritionist-reviews/CaseReviewDocument.tsx
npm run build
```

Local browser proof is under `backend/.local/related-condition-reviews-20261014/`: `heart-evidence-light.png` and `heart-evidence-dark-1024.png` (the latter filename records the requested viewport override, not the measured CSS viewport).

## Canvas placement correction

The owner clarified that **Related reviews** should remain available and open references inside the canvas. The existing button is retained. It now appends one movable **Related condition reviews** paper after the existing case sheets, focuses it at a readable width, and leaves the existing sheet positions intact. Repeated activation focuses the same sheet. The current case and reference remain available together for panning, zooming and comparison.

The reference content no longer creates its own dialog. Condition, search, page and expanded evidence state live with the case document so they survive fullscreen transitions. A different meal or context version requires opening references afresh. Related-table wheel scrolling stays native; Ctrl/Command wheel still zooms the canvas. Paper table headings and outcome text retain light-paper contrast in either portal theme. Conditional clarification/form page numbering remains sequential.

The reference endpoint now uses the same 90-second default read budget as current review details; explicit shorter budgets remain respected. This does not add retries or alter decision/reuse policy.

Verification: **26 focused frontend tests**, scoped ESLint, the layout detector and the frontend production build pass. Tests cover demand loading from the retained action, actual sheet containment and selection, no additional dialog, repeated activation, preserved search/evidence in fullscreen, source-sheet positions, readable focus, case switching, table wheel behavior and request budgets. Backend policy and endpoints are unchanged, so the prior PostgreSQL/HTTP evidence remains the backend verification.

The shared browser opened the reference content inside the existing canvas world as page 5, with one fullscreen canvas dialog. Current case reads subsequently timed out, and reference loading failed during this inspection; the read budget was aligned after that failure. This follow-up does not claim a completed final live-data browser journey or a resolution of the shared API's case-loading latency. No claim, decision, account, meal, schema or provider configuration was changed.
