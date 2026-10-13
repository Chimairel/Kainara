# Meal library detail, approvals and flag dialog - October 13, 2026

## Current interface

This supersedes the earlier section-link and separate approvals-panel layout in commit `3342be41`, following the owner's subsequent references and corrections.

- Dedicated `LibraryMealHeader` combines the existing dashboard colored surface with the cropped library photo. The image spans the left edge on desktop; mobile stacks image and content. Title is 30/36px, serving text 16px, and nutrition text 14/16px. Flag meal stays inside the card at the lower right. Existing meal themes and Solar icons are reused; shared dashboard and catalogue components retain their original defaults.
- Meal details is the first/default tab, Approvals second. There is no Meal review tab. Recorded verifier attribution and its credential modal reuse the member components. A source-only meal does not acquire a fictional human verifier. The representative-photo badge is hidden in the header, while saved image kind/alt and photo attribution remain intact.
- Approvals uses the shared Audit table, Type column, pagination and Details modal for both RND and admin. The backend applies approval-action and meal-family filters before totals/paging. Plan decisions match their immutable saved evidence, not the current meal pointer. Reusable rechecks link to their approval entity. Missing historical identity links stay explicitly unavailable rather than being inferred from mutable records. Existing role-specific context permissions remain in force; an approval row is not a new clinical clearance.
- Flag fields are in the shared modal, with bounded scrolling and a persistent action footer. Cancel/conflicts retain the draft, successful saves close/clear it, and Sonner reports outcomes. Structured notes and version binding remain required. Re-review concern resolution, claims and quarantine administration remain under Meal details for held meals, retaining all previous gates.

## Verification

- 20 frontend tests pass: flag/review behavior (3), shared admin/RND workspace (9), audit table/modal role endpoints (5), and detail request races (3).
- 17 focused backend tests pass, covering admin live-role protection and strict history query validation, public audit details, exact saved RND context and audit query binding.
- Real PostgreSQL acceptance: `backend/scripts/meal-approval-audit-local-acceptance.ts` uses a fresh synthetic database in the ownership-checked loopback container. Checks include family serving variants, reusable approval rechecks, approval-only counts/pagination, excluded unrelated/rejected/access events, retained audit records, and saved identity after the live meal pointer changes.
- Ten intercepted Chromium journeys pass on localhost:3000: four 390/1440px light/dark detail journeys (default/order, attribution modal, approval table/Details, in-card flag, retained conflict draft, focus return and Sonner), plus six existing RND/admin governance/import journeys. Desktop/mobile screenshots in both themes were visually inspected together. Synthetic photo/content are test fixtures, not production meal evidence.
- Scoped ESLint, both production builds and owned-file diff whitespace checks pass. One stale reviewer-name selector was corrected to match the existing RND-suffix normalization. Earlier captures from superseded layouts are not current evidence.

No hosted records, schema, provider email or live application deployment were changed. Finished changes are committed locally in the shared Desktop checkout; publishing is separate.

## Subsequent owner-requested simplification

- Removed the reusable recipe evidence review and adaptation/serving editors entirely from the library detail and held-meal review. Deleted their unused components and obsolete derivation-form tests. Existing flag, resolution and quarantine behavior remains covered by the shared workspace tests.
- Removed serving wording from the header and detail body, photo/source notes and the adaptation-lineage paragraph. Below the existing verifier presentation, Meal details now contains the description followed by ingredients. This supersedes the visible attribution/serving wording described above; stored meal/image evidence is unchanged.
- Twelve focused flag/workspace tests and scoped lint pass after the final edits. Four desktop/mobile light/dark browser journeys and a production frontend build passed after editor removal; the final text-only deletion was then checked by TypeScript and the focused tests.
