# Native member application — October 23, 2026

## Decision and scope

The owner selected React Native + Expo, the established KAINARA visual identity
and a member-first application. Retain Next.js and staff portals; add `mobile/`
as an independent Expo workspace. No WebView conversion, new database or direct
database/provider access from the device. Source implementation follows the shared
checkout requirement. The native client is a development beta; full web parity,
device visual acceptance, integration and distribution are not complete.

## Interfaces

Add feature-gated `/api/auth/mobile/login`, `/register`, `/refresh` and `/logout`
under the existing auth router. The flag defaults off and is documented in the
backend environment template. Preserve existing browser-cookie handlers. Native
credentials use the existing auth service and shared attempt budgets; bodies are
strictly validated. Staff sign-ins are refused and the newly created session is
revoked. Token responses contain the auth service's public result, never password
hashes. Refuse browser Origin/Fetch-Metadata requests and return private/no-store.
This transport marker is not an authentication factor. No schema changes.

The device uses SecureStore, one token-pair write, shared refresh coordination,
explicit logout revocation and session-generation checks. A transient failure
does not erase credentials or automatically replay a mutation. Rotation still
has the existing uncertain-delivery limitation: if the server rotates but the
response is lost, a new sign-in may be necessary. No exactly-once client guarantee.

Native navigation checks the fetched profile, never JWT claims. The authoritative
server `reportAcknowledged` result wins over the latest report proposal. A bounded
legacy fallback requires acknowledged, non-stale, matching revision metadata.
Clinical holds, meal-specific reviews, approval reuse, grocery actionability,
feedback allowance and AI admission remain enforced by the unchanged services.

Onboarding reuses structured-safety submission for both recognized and custom
entries. Report reading uses saved profile/target/calculation data. Food preview
and save share a request key; edits invalidate the old preview. RND feedback is
offered only after saving and remains available in History. Nara canonicalizes
unconfirmed AI drafts, retains admitted identity for receipt recovery, discloses
submitted-message retention and never calls a provider in automated mobile tests.

## Verification evidence

- Backend full suite: **1,205 pass, zero failures, one existing TODO** (1,206
  registered), including six new native-controller/HTTP tests. The HTTP tests use
  loopback Express with mocked auth services, not PostgreSQL or hosted accounts.
- Final mobile checks: TypeScript and Expo lint pass; **15 pure client/policy/asset
  tests and nine native component tests** pass. These are synthetic/intercepted
  tests, not actual-device journeys. Saved food/history retain incomplete and
  provisional nutrition labels rather than presenting missing values as complete.
- Expo Doctor: **20/20 checks pass**. Android and iOS Metro/Hermes bundles export
  successfully; exports are not signed installable binaries.
- Backend source/test TypeScript, scoped changed-file ESLint and production build
  pass. No frontend runtime code was changed; its dependencies were not reinstalled
  solely to run this isolated client.
- Correct two setup defects before acceptance: install the matching React DOM peer
  required by Router, and explicitly install Expo Asset for font tooling. Decode
  the pre-existing sleeping SVG from UTF-16 before generating the native string.
  Native tests mock font loading because Jest has no real asset registry.
- The shared bounded-braces fork needs a direct local dev dependency, an override
  reference and `install-links=true`; a relative override alone produces an
  unresolved transitive dependency on this npm version. Consumer-resolution tests
  validate the installed result; preserve its upstream license and provenance.

## Remaining release gates

The initial source pass had no emulator. The Android follow-up below now provides
native sign-in appearance, text scaling and keyboard evidence. Authenticated member
journeys, Nara IME/held Backspace, screen-reader feedback, sharing and performance
still need device verification against a functioning isolated API. Physical-phone
and iOS checks remain open. A browser render is not substituted for native evidence.
Impeccable's full native visual finish verdict remains open; DESIGN.md is inherited
unchanged.

The initial source pass followed the owner's Docker/PostgreSQL cleanup, so SQL
integration was initially unavailable. The October 24 follow-up below restores
loopback rehearsal capability and activates the existing October 20 migration on
the separate staging project after successful backup/restore verification.
The mobile implementation itself adds no schema migration. Demo activation is
separate, and no demo functional test is permitted.

Registry audit after compatible updates and the existing parser mitigation reports
**28 findings: 4 high and 24 moderate**, propagated from `node-forge` and
`sprintf-js` in the Expo/Jest tooling dependency graph. The offered automatic fixes
downgrade Expo/Jest incompatibly and are not applied. This is not a zero-advisory or
production-ready security assessment. Reassess compatible upstream fixes before
distribution; do not bypass signature verification or replace crypto with a stub.

Native Google OAuth, push delivery, EAS signing/store credentials and the remaining
web-only workflows are listed in `mobile/README.md`. Source identifiers are
provisional until ownership/store configuration is confirmed. No APK/IPA, EAS
project, app-store publication, secret change or hosted deployment is created.

## Run and release

See `mobile/README.md`. Keep the public API URL explicit, targeting local/staging
for development; no demo fallback. Enable mobile auth only on the confirmed test
API candidate. Keep the owner's local → staging → authorized demo release order.
The website/API production remains separate from mobile distribution; a Git push
does not activate the flag, apply a migration or publish the app.

## Android emulator setup and native checks — October 23, 2026

Owner authorizes installation on the Windows PC. Install the official signed
Google Android Studio 2026.2.1.8 ZIP in the user profile, command tools 23.0,
Platform-Tools 37.0.1, stable Emulator 37.2.12 and Android 16 Google APIs x86_64
revision 7. Verify the command-tools archive against Google repository metadata
and Expo Go 58.0.5 against its official SHA-256 release digest. Windows Hypervisor
Platform 10.0.26300 reports installed and usable. No BIOS change, OS feature
activation or restart is required. Create `Kainara_Pixel_7`, two cores/2 GB RAM,
with snapshots disabled. Add Android Studio and the emulator to the Start menu.
User `ANDROID_HOME` points to `%LOCALAPPDATA%\Android\Sdk`.

Correct the new command tool's slash-separated SDK package syntax after the
compatibility wrapper splits the old semicolon identifier. Verify the actual
system image file rather than accepting the wrapper's zero exit code. The first
cold boot shows a System UI wait dialog, which clears; sustained performance is
not established. The first Expo load also exposes an IPv6-only localhost listener
that cannot receive the IPv4 ADB reverse connection. Add and actually run
`npm run android:local`, selecting IPv4 loopback and Expo's Android opener.

Capture actual emulator pixels, not a browser mockup:

- `verification/mobile-android-20261023/login-light.png`: native anonymous form.
- `login-dark-large.png`: dark appearance with Android font scale 1.3.
- `login-keyboard.png`: initial keyboard overlap reproduction, before the fix.
- `login-keyboard-scroll.png`: corrected form scrolling with the sign-in action
  above the keyboard. Set Android keyboard avoidance to `height`; preserve iOS
  padding. Hierarchy bounds confirm the scroll viewport contracts when IME opens.

These are Expo Go captures; its floating developer-tools button is not KAINARA
production UI. Synthetic `.invalid` text is never submitted. Restore font scale
1.0/light appearance afterward. Mobile TypeScript/lint, 15 pure tests and nine
native component tests and Android production bundle export pass after the fix.
Do not repeat unrelated backend tests
or claim these captures cover the authenticated member app.

The ignored public mobile environment targets `http://10.0.2.2:5000/api` and the
existing staging website handoff. No API listens on port 5000 during this check;
no sign-in, SQL, Gemini, demo functional request or deployment occurs. API/database
integration remains pending. Automatic approval rejects installer-leftover
cleanup, so compressed archives and the duplicate extraction remain in the local
setup folder. Automatic approval also rejects a combined direct Android launch
command; the documented Expo opener succeeds. Preserve both limitations.

## Native staging connection and actual member checks — October 24, 2026

Owner resumes the paused native work after seeing only login. Confirm the existing
staging project `dark-cake-36096216` / `kainara-staging-20261016`, its saved direct
endpoint and database `neondb`; reject the separate demo binding. Read-only ledger
inspection finds 113 applied migrations, no unresolved row, and the October 20
message-log migration pending. Provider metadata reports 145,974,314 transfer
bytes and 9,499 compute seconds for its October period; these are reported counters,
not proof of current allowance or immediate usage freshness.

Install the official EDB PostgreSQL 17.11-5 Windows ZIP without Docker, pgAdmin,
an OS service or a startup task. Verify SHA-256 against EDB's published checksum:
`80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`.
Initialize a password-protected cluster listening only on `127.0.0.1:55433`, with
64 MB shared buffers and a fresh `kainara_mobile_local` database. Do not replace
the deleted Docker volume or overwrite the normal backend environment.

Create a fresh separate-staging custom-format backup (15,527,516 bytes), SHA-256
`23c33274ef072447c459fa9b1ea9342a86005cb90f50e7c46dd3a1678b6b06f9`.
Restore it locally with one transaction and exit-on-error, then apply only the
pending `20261020010000_nara_submitted_message_records` migration. Verify 33 actual
loopback HTTP/SQL checks using the new `scripts/mobile-auth-local-acceptance.ts`:
registration, captured OTP verification, onboarding, deterministic report creation,
acknowledgment, member reads, water logging, profile-correction hold, refresh
rotation/replay rejection, logout revocation, browser-origin rejection and retained
browser HttpOnly-cookie behavior. Synthetic acceptance accounts are removed after
draining their admitted work. An invalidated report correctly stops in-flight
preparation with a 409 hold; it is not relaxed for the test. Correct the initial
test assumptions about report creation and the assistant status route before the
final passing run. Type-check the isolated acceptance configuration and lint it;
the backend production build also passes.

Apply that exact existing additive migration to the confirmed staging database
after the restore rehearsal. Verify all 114 applied migrations and its source
checksum; preserve accounts, catalogue and existing reviews. No new clinical
approval or catalogue rewrite is performed. Pin the unchanged compiled API source
from `cb253253` in a private runtime and enable native transport only there. Bind
its listener to loopback port 5102. Keep Gemini/email/push/payments off and do not
start automatic worker polling. Ordinary HTTP and on-demand preparation continue
through the existing services. The native public URL is `10.0.2.2:5102/api`.
This is a laptop test API using hosted staging SQL; no public tunnel or online-web
deployment is changed, and it is not a production runtime acceptance.

Create one retained `Android Test Member` through ordinary registration, privately
captured OTP, onboarding and report generation on staging. Enter only that
synthetic account in the emulator. Inspect real native pixels and UI hierarchy:

- Sign-in reaches Home with sleeping Nara and the unacknowledged-report hold.
- Read the actual saved report and acknowledge its exact version through the
  native confirmation; Home then reveals the member tabs.
- Meals renders the prepared catalogue plan; Groceries renders actual projected
  quantities, and Progress renders the dated water history.
- Nara answers “What is RND” through its free system guide and records the single
  submitted message. No paid/provider request is submitted.
- Reload the native app and verify secure-session refresh restores Home.

Actual screenshots are in `verification/mobile-staging-20261024/`. The native cold
boot again shows a temporary System UI wait dialog and an interrupted Expo runtime
reload; waiting/reloading recovers before the passing member journey. A first
Expo launch before Android finishes booting also fails; retry only after the boot
completion flag and installed-package check. Do not count failed attempts as
passing evidence. Physical-phone/iOS, full IME/assistive-technology, PDF/native
sharing, paid AI and comprehensive visual acceptance remain open.

Final bounded staging receipt: starter 3/3 meals active, upcoming weekly cycle
21/21 meals ready to shop; zero provider usage events and quota reservations since
the backup, one submitted guide message. These are synthetic-member checks, not
clinical validation or proof for all accounts. Demo receives no SQL, functional
request, migration, configuration change or deployment. Stop the idle loopback
PostgreSQL rehearsal afterward; keep the emulator, Metro and the staging-bound
test API available for the owner's manual testing. Private credentials, database
copies, OTPs and runtime configuration remain under the ignored mobile test folder.

## Restore the existing KAINARA design — October 24, 2026

The owner rejects the simplified native presentation. Preserve the existing web
design as the visual authority: `CockpitDashboard`, `DashboardMealCardSurface`,
`CardDecorationVariants`, `compact-meal-theme`, `globals.css` and bundled fonts.
Native does not require replacing that identity with generic cards or system type.

- Bundle the unchanged existing Outfit, DM Sans and JetBrains Mono assets with
  their SIL licenses. Apply them to shared copy, headings, buttons, fields and
  native navigation; keep system text scaling.
- Restore the pine intake panel, percentage ring, orange/peach corner ribbons,
  consumed/target values, colored macro bars, water logging and remaining budget.
  Targets come from saved cycle snapshots; unknown values say “Not recorded,”
  and partial/provisional intake remains labeled. Selected dates filter recorded
  DONE intake using Manila dates; no target is inferred from a meal candidate.
- Restore the round plate images and breakfast/lunch/dinner colored meal surfaces,
  white secondary actions, orange plan/history/library selection and date pills.
  Only actionable API meals navigate to the existing meal details; previews stay
  non-actionable. Report holds still avoid plan/intake/water requests.
- Add the existing default Nara atlas as a native clipped portrait and a Home
  shortcut to the existing chat screen. Retain native stack/Back/tab behavior.
  Header appearance toggle is session-local; system appearance is the default.

Checks: TypeScript, lint, 17 pure tests, 12 native component tests and Android/iOS
production bundle exports pass. Actual Android 16 Pixel 7 captures cover Home and
Meals in both themes and at 1.3 system font scale. Visual inspection catches and
fixes SVG gradient sizing and navigation-label clipping. Restore normal font scale
and leave the app available for owner inspection. Metro briefly observes a
partially written formatter file during development; the completed source passes
bundling and reloads successfully. This is not a release build/device crash.

Evidence: `verification/mobile-design-20261024/`. No new package, API/schema change,
clinical rule, approval, paid provider request or hosted deployment. Android/iOS
bundle success does not establish physical-device, iOS visual, tablet or landscape
acceptance. Other member screens inherit the shared brand components; complete
web/native feature or pixel parity is not claimed.
