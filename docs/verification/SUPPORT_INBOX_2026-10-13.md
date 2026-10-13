# Contact Support inbox and scroll verification — October 13, 2026

## Scope and activation

Implemented in the shared Desktop checkout on `codex/solar-icons`. The Docs wave hero and auth house/Nara composition remain. The reply email is initialized from the authenticated account without normalizing or replacing its address, and remains editable. Account identity still comes from the authenticated server-side account.

The new additive migration is `20261013095000_support_inbox`. It adds only `SupportRequest`, `SupportReply`, a delivery-status enum, indexes and foreign keys. It was first tested on a fresh synthetic loopback database. After the owner explicitly approved the exact shared target, this migration alone was applied to defense Neon; normal localhost is now activated. Existing member/clinical records were not modified. No live application release, environment variable or credential changed.

## Stored messages and email

- Verified signed-in accounts can contact support before onboarding or RND review completes. Category, a 20–4,000-character message, and a validated reply email are saved. The chosen reply address is not considered a verified account identity.
- Inbox list/detail and replies are ADMIN-only, enforced by the mounted router and service. List pages contain at most 20 summaries and exclude message bodies. Full conversation detail is separate; account/clinical data is not attached.
- The operator receives a copy at the existing fixed support address. Admin replies are stored with author and delivery state and emailed to the request’s saved reply address. The sender is the same configured SMTP/Brevo sender as authentication messages; logging in with an arbitrary Gmail address does not authorize sending as it. Replies to those messages go to the existing support mailbox.
- Storage success and email-provider acceptance are distinct. Provider failures preserve the conversation. PROCESSING/ACCEPTED/UNCONFIRMED record delivery evidence; acceptance does not prove arrival in the recipient inbox.
- Unique account/request and request/reply idempotency keys prevent same-draft retry and concurrent duplicate delivery. Reuse with changed content is rejected. There is no automatic retry after an uncertain provider result. A process failure after sending but before final persistence can leave PROCESSING; manual investigation is required rather than an automatic resend.
- Deleting the member cascades stored requests/replies. Deleting a reply author keeps the conversation with nullable attribution. Copies already sent by email have a separate lifecycle.

## Scroll investigation

The original page-mascot renderer listened to scroll and measured both the visible and CSS-hidden mascot positions. A 2.4-second intercepted-API Chromium scroll measured 260 mascot layout reads. The local MIT-attributed adaptation now coalesces pointer events into animation frames and turns only on pointer movement. The same scroll measured zero mascot layout reads; keyboard/click reactions and reduced-motion static portraits remain.

Desktop p95 frame spacing was approximately 33.3 ms before and after, with no frames over 50 ms in either run. This proves removal of redundant scroll work, **not a measured FPS improvement or a real-phone performance guarantee**. Form backdrop blur was removed on this contact surface. Global header edits belonging to other work were preserved.

## Verification evidence

- Backend support/email: 10 tests pass, including validation, verified-session requirements, unfinished onboarding, escaped HTML, editable reply-to, stored receipts, retries, timeout recovery, and per-account rate limiting.
- Real Express/Prisma/PostgreSQL acceptance: six scenario groups pass on `kainara_support_20261013_6f4dc00c@127.0.0.1:55432`, with the previous committed schema plus the exact migration. Tests cover storage, list/detail, member/RND/anonymous denial, invalid parameters, actual admin reply routing, concurrent duplicate replies, delivery timeout persistence, and both deletion policies. External email calls were intercepted; no real email was sent. Private evidence: `backend/.local/docs-support/inbox-acceptance.json`.
- Existing configured SMTP authentication/connectivity verification passed without sending mail. Recipient inbox arrival is unverified.
- Frontend: four support/auth unit tests pass. Six Docs/support browser journeys plus four admin inbox desktop/mobile/theme journeys and one Nara keyboard/scroll journey pass at actual localhost:3000 with synthetic intercepted API responses. Initial admin-test failures were ambiguous locators matching Next’s route-announcer/breadcrumb; scoped locators pass.
- Browser inspection covers 390/1440 px, light/dark, preserved drafts after failure, editable reply email, successful replies, mobile list/conversation navigation, reduced motion, and no horizontal overflow. Screenshots are local synthetic fixtures, not live delivery evidence.
- Both production builds, changed-file ESLint, focused backend support/email and acceptance-script type checking pass. A standalone broad frontend `tsc --noEmit` also exposed existing unrelated test-fixture typing errors in `PublicFooter.test.tsx` and `useMealLibraryCount.test.tsx`; its full-suite success is not claimed.

## Reproduction

From backend, use `npx tsx scripts/support-inbox-local-acceptance.ts` only with the existing owned loopback Docker database and private local-development credential file. The harness pins the container label, loopback binding and fresh generated database name, reads no backend `.env`, applies the baseline from commit `285ce697`, and intercepts provider delivery.

## Owner-approved shared activation

After local commit `3b57835e`, the owner approved applying only this migration to project `nameless-dust-38810716` (`kainara-defense-20261016`), main branch `br-round-art-b355gp02`, database `neondb`.

- Before the write, the exact project/branch query confirmed `neondb`, no support tables and no completed support migration.
- The committed migration ran as one transaction with 5-second lock and 30-second statement timeouts and Prisma's migration advisory lock. A target/pre-existing-state guard ran before DDL. Only the new enum, tables, indexes, constraints and their Prisma migration receipt were added.
- Committed migration checksum: `dc6c5b6d3c2f268eb79d4c5c15c5601830e28d3ff4a333cfac7d9b1c4f51ef80`. The working SQL file uses the same LF bytes as the committed blob. Subsequent read confirms the exact checksum, both support tables and three validated foreign keys.
- The normal localhost database configuration privately matches the defense endpoint and reads zero requests/zero replies after activation. Local `/ready` returns 200; anonymous `/api/admin/support` returns 401. No account token was fabricated and no member message/reply was submitted on shared Neon during verification.
- SMTP authentication/connectivity passed without sending mail. Real recipient inbox arrival remains unverified; the operator can submit a normal request and answer it from local `/admin/support` to exercise actual delivery.

The local feature is activated. Public application deployment remains a separate step.
