# Shared workspace UI

Use these components before copying markup from another page. Role authorization, eligibility, claim state and mutation handling belong in the caller.

| Presentation | Component | Existing examples |
| --- | --- | --- |
| Default surface | `ui/Card` | Membership statistics/calendar, progress, settings |
| Curved stripes and logo | `ui/CardDecoration` or Card decoration props | Membership, dashboard, reports, grocery |
| Expandable staff audit | `shared/AuditHistoryList` | Admin and nutritionist Audit |
| Queue/history with detail pane | `shared/SplitWorkspace`, `WorkspaceListPane` | Nutritionist cases, nutrition guidance |
| Controlled dropdown | `ui/Select`, `ui/Dropdown` | Progress period, meal/report/review filters |
| Required or uncontrolled form select | `ui/NativeSelect` | Admin authoring and reference-data forms |
| Plan/library meal tile | `user/PlanMealCardSurface`, `user/MealMacros` | MealCard, PendingMealPreviewCard, RecipeLibraryCard |
| Compact meal presentation | `user/DashboardMealCardSurface`, `DashboardMealPlate`, `MealMacros` | Dashboard rows, food history, swap comparison |
| Meal library grid | `shared/MealLibraryLayout` | Member, nutritionist and admin libraries |
| Tabs or section links | `ui/WorkspaceTabs` | Meals, progress, reviews, settings, admin audit |
| Password field | `ui/PasswordInput` | Authentication and profile security |
| Boolean setting | `ui/Switch` | Meal reminders; controlled state, switch semantics and a 44px touch target |
| Meal times and device alerts | `features/meal-reminders/MealTimesFields`, `MealReminderSettingsPanel`, `DeviceNotificationsPanel` | Onboarding preferences, Food & planning and notification-bell settings |
| Food log and plan/grocery actions | `user/MemberMealActions` | Dashboard and Meals headers; callers retain report eligibility and logging handlers |
| Authentication split layout | `ui/sign-in` through `auth/AuthShell` | Login, registration, recovery, verification and invitation activation |
| Pagination | `ui/Pagination` | All three role libraries |
| Hover, focus or tap explanation | `ui/InfoHint` | Lifestyle and Health planning benefits |

## Cards

Card keeps both its existing header/footer props and compound CardHeader/CardContent/CardFooter API. It has the Plan Statistics surface shape, border and shadow. Keep a page's existing padding by passing its padding classes or `contentClassName`.

Decorations are optional: `none` (default), `stripes`, `logo`, `both`, or `varied`. Use `varied` with a stable `decorationSeed` such as a card or record ID. A seed picks one of the four variants, including no decoration. This varies cards without hydration differences or flickering on rerenders; don't call Math.random during render. Decorations are hidden from assistive technology and print, and cannot intercept clicks.

Fixed original accents use `decorationVariant` on Card or `variant` on CardDecoration: `intake`, `grocery`, `membership`, `statistics`, `schedule`, `report`, and `application`. These preserve each design’s original stripe placement, size, watermark and glow. Keep `default` for optional/varied decorations on ordinary cards. Existing surface gradient classes stay on their dedicated designs.

## Dropdowns and tabs

Select accepts `{value,label,disabled}` options and a string onChange. Dropdown adapts existing option children to the same menu. Menus use a portal so card overflow doesn't cut them off, reposition on scroll/resize, and support keyboard selection and Escape. Keep NativeSelect for a form that needs browser required validation, FormData, or defaultValue.

WorkspaceTabs accepts items with value, label, optional icon/count and optional href. Use href for navigation so browser links, new tabs and back navigation work. Use onChange for switching local panels. Its persistent highlight slides horizontally inside its own rail, without shared page-layout projection; scrolling, filtering and panel-height changes must not animate its vertical position or width. Reduced motion and animateIndicator=false switch it immediately. Continue hiding or unmounting inactive content in the caller.

PasswordInput uses Input's trailingControl slot; never position a visibility button against the label or full field group. Its 44 px button is centered on the actual input and remains keyboard accessible.

Authentication pages use SignInPage's Nara-left/form-right layout. AuthShell supplies KAINARA branding and navigation; AuthHeroPanel places Nara behind the window of the supplied bahay-kubo SVG and puts the desktop theme toggle inside a hanging bulb. Existing pages own validation, submission and role routing; pass their real forms as children. Styling is scoped in sign-in.module.css, with the application's existing fonts and theme tokens. Keep the form mounted and inert beneath the transition overlay while authentication resolves. The hero is hidden on small screens, where the form header remains visible, and tall forms scroll normally. Preserve Google's font preparation, English locale and supported responsive width. Keep its light/dark provider controls mounted across theme switches; hide the inactive layer from interaction and accessibility rather than restarting its iframe. Avoid form entry animations, fabricated testimonials and unsupported session options in this flow.

AuthHeroPanel owns the desktop bahay kubo scene, using the local 1024 × 765 SVG and coordinates relative to that artwork. The SVG background and window opening are transparent. Keep Nara clipped inside the opening, with the sill painted over her lower edge; the artwork must not intercept pointer events. The bulb reuses ThemeToggle with its bulb variant and a centered 44 px target, standard accessible label and keyboard behavior. Its glass glows in dark mode and turns off in light mode. The stage clips an enlarged house (up to 230% of panel width), centered on the window. Its crop extends 56 px into the desktop gap, or 128 px from 1280 px wide, without moving or scaling Nara further. A 4 px bamboo-brown border marks the top and sides, leaving the bottom open; its sides end at the visible house base (source y=699), rather than the full-height stage. The landscape edit of the owner-supplied capstone-team photo fills the clipped window with a straight rear view toward the PC from farther back, dimmed to 68% brightness and 90% saturation for interior lighting. Both women stand beside the seated teammate; all three face the monitor. The original photo and editing prompt are retained in `frontend/characters/capstone-team`. The group is framed toward the right edge to leave space for Nara. Nara uses a 90% window-width canvas in the lower-left foreground, anchored at the sill; keep her clear of the three heads. Next/Image serves the local photo with responsive optimization. Let the outer roof and walls crop; keep the opening and bulb control visible, including short desktops, without reaching the form. AuthShell keeps its compact 160 px mascot and ordinary header toggle on mobile. Nara uses local atlases and the pinned page-mascot component, reads no form values or authentication state, and renders a static portrait for reduced motion. Sources, prompts and generation QA remain in `frontend/characters/nara-tanod/README.md`.

## Meals and libraries

PlanMealCardSurface preserves the Meals tile design with its cropped circular image, colored banner and macro pills. DashboardMealCardSurface preserves the separate compact design with a full colored gradient and an overlapping circular plate. These dedicated meal components do not inherit the default Card surface or its decorations. MealCard, PendingMealPreviewCard and RecipeLibraryCard provide their specific status badges, body details and actions. History and swap rows reuse the compact design and DashboardMealPlate, with caller-specific sizes and actions. Shared presentation never implies that a library recipe is approved for a particular member.

MealCard and PendingMealPreviewCard share MealMotion: details open and close immediately below 768 px and when reduced motion is enabled. Keep expanding-card animations and background blur on desktop only.

MealLibraryLayout is only the grid. Member catalogue requests use useRecipeCatalog, scoped to owner, search, filters and page; staff use their existing role endpoints and account-scoped cache. Both use Pagination. Do not identify recipes by display name, or slice the first API page as if it contains the whole library. Cursor-based compatible pages advance only once the next batch arrives.

SplitWorkspace and WorkspaceListPane use the same `splitAt` breakpoint (`md` by default). Match ExpandableCasePanel's `backBreakpoint` to keep its back button available until both panes fit. Nutrition guidance uses ReportVersionPicker with the shared Select, a bounded internal scroll area, and full-screen reading in ExpandableCasePanel's expanded view. Its `contentKey` resets the internal scroll when the selected version changes.

## Announcement banners

Reuse `shared/AnnouncementBanner` for compact workspace notices and their link/button actions. `warning` (the default) uses brown for required action, including report acknowledgement, due check-ins and safety changes. `info` and `clinical` use teal for saved updates or waiting for review; `success` uses green for completed actions. Color supplements the title/message; preserve the caller's eligibility, persistence and dismissal rules. WeeklyProfileNotice uses this presentation and retains its existing check-in modal and status refresh.

## Landing links

SectionLink scrolls a same-page public section without writing a URL hash. Its real href remains available for modified clicks, copied links and cross-page navigation.

## Audit details

AuditHistoryList fetches one record on expansion through the caller’s role endpoint. Pass the authenticated ownerId for session-scoped reads. RecordedDetails shows only the server’s food/fact projection, with missing nutrition labeled Not recorded; it never fills older records using current meal values. Admins can open existing meal authoring; no audit action automatically publishes reusable food or ingredients.

## Illustrated states

StateNotice owns the shared sleeping Nara empty-state presentation. Health details reuses it only after a successful workspace response with no applicable detail forms, with no form instructions or action button. Keep both light/dark SVG layers mounted for a 250 ms opacity crossfade, expose only the active image to assistive technology, and switch immediately for reduced motion. The scoped illustration transition is the only exception to the global theme-switch transition suppression.

## Landing screen presenter

LandingHeroSection uses NaraPresenter in ContainerScroll's backdrop and foreground slots. Keep the complete torso and hair outside the transformed screen and hands inside it; all character layers are decorative and cannot intercept video controls. Do not fade or horizontally crop the back layer. The screen retains scroll-driven tilt, with reduced-motion support. Use a responsive 16:10 presentation and reserve space above it for Nara. Assets and generation prompts are in `frontend/characters/nara-presenter`; the landing hero no longer uses LandingWaveHero, while the other section waves remain unchanged.

## Landing meal gallery

LandingMealGallery pairs the hero heading with four tilted, alternating vertical photo columns, each with four distinct recipes from a 16-meal photo selection. No recipe appears in multiple columns; only the same column repeats its track for a seamless loop. Cards use full-bleed photos, softly rounded corners and Outfit titles over a dark bottom gradient. On desktop it bleeds to the right viewport edge and starts directly beneath the public header. Its left side continues behind the wider hero copy with a horizontal alpha fade and a soft gray-white backdrop in light mode; keep copy above the gallery so text and calls to action remain readable and clickable. On mobile it stacks inside the page width. It adapts Sean Hello / ReUI's [21st.dev 3D testimonials](https://21st.dev/@sean0205/components/3d-testimonials) using `ui/Marquee` and the existing Card, without new packages or replacing shared card/avatar components. It uses the public Panlasang Pinoy photo/source mappings already present in the library resolver, with source links below the gallery; it makes no nutrition or member-eligibility claim. Keep repeated visual tracks hidden from assistive technology and inert. The user can pause all columns, individual columns pause on hover/focus, and reduced motion disables the animation. Scoped CSS modules define the marquee keyframes for the current Tailwind 3 app.
