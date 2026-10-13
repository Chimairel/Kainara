# Admin audit activity cleanup — October 13, 2026

## Behavior

Admin audit lists and related timelines exclude read-only events ending in `_ACCESSED`, including sensitive review details/files, meal-log details, license documents and saved RND context. Filtering happens in the database before counting and paging, and applies to both staff tabs within Admin Audit. Actual RND access changes such as revocation remain visible.

Underlying access records and their writers remain intact. Detail authorization, clinical access logging and the nutritionist portal's existing history are unchanged. No audit rows are deleted and no schema migration is required. Meal creation/update/import receive clearer labels, with Meal changes and Meal images filters in the existing interface.

## Evidence

- 15 focused backend tests pass: admin route authorization, strict filters and server-owned changes-only selection, historical detail privacy, nutritionist visibility and timestamps.
- Five frontend workspace tests pass: filters, pagination, related timeline, retry, and meal/access change filters.
- `backend/scripts/admin-audit-changes-local-acceptance.ts` passes against a fresh synthetic PostgreSQL database in the owned loopback Docker container. It verifies real SQL exclusion before counts/paging, related and RND rows, action filters, creation labels, and all ten underlying events retained. It verifies container ownership and the explicit 127.0.0.1:55432 binding before creating its fixture; it does not read the normal backend environment.
- Four intercepted Chromium admin case-report journeys pass on localhost:3000 at 390/1440 px in light/dark. Existing modal/canvas and mobile paper reading remain usable.
- Both production builds, changed-file frontend ESLint, focused script/route TypeScript checking and `git diff --check` pass.

Implemented in the shared Desktop checkout. No hosted database changes, deployment, email delivery or load test occurred. Full repository test-suite status is not inferred from these focused checks.
