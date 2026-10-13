# Docs, Contact Support and source-return behavior — October 13, 2026

## Local delivery

Implemented in `C:/Users/chima/Desktop/Nutrimind`, branch `codex/solar-icons`, using the shared frontend at `http://localhost:3000`. Publication is separate.

The final design follows the owner's refinements:

- Search sits directly below the Docs introduction, has a soft shadow in both themes, and searches chapter titles, authored answers and FAQs. Results link to their existing section anchors. The custom clear control replaces the browser's duplicate search clear icon.
- Separate chapters, grouped navigation, mobile chapter selector and the desktop **On this page** outline are retained. Only FAQs use accordions. Search results and direct FAQ links open the matching answer. Existing legal, evidence, aliases and browser history remain usable.
- Current planning, restriction filtering, grocery holds, previous-plan records, review canvas/audit behavior and notification limits are described. FAQs expand from four to sixteen. Privacy includes the actual support-email data flow.
- Every chapter ends with the existing card, now **Looking for something specific?**, with an orange **Contact Support** link to `/help`. The Help chapter contains guidance and that card; the full contact form is on the dedicated page.
- The referenced contact composition uses existing Kainara primitives, theme colors and local Nara assets instead of a globe. The full form is visible to visitors; sign-in/email verification is requested on submission when needed. Verified signed-in users can send directly, including before onboarding or clinical review completes.
- Pointer-opened citations resume from the current position after returning, including when the browser re-enters hover without moving the pointer. A deliberate pointer move restores hover behavior. Keyboard focus and reduced motion keep their static list.

## Email and account boundaries

`POST /api/support/requests` authenticates and requires email verification. Category and message are bounded/validated, and client-supplied destination or identity fields are rejected. The operator destination is fixed to `chimairelp@gmail.com`; reply-to is the authenticated account email. A small account-only database projection supplies name, email, role and identifier. No health profile, clinical document or meal history is attached. Authenticated suspension/account checks remain in the normal middleware.

The existing SMTP or Brevo provider sends escaped branded HTML. Each account is limited to five submissions per hour per API process; this is not a distributed cross-instance limit. Failures do not trigger automatic mail retries. A successful response means provider acceptance, not a confirmed inbox delivery or persistent ticket. A random reference is included in the mail and response; no support-ticket table/schema was introduced. The form retains text after an error, prevents concurrent sends and discards stale account responses/drafts on account changes.

## Verification

- **11 frontend tests:** authored-text search, all-word matching, anonymous/unverified form visibility without sending, success/failure handling, duplicate suppression, account-change aborts, citation pointer/keyboard/static behavior.
- **10 backend tests:** support payload bounds, immutable destination/identity, escaped HTML, account reply-to, no health projection, missing/unverified account rejection, provider failure/no retry, and real loopback Express requests with mocked persistence/provider for auth, unfinished onboarding and account rate limits. Existing operational-email regression tests include SMTP reply-to and Brevo behavior.
- **13 Chromium journeys:** six Docs/support journeys at actual 3000, covering 390/1440 px in both themes, search-to-FAQ navigation, keyboard expansion, outline/deep links, Sources redirect, support-card navigation, full visitor form, reduced motion and mocked support failure/success; six original source/footer journeys plus the added return-without-second-click regression. The final Docs six and source-resume regression were rerun after their respective edits and passed.
- Changed-file frontend/backend lint, backend production build, frontend production build, and focused backend support/email TypeScript compilation passed.
- The broad backend `tests/tsconfig.json` check still reports unrelated existing fixture errors in `source-recipe-cloudinary.test.ts:143` and `structured-restriction-adapter.test.ts:60,67,77`. The focused support/email type check passes. No claim is made that the entire backend test suite passes.

Browser APIs were intercepted with synthetic fixtures. The backend tests used a disabled loopback database URL, mocked persistence and mocked email acceptance; no real support email, shared Neon write, release, secret change or live deployment occurred. Both themes/mobile and desktop were inspected in bounded screenshot passes. Email receipt in the real operator inbox remains unverified.

Local screenshots are under `backend/.local/docs-support/`: `search-{390,1440}-{light,dark}.png`, `docs-{390,1440}-{light,dark}.png`, `help-{390,1440}-{light,dark}.png`, and `support-{390,1440}-{light,dark}.png`. They are synthetic local previews, not live evidence.


## Contact Support composition refinement

The owner's subsequent reference combines the Docs wave hero with the authentication scene/form composition. `/help` now has **Contact Support** and a short support subtitle in the wave hero, followed by the shared auth layout: the existing bahay kubo/team/Nara scene on the left and the support request form on the right. There is no Docs search, login form, Google sign-in or second public header on this page. Mobile uses the existing small Nara portrait above the form instead of squeezing the house beside it.

`SignInPage` and `AuthHeroPanel` accept an embedded variant that uses an ordinary section and an h2 beneath the public-page h1. The scene follows the form's height rather than pinning itself to the viewport. The default auth variant retains its existing layout. Support controls share the auth form styling and a full-width submit button. Account gating, request payloads and email delivery behavior are unchanged.

Verification of the refinement: 4 focused frontend tests, 5 intercepted Docs/support Chromium journeys at actual localhost:3000 (both themes at 390/1440 px, plus mobile reduced motion and anonymous submission), 1 short-desktop login regression, changed-file lint and frontend production build pass. Desktop checks assert a loaded scene, positive scene height, separation from the form, one main landmark, and usable support submission/failure recovery. All four support layout screenshots in the directory above were refreshed and inspected. No real email or hosted-data mutation was performed.
