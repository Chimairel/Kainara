# UI and workflow state verification — October 10, 2026

## Scope

Follow-up to the real-browser report, prompted by the empty Health details SVG appearing beneath RND forms. Checked member health forms, correction responses, historical guidance, dashboard dates/hydration and RND case actions. Three existing agents initially split source inspection; they stopped at the usage limit. The primary agent finished review, browser checks and verification without starting additional agents.

The connected in-app browser used real member/RND sessions at isolated localhost and 127.0.0.1 origins on port 3002, with the preserved synthetic database on loopback port 55488. Normal localhost:3000 and shared Neon were not mutated. External provider delivery was disabled. No browser API mocking or injected authentication was used.

## Findings and fixes

| Issue | Correction and evidence |
| --- | --- |
| Empty-health SVG beneath RND forms/history | Empty state now requires no detail areas, requirements, RND requests, forms, proposals or assessments, and no error. Browser verified populated desktop/phone/light/dark screens without the SVG. Component tests cover awaiting, answered, resolved and historical forms, correction cards, loading and errors. Genuine empty profiles retain the illustration. |
| Saved answer/correction reported as failed after refresh failed | Separate committed writes from refresh errors. Keep recorded-success feedback, disable stale submissions and offer a refresh-only retry. Tests verify one POST, same-key write retry and accept/request-correction paths. |
| Newly sent questions missing from an open member screen | Visible polling/focus/live events refresh persisted review work without resetting unsent drafts. Stale refreshes are discarded; saving pauses background refresh. Browser verified a second form arriving without navigation and preservation of an answer draft. |
| External safety changes could invalidate an open draft | Keep unsent detail text, disable saving and ask the member to reload current details when safety revision changes. Component test verifies no write and explicit reload. |
| Hidden claim-release errors inside fullscreen RND canvas | Display non-modal action errors inside canvas actions, including claimed cases. Regression tests cover fullscreen and preview errors. |
| Old recipe credential overlay surviving a swap/case change | Clear the selected verifier when the case, swap visibility or options change. Component tests cover each transition. |
| Failed or wrong-case detail response left a blank panel | Validate success and returned case identity, expose the existing retryable error and prevent claims without details. Hook tests verify both invalid response forms. |
| Rapid duplicate RND actions before React updated busy state | Use a synchronous action token for claim, release, approve, reject and legacy replacement; old-account completion cannot clear a newer action. Hook regressions cover duplicate submissions and account changes. Server authorization/version gates remain intact. |
| Reordered unchanged health declarations created corrections | Compare canonical safety entries in stable domain/text order. Backend service test proves reordered/merged unchanged sections produce no proposal or write, while a genuine removed declaration still requires acknowledgment. |
| Dashboard polling jumped back to today | Keep date selection by calendar date and account/cycle scope. Tests cover polling, inserted dates, withdrawn dates and account/cycle changes. Browser retained Friday after background updates. |
| Historical report selector retained stale record objects | Keep version identity and derive current selected content from refreshed history. Regression verifies the selected historical record updates without leaking latest content. |
| Today’s water displayed/loggable under a different day | Water total and controls now appear only on today’s dashboard. Past/future dates show an explicit today-only message. Browser verified past-day controls absent; tests retain today’s functioning controls and cover past/future selection. |

The draft safety guard is part of the new live-refresh fix; the other rows represent eleven distinct defects or contradictory states.

## Browser observations

- Populated member history: accepted/superseded proposals and historical answered forms remain readable, with no empty SVG. Phone layouts at 390 px have no document-width overflow in light or dark mode.
- Two newly sent RND forms appeared on the open member screen. The second arrived while the first contained unsent text; its draft survived and the URL remained unchanged.
- Both member responses reached the RND canvas, were resolved there, and the member saw the resulting read-only resolved state. Profile revision and selected report remained 3; questions/answers alone did not require acknowledgment. Profile confirmation remained a separate claimed action.
- Dashboard retained the selected Friday through background updates and showed no today-water controls beneath that historical date.
- A browser command timeout was retried after observing that the profile was still unclaimed. A development hot-update dependency warning arose while hook source was being edited; a fresh document load is the final rendering check. These are not counted as new product defects.

## Regression verification

- Backend: **884 passed**, zero failed, one existing TODO (885 total).
- Frontend: **875 component tests across 186 files**, plus **eight Node checks**, passed.
- Backend/frontend production builds, lint and the global source architecture guard including all 21 entry-point budgets passed.
- Newly found failure/race cases were reproduced with controlled component/service tests. This run does not claim every fault was induced in the actual browser, every feature is bug-free, hosted/provider behavior or clinical validity. Previous HTTP and real-browser reports remain evidence for authorization and full governance journeys.
- No migration or shared feature enablement was applied. The existing five pending migrations and demo promotion remain separate rollout work.

## Evidence

- [Populated Health details on phone](verification/ui-logic-2026-10-10/health-forms-phone.jpg)
- [Populated Health details in dark mode](verification/ui-logic-2026-10-10/health-forms-phone-dark.jpg)
- [Current resolved RND forms](verification/ui-logic-2026-10-10/health-live-forms.jpg)
- [Historical dashboard day and hydration message](verification/ui-logic-2026-10-10/past-day-tracking.jpg)
