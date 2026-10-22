# Native member app

Mode: Operate. Platform: adaptive. Code-first app screens.

The owner approved retaining the existing visual identity and member-first
scope. This is a native adaptation of the existing member workflows, not a new
brand or alternative information architecture. Inherit DESIGN.md. Keep the
dashboard order: greeting, intake, water and today's meals; use native tabs for
Home, Meals, Groceries and Progress, with Profile in the header and Nara as a
stack destination. Meal details use stack navigation; focused edits use sheets.

Use semantic light/dark colors, native safe areas and scrolling. Prefer clear
lists and meaningful empty/error states over decorative dashboard cards. Preserve
meal previews as pending; only server-returned actionable meals offer logging.
Typography scales with the system. No added decorative motion in this first pass.

## Direction contract

THESIS: Adapt the existing member dashboard into a phone workflow that makes
today's food and the next required action easy to find.

OWN-WORLD: Preserve DESIGN.md's cream, pine and orange through semantic native
colors. Use system type, large touch targets and the existing KAINARA/Nara assets.

STORY: A member signs in, resolves account/report prerequisites, checks today's
plan and records intake. Server review holds remain explicit.

FIRST VIEWPORT: Greeting and date precede intake and its logging action. A
report hold replaces this content with sleeping Nara and one report action.
Native tabs own the main destinations; Profile is in the top bar.

FORM: Native adaptation of the owner-approved existing member screen order;
composition selection is settled by the request, not a replacement-world seed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Verification status

Code-led source and component checks are recorded in docs/MOBILE_MEMBER_APP.md.
Native screenshots, keyboard/Back/large-text/theme testing and an independent
visual verdict remain open: no Android SDK/device or Apple simulator is available
on this host. Bundling and mocked component tests are not native visual evidence.
The incumbent root DESIGN.md remains unchanged. No visual ship verdict is claimed.
