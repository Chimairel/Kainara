# Reported UI and audit issues — October 13, 2026

## Scope and status

Implemented and verified locally in `C:\Users\chima\Desktop\Nutrimind`. Frontend browser checks use the existing **localhost:3000** process from that checkout. Normal API configuration remains **localhost:5000**; browser API requests are intercepted with synthetic data. Real HTTP/SQL checks use a fresh task-owned `127.0.0.1:55432/kainara_auditfix_20261013` database and an ephemeral test listener.

No shared Neon records, migrations, credentials, hosted releases or real push notifications were changed. The current branch stays checked out to preserve unrelated work. Frontend and backend must be integrated and released together before these fixes appear on kainara.site.

## Findings and changes

| Report | Finding | Local behavior |
| --- | --- | --- |
| No notification banner | The supplied screenshot reports provider acceptance, browser receipt and accepted display request. Its Windows tray appears to show Do Not Disturb. These facts do not confirm a visible OS banner. | Distinguishes provider acceptance from browser display, clears an old receipt before a new test, and explains Windows/browser notification settings when a push arrived without a banner. OS suppression cannot be overridden by the website; actual device display remains unverified. |
| RND titles still contain “Recipe” | The local RND queue already uses the shared title formatter. Historical audit field rendering and audit action labels were additional raw-name paths. The live screenshot is not evidence that these local changes were deployed. | Audit subjects, accessible labels and nested recorded meal titles use the same display formatter. Saved source names, signatures and historical evidence are unchanged. |
| Missing left border / square search focus | The global focus outline targets a bare editor inside a rounded search shell. Outside outlines also clip at the left edge of scrollable dialogs. | Text-field focus uses its rounded field boundary; review notes use inset focus. Shared rounded search containers retain keyboard focus, and error fields retain error coloring. Modal close targets are 44 px. |
| Grocery checkbox does nothing | The shown incomplete-at-deadline list requires acknowledgment of excluded meal slots. Its checkboxes were disabled. | As subsequently requested, checkbox clicks now produce Sonner feedback without changing the list. Partial-list feedback offers **Use available meals only**; acknowledgment is explicit and server guards remain. Revalidation holds show their actual reason. Busy/duplicate operations stay disabled. Member-page mobile toasts sit above bottom navigation. |
| Audit shows only policy version | Public summary details did not load the saved review context for RNDs, and admin context needed a separate button. | Shared Details opens a modal with the saved review context automatically. A **Type** column separates meal approval, meal verification, profile verification and other activities. Policy metadata is secondary. Desktop keeps movable papers; mobile shows those same papers at readable width. |
| Case approval missing in library | Member-case decisions and reusable library approvals are different persisted records. An individual approval need not create reusable approval, especially with individual health context or a changed serving. | Library includes **Member case decisions**, linked by saved recipe identity and exact audit decision. Its Details opens the same audit modal. Reusable approval gates are unchanged. |

## Access and historical evidence

- The recorded RND can inspect their own saved clinical evidence. Another currently eligible RND sees immutable meal facts and recorded public attribution, without that member's private profile, answers, notes or original clinical documents.
- Admin retains existing audited clinical oversight, with live member information explicitly separate from the exact saved decision.
- RND context reads are audited. Members, expired/unverified reviewers and arbitrary member selectors cannot access the endpoint. Historical audit access does not grant current clinical-document download access.
- Exact `reviewDecisionId` links choose the recorded decision. Missing older links remain explicit; the newest decision is never silently substituted.
- Recipe case history matches saved library/source identity, not titles or mutable current-plan identity. Same-name meals and foreign decision links are excluded. Older decisions lacking saved recipe identity remain available through Audit, without guessed library association. Future decisions also save these identity fields directly in their existing JSON evidence.
- The new views do not certify a recipe, broaden reusable approvals, release flags, alter plans or bypass claims, food restrictions, rice evidence or review requirements.

## Verification

| Check | Result |
| --- | --- |
| Focused frontend tests | 60 passed across audit, recorded context, recipe case history, titles, groceries and device-notification settings |
| Focused backend tests | 31 passed, including context privacy, exact links, audit contracts, grocery guards and reusable-approval separation |
| Push worker regression | 1 passed; receipt/expiry/display failure and same-origin click handling simulated |
| Real isolated HTTP/SQL | 6 groups passed: audit type/title, own historical context, other-RND redaction, admin saved/live separation, recipe identity matching, authorization/access logs |
| Actual Chromium | 22 audit/grocery journeys passed at 320/390/1440 px as applicable, including both themes; two additional member-case flag/approval-dialog journeys passed in both themes |
| Mobile toast and field confirmation | Four grocery journeys passed with settled toast geometry above navigation, explicit acknowledgment and check/uncheck; two RND journeys verify rounded queue focus and visible inset note borders |
| Static checks | Both production builds, application TypeScript and changed-file lint passed |

The first browser pass found duplicate development-mode context reads and outdated fixture assumptions about expansion and credential status. Those were corrected. Screenshot inspection also found a tiny mobile canvas and mobile toast overlap; the targeted confirmation checks above cover their corrections. JSDOM has no native `matchMedia`; the read-only document adapter handles its absence.

This is scoped verification, not a claim that the entire application or hosted release has no defects. Browser data is synthetic; API/SQL verification is local and isolated. No live OS banner, external push provider, production account mutation or hosted publication was exercised.

## Screenshots

All images show synthetic records on the shared localhost:3000 frontend.

- [RND audit modal and saved papers — desktop/dark](assets/defense-bugfixes-20261013/audit-desktop-dark.png)
- [Readable audit papers — mobile/light](assets/defense-bugfixes-20261013/audit-mobile-light.png)
- [Pending grocery feedback above mobile navigation](assets/defense-bugfixes-20261013/grocery-mobile-feedback.png)
- [Review notes with visible left border and rounded focus](assets/defense-bugfixes-20261013/review-note-focus.png)

## Run the bounded checks

From `frontend/`, use `npx vitest run` with the audit, grocery, recipe-case-history, title and device-settings test paths. With the normal frontend already running on 3000, set `NUTRIMIND_REPAIR_E2E=true` and run `npx playwright test e2e/audit-details.spec.ts e2e/defense-bugfixes.spec.ts --workers=1`. The member-case test in `e2e/flag-resolution-canvas.spec.ts` covers approval-note focus and existing flag resolution.

From `backend/`, run the named audit/grocery/reuse tests with `npx tsx --test`. `scripts/audit-context-local-acceptance.ts` refuses any target except its empty task-owned loopback database, test mode and absent external provider keys. Apply migrations only to that isolated fixture before running it. Never run it with the normal shared-Neon configuration.
