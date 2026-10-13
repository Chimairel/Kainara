# Meal library approvals and flag dialog — October 13, 2026

## Interface

- Existing meal detail header now has a clear **View approvals** shortcut for RNDs, with section links for meal details, approvals and meal-wide review. Approvals follow meal details, ahead of evidence/correction editors and review history. Actual member case decisions and reusable approvals remain separate inside the existing approvals component.
- **Flag meal** opens the shared accessible modal in the RND and admin meal library. The former inline accordion and fields are removed from normal page flow. Held meals can add evidence through the same modal; their review canvas, per-concern resolution, claim and quarantine controls remain on the page.
- Required structured notes, field lengths and exact recipe-version payload are preserved. Cancel retains the draft for that meal, server failure retains the open form, and a recorded flag closes and clears it. A synchronous guard prevents duplicate sends. Sonner reports flag outcomes, including recorded actions whose subsequent refresh failed. Header-trigger focus returns after closing. Archived meals cannot be flagged from the header.
- Existing themes, Solar icons and shared modal/approval components are reused. Mobile modal fields use 16px text and bounded scrolling. Admin does not receive private RND approval tools through this layout change.

## Verification

- 18 focused frontend tests pass across review panel, shared admin/RND library, approvals and detail request races. Older workspace fixtures were brought into line with existing independent claims and explicit concern resolutions; those controls were not relaxed.
- Four new intercepted Chromium journeys pass at 390/1440 px in light/dark: approvals navigation, initially absent flag fields, modal cancel/reopen, keyboard focus, retained conflict draft, exact version-bound payload, successful close and Sonner feedback. Six existing governance journeys also pass, including role-specific quarantine controls and admin draft import presentation.
- Changed-file ESLint, production frontend build and `git diff --check` pass. Browser requests use synthetic intercepted APIs; no real flag or hosted record was changed. The backend/schema is unchanged.

Implemented in the shared Desktop checkout, with publishing separate. Screenshot artifacts are in ignored Playwright output.
