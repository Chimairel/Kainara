# Nutrition report and saved-food feedback

## Requested workflow

The member report now explains how kcal are calculated alongside its existing macro estimates. Current report prose is produced by deterministic KAINARA guidance rules, not Gemini; conversational wording did not establish AI use. Desktop reports reuse the RND canvas, with document-contained wheel zoom/pan and unscaled surrounding controls. Current-format mobile reports keep their readable inline presentation.

After onboarding, current-report acknowledgment, check-in and saved health/planning/weight changes, return to Home. Existing sleeping Nara identifies a missing current acknowledgment and links to the report. Report, evidence, membership, profile clarification and meal-specific review requirements still govern actions. Acknowledgment failure stays recoverable on the report; it does not navigate as though saved. Pending membership selection is retained, but report acknowledgment now returns Home as requested.

Outside-food capture is **preview → save → optional feedback**. The feedback prompt appears only after durable save; its X/Escape dismisses without deleting intake or consuming a request. Feedback failure keeps the saved log and offers retry. History replaces the personal-note editor/preview with RND feedback, current request status, replies and the same request button when eligible. Existing personal notes remain stored/exportable; no data deletion or historical rewrite. Preparation details supplied during capture remain separate input context. Scheduled meal logs direct members to their existing meal review rather than inventing an outside-food feedback request.

## Calculation evidence and compatibility

- Extract the existing energy calculator's intermediate values while preserving its old return shape and arithmetic. No calorie-policy changes, new targets or invented therapeutic rules.
- Derive the displayed breakdown from the selected NutritionReportVersion's profile snapshot. Show unavailable for incomplete snapshots; never fill an archive from the live profile. Disclose stored-target differences and the calculator's default/pregnancy coefficient. Add the data to existing current/history/version report responses and the existing server PDF. No schema migration or stored report rewrite.
- Formula source is the repository's Mifflin–St Jeor reference. Activity factors, goal adjustments and the 500-kcal implementation floor are software rules, not claims supported by that paper or a recommended intake.
- Existing separate food-review API and one-meal allowance/idempotency remain unchanged. The UI no longer submits `requestRndReview` with food save. Owner changes, duplicate clicks, save recovery, image-upload failure and optional request errors retain their existing boundaries. Received feedback is not nutrition certification or medical clearance.

## Verification

- Backend full suite: **1,172 passing, zero failing, one existing TODO**; TypeScript and production build pass. Calculation tests bind intermediate precision, old calculator compatibility, archive isolation, sex/pregnancy coefficients and unavailable data. Nara tests cover the new free workflows.
- Frontend full suite initially reports 1,320 passing and one outdated landing-page redirect expectation. Update that expectation for the requested Home route; the five landing tests and twelve outside-log hook tests pass on rerun. All other 248 frontend files passed in the full run. Additional focused report, modal, history, onboarding and acknowledgment tests pass. Frontend production build and TypeScript pass.
- Provider-free HTTP/SQL acceptance in a fresh loopback-only `kainara_report_feedback_acceptance` database verifies actual report/current/history/archived calculation fields, archive isolation after a live-profile edit, real PDF response, one saved food log before a separate review request and pending feedback in History. No shared local/staging/demo records are changed. Zero Gemini usage events.
- Chromium fixtures intercept every API request. Four desktop/mobile × light/dark journeys verify report reading, frame-stable canvas zoom, preview without a request button, save then optional prompt, dismissal without a request, later history request without another food save, and sleeping-Nara Home acknowledgment. Screenshots inspected in a bounded pass. Initial browser fixture needed the current JWT `iat` field and the actual modal Close label; corrected the fixture, without weakening auth or modal behavior. These are browser fixtures, not live clinical review or a real Google sign-in test.
- Impeccable detector reports no findings on the changed report/prompt/feedback surfaces. Hosted/staging release evidence follows when executed. Demo remains separate; no demo app or SQL tests.

### Committed release verification

Commit `f178d40e54f2ac977de9707be54e029d8d8a3bc6` is pushed to development and staging. Build both apps and repeat the full backend suite from a clean archive of that commit: 1,172 passing, zero failing, one existing TODO. Repeat 239 affected frontend tests and frontend TypeScript successfully. The archive frontend build completes, with the same Windows dependency-junction standalone trace-copy warning recorded for the earlier release; this is not a verified portable standalone package.

The clean archive full frontend run records 1,320 passing and one intermittent existing MealQuestions submission fixture failure (zero mocked requests before its wait deadline). Both tests in that unchanged file pass immediately in isolation. Retain that limitation rather than claiming an uninterrupted full frontend pass. No production MealQuestions code changed. The four Chromium journeys pass, including all new actions.

Restart only the isolated laptop staging API using that exact compiled archive and the existing separate staging Neon database. Public tunnel HTTP confirms calorie calculation fields and retains recognized-profile admission, unknown-profile hold and anonymous rejection. Temporary synthetic records are removed; provider-event delta is zero. Vercel staging frontend readiness and preview checks are recorded separately when complete.

### Staging ready at 01:18 UTC+8

Vercel `dpl_3B2jQjG4jX39CZo4oAyQtAbbgg92` is READY at `f178d40e54f2ac977de9707be54e029d8d8a3bc6` and owns the existing `nutrimindv1-git-codex-staging-chimairels-projects.vercel.app` alias. The existing staging share access remains usable. Preview HTTP validates owner-scoped report calculation fields, recognized condition admission, unknown-condition hold and anonymous rejection. All temporary fixtures are removed, and provider usage-event delta is zero. The final hosted check observes slow successful requests (approximately 7–27 seconds in the API logs); this is not a performance acceptance claim or a completed ordinary-browser OAuth review. The separate laptop API and staging Neon remain the transport.

Demo still points to `9faec90cbfb7ca42a95cd8ca9264ee9a6f49deda`. No demo deployment, app requests, test login or SQL operation is performed. The second laptop receives code only after pulling the chosen released branch; its environment files/database connection remain independently configured. The temporary browser-fixture frontend on port 3105 is stopped; it is not a user-facing runtime.

The acceptance script refuses any target except `127.0.0.1:55432/kainara_report_feedback_acceptance`, requires a fresh user table and disabled providers, and restricts fetch to loopback. Apply existing migrations there, set test/clinical-clarification flags with membership disabled, then run `npx tsx scripts/report-feedback-local-acceptance.ts` from backend. Keep synthetic signing keys and both Prisma URLs scoped to that disposable database.
