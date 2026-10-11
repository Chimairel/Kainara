# Member confirmation refresh — October 12, 2026

## Cause and correction

The owner reported that confirming a pending member in the RND queue left the member dashboard showing Nara's waiting state until a page reload. Profile-review status and the full meal plan refreshed separately. A missed live event, or an older blocked plan request still in flight, could leave the waiting state visible after confirmation.

The shared `useClinicalProfileGate` hook now revalidates pending or failed profile status every 15 seconds while visible, and ready status every 60 seconds. Live updates, focus and visibility catch-up remain; hidden tabs pause interval polling. State and late responses are scoped to the account and safety revision.

When a previously pending/error status becomes ready, Dashboard and Meals explicitly reload the current plan. Dashboard waits for an older read and then requests a fresh plan; Meals invalidates its account-scoped plan resource and forces a fresh read. A successful read clears stale clinical errors. Nara shows preparation when the backend reports preparation, or displays saved meals when they are already ready. Cooking need not appear if preparation has already finished.

The full-plan fallback remains 120 seconds when settled and three seconds while eligible preparation is in progress. Meals does not enter the fast full-plan poll while profile review remains pending. No new automatic generation POST, clinical approval, database migration or backend change was added. The existing backend approval worker and server-side clinical/report gates remain authoritative. This bounded polling change was not subjected to a new quantitative transfer rehearsal; the earlier recovery budget evidence remains specific to its recorded workload.

## Verification

- **43 focused tests across six files passed** in development and the isolated release checkout: Dashboard workspace, clinical-profile gate, Meals workspace, meal-swap refresh, visible polling and clinical-profile status.
- New regressions cover missed live updates, the pending → cooking → saved-meals transition, a blocked plan read crossing confirmation, hidden/focus behavior, and late responses after account or safety-revision changes. Existing report acknowledgment, clinical holds, retained history and swap behavior remain covered.
- The missed-event Dashboard regression failed against the previous implementation and passed with the correction. Private before-fix log: `backend/.local/profile-confirmation-before-fix.log`.
- TypeScript, targeted ESLint, formatting, source architecture budgets and production build/page generation passed. The production build generated all 62 routes.
- The actual production frontend ran against an isolated in-memory loopback API with no database or AI connection. No live refresh event was emitted. Without reloading, the dashboard changed from waiting to the cooking image (`/logo/preparing.svg`), then showed the prepared-plan state and three pending meal previews. The fixture was initialized on October 11 and the browser rehearsal crossed midnight into October 12; selecting October 11 exposed its scheduled previews. That date selection was not a page reload.
- One bounded public synthetic-member login checked Dashboard and Meals on the published release. Both retained the account's existing “Meal planning isn't available yet” clinical-information gate, with no browser console errors. No clinical approval, member form or generation action was submitted. The test session was signed out. The complete confirmation transition was verified locally, not repeated as a live clinical mutation.

Private screenshots (not tracked):

- `backend/.local/profile-confirmation-waiting.jpg`
- `backend/.local/profile-confirmation-cooking.jpg`
- `backend/.local/profile-confirmation-meals.jpg`
- `backend/.local/profile-confirmation-live.jpg`

The temporary fixture processes and browser tabs were closed after verification.

## Published release and rollback

| Component | Exact commit | Deployment |
| --- | --- | --- |
| Development implementation | `fa92b55d64954c91cf4c102b527893ea11f567c9` | Pushed to `origin/development` |
| Production frontend | `e57e630eae00f1d87f368724638da1e6f5fc4a0d` | Vercel `dpl_Cw6k6yPpJAKsjdbbmabgJ9J79ivz`, **READY** |
| Compatible API, unchanged | `5a9c025fe97a1d2848a6f40a9ff32578061111a4` | Railway `24a6ce5f-4554-4b3c-a9aa-d20aebd9d880` |

The exact production SHA and both `kainara.site` / `www.kainara.site` aliases were verified in the official Vercel receipt. Private receipt: `.vercel/profile-confirmation-deployment.json` in the release checkout. The narrow release contains the five frontend implementation/test files and preserves the preceding UI refinements. Database targets, deployed secrets and environment variables were unchanged.

Existing open tabs should reload once to load the new frontend bundle. Subsequent confirmation updates do not require manual refresh.

Immediate frontend rollback: Vercel `dpl_F33ixRnrEsU2ct2kBBGUNxvJguwH`, commit `52752a92e264b000eb464cbad272efc7da8fc8f4`. Promote the previous frontend if needed; no database restore or API rollback is required. That rollback restores the former refresh behavior.
