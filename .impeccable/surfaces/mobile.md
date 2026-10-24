# Native member app

Mode: Operate. Platform: adaptive. Code-first app screens.

The owner approved retaining the existing visual identity and member-first
scope. This is a native adaptation of the existing member workflows, not a new
brand or alternative information architecture. Inherit DESIGN.md. Keep the
dashboard order: greeting, date selector, intake with water, and today's meals.
The actual mobile PWA is the composition reference: compact breadcrumb header,
inset floating five-item bar (Home, Meals, Groceries, Progress, Profile menu), and
floating Nara. Keep native routing and safe areas. Meal details and Nara use stack
navigation; focused edits use sheets.

Use semantic light/dark colors, native safe areas and scrolling. The owner rejects
the simplified native visual language on October 24: reproduce the incumbent
pine intake card, ring, macro colors, corner ribbons, round meal plates, colored
meal surfaces, orange selections and Nara. Preserve
meal previews as pending; only server-returned actionable meals offer logging.
Typography scales with the system. No added decorative motion in this first pass.

## Direction contract

THESIS: Adapt the existing member dashboard into a phone workflow that makes
today's food and the next required action easy to find.

OWN-WORLD: Preserve DESIGN.md's cream, pine and orange through semantic native
colors. Bundle the existing Outfit, DM Sans and JetBrains Mono fonts; use large
touch targets and the existing KAINARA/Nara assets.

STORY: A member signs in, resolves account/report prerequisites, checks today's
plan and records intake. Server review holds remain explicit.

FIRST VIEWPORT: Greeting and logging/weekly-plan actions precede the date selector
and branded intake card. A
report hold replaces this content with sleeping Nara and one report action.
The inset bottom bar owns the main destinations; Profile opens its account menu.

FORM: Native adaptation of the owner-approved existing member screen order;
composition selection is settled by the request, not a replacement-world seed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Verification status

Code-led source and component checks are recorded in docs/MOBILE_MEMBER_APP.md.
An Android 16 emulator is now installed. Actual native sign-in captures cover
light/dark appearance, 1.3 font scale, text entry and corrected keyboard scrolling;
see docs/verification/mobile-android-20261023 and the engineering evidence record.
The October 24 native staging journey now captures actual report-hold/report,
Home, Meals, Groceries, Progress and a free Nara response for one synthetic member;
secure-session reload is checked. Comprehensive Nara input behavior,
physical-phone/iOS checks and an independent visual verdict remain open. Bundling
and mocked component tests are not native visual evidence. The incumbent root
DESIGN.md remains unchanged. No full-app visual ship verdict is claimed.

October 24 design fidelity correction: Home and the meal-plan surface now use the
incumbent visual components translated into native views/SVG. Shared typography,
surfaces and buttons carry through the other screens. Actual Android light/dark
and 1.3 font-scale captures are in docs/verification/mobile-design-20261024.
Native tabs, stack navigation, safe areas and server-owned holds remain intact.
Physical phone, tablet, landscape and iOS visual acceptance remain unverified.

October 24 PWA composition correction: compare against actual local web screens
at 390 × 844 using only the synthetic staging member. Preserve the PWA page
headers, section order, meal tiles, grocery summary/filters, progress metric grid
and charts, white report paper, profile menu, and fixed Nara composer. Reuse the
existing Solar vectors with their MIT license. Evidence and limitations are in
docs/verification/mobile-pwa-fidelity-20261024 and docs/MOBILE_MEMBER_APP.md.
Full web/native feature or pixel parity is not claimed; membership/deep profile
editing still use the web handoff, and the native report is not the web canvas.
