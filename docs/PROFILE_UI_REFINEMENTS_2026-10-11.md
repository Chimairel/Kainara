# Profile UI refinements — October 11, 2026

## Continuous RND guidance sheet

The profile review canvas embedded the standalone nutrition report's paper presentation inside its own paper sheet. An explicit inline presentation now keeps the report in the existing Saved guidance and evidence sheet, without nested paper backgrounds, shadows, fixed page heights or duplicate page footers. All report sections, references, saved profile context, versions and disclaimers remain available. The standalone member report retains its original paper presentation.

The narrow frontend release also includes the previously approved shared button design: solid orange primary actions and flat secondary surfaces. Claim, release, profile decisions and clarification/correction buttons retain their existing actions and disabled/loading behavior.

Published on `demo` at `1f921460bfad84cd0ff3eb57b997144d0380fe1a`; Vercel `dpl_ENg2mEWseAHKo8AcBz3XvR1CLVnR` is READY and owns both public domain aliases. Eleven focused report/canvas tests, TypeScript, targeted lint, architecture checks and a production build passed. Isolated browser inspection covered full report content in both themes. An ordinary live synthetic RND preview confirmed zero nested paper-page markers, correct heading levels and no gradient on Claim profile. No review was claimed or submitted. Screenshots: ignored `backend/.local/review-guidance-{light,dark,live}.jpg`.

## Shared profile settings layout

Food preferences and meal reminder settings share one flat surface, separated by rules. The reusable ProfileSettingsSection places section titles and explanatory text beside controls on desktop and above them on mobile. ProfileSettingsSurface supplies the common container, and ProfileSectionHeader supplies the form hierarchy. These components are also used by Health & goals, Conditions & allergies and the Health details inbox/reader. The inbox retains search, filters, mobile reader navigation and separately mounted drafts. Food labels use normal case and clearer weight; shopping-day selection has its own row. Cycle timing remains visible beside the preferences save action. Membership terms and reminder delivery details are expandable, preserving their full copy. Separate save boundaries, timezone/time validation, reminder switches, account isolation and device permission actions remain unchanged.

Profile safety categories reuse WorkspaceTabs with the existing peach accent, and declaration choices reuse Button. A regression case verifies that switching categories retains a recorded condition and previews both that condition and the new allergy. Default onboarding category presentation remains available. No safety catalogue or preview/save payload rules changed.

Development source: `3da4bf8a`. Narrow release source: `f6d5f6b500e85772821bef74dcd453573949132a`. Thirty-seven focused tests across safety intake, clinical evidence and reminders pass in both checkouts. TypeScript, targeted lint, architecture budgets and production compilation/page generation pass. Local browser verification used an isolated in-memory fixture with no database connection. Preference and reminder saves, disclosure expansion, both themes and 390-pixel viewport containment were checked. Profile UI screenshots are under ignored `backend/.local/planning-*` and `backend/.local/profile-*` paths. Fixture saves are not hosted backend acceptance evidence.

This is a frontend presentation update. It changes no database schema, backend behavior, deployed environment variables, clinical approval rules or saved member records. The compatible Railway API remains `5a9c025fe97a1d2848a6f40a9ff32578061111a4`, deployment `24a6ce5f-4554-4b3c-a9aa-d20aebd9d880`.

Vercel production deployment `dpl_FH1N7iid8ew5kWdexSu6syMa566r` is READY at the exact release commit above, with `kainara.site` and `www.kainara.site` aliases. One ordinary live synthetic member session checked Food & planning, Health & goals, safety-category navigation and Health details. The account's saved preferences and existing resolved question were visible; no profile, safety declaration, notification permission or clinical form was changed. Save food preferences has no background gradient. The actual public browser check used the mobile viewport; desktop and both-theme checks used the isolated production fixture build. Screenshots: `backend/.local/profile-{planning,health,details}-live.jpg`. Provider receipts are excluded `.vercel/profile-ui-deployment.json` in the release worktree.

### Rollback

The last working frontend before the continuous-sheet update is `dpl_DCNabzchQkUHPsMkFdV7SdRRZfXR` at `5a2f8307`. The continuous-sheet release above is the rollback target for the later Food & planning layout. Promote the appropriate previous frontend only; no database restore is needed. Reload existing tabs after promotion.

## Compact nested tabs

`WorkspaceTabs` now accepts `level="secondary"`. This supplies the existing ribbon peach (`#f09e6c`), 12px semibold labels, 14px icons and a desktop rail that fits equal-width controls. The desktop child rail measures 46px tall against the 62px primary rail; mobile controls reserve a 44px minimum touch height. Long category sets can stack on mobile. The highlight remains within its own rail, with native links/buttons, keyboard focus and reduced-motion behavior. Existing primary navigation defaults remain unchanged.

Profile body/safety sections and food safety categories, admin analytics, RND case filters and reference sources, and grocery status filters use this shared variant. Development also updates the existing license-update view; that separate feature is excluded from the narrow hosted release. Source: development `a0bec6229c50067f632f8c779e9556a581020011`; narrow frontend release `52752a92e264b000eb464cbad272efc7da8fc8f4`.

Ten focused safety-intake, RND tab and admin analytics tests pass in both checkouts. TypeScript, targeted lint, source architecture budgets, the Impeccable layout scan and isolated production compilation/page generation pass. Synthetic local browser checks verify both themes, desktop label containment, equal control/indicator widths, click navigation and Enter selection. Screenshots: ignored `backend/.local/nested-tabs-{light,dark}.jpg`. The browser viewport override did not change the actual 1280px viewport in this run; mobile sizing was inspected in source and is not claimed as a rendered mobile check. No profile or clinical mutation was submitted.

The previous working frontend for this update is `dpl_FH1N7iid8ew5kWdexSu6syMa566r` at `f6d5f6b500e85772821bef74dcd453573949132a`. Backend, schema, environment and review authorization remain unchanged; a frontend rollback needs no database restore.

Vercel production `dpl_F33ixRnrEsU2ct2kBBGUNxvJguwH` is READY at the exact release commit above and owns `kainara.site` and `www.kainara.site`. A bounded ordinary live synthetic member check confirmed the 62px parent and 46px child rails, the peach active fill and successful Conditions & allergies selection. No member form was saved. Screenshot: ignored `backend/.local/nested-tabs-live.jpg`; provider receipt: excluded `.vercel/nested-tabs-deployment.json` in the release checkout. The test session was signed out afterward.
