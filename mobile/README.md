# KAINARA native member app

React Native + Expo SDK 58, using the existing Express API. This is a **development
client**, not a published store app or a complete replacement for every web workflow.
Android is the first device-verification target; iOS bundles are also generated.

## Included

- Email/password sign-in and registration, OTP verification and reset-email request.
- Native onboarding: measurements, preferences, meal times, structured health/food
  restrictions, shopping day and versioned consent. Custom restrictions use the same
  structured-safety API as the website, not an invented classification.
- Home with current-report hold, sleeping Nara, cleared meals, intake and water.
- Meal plan and pending previews, compatible recipe library with cursor paging,
  history, details, eaten/skipped actions and YouTube cooking search.
- Outside-food reference lookup, entered-label values or explicit AI estimate;
  server preview/confirmation precedes saving. Optional RND feedback follows the
  saved log and remains accessible from History.
- Current/upcoming grocery projections and server-authorized check actions.
- Weight history, weekly water history and weight changes returning Home.
- Native report reading, saved calculation evidence, exact-version acknowledgment
  and authenticated PDF sharing. Pending/latest proposals do not override the
  server-selected planning report.
- Nara command selection, AI-credit confirmation, editable drafts, duplicate-bubble
  prevention and receipt recovery. Context stays in memory; a pending paid request
  key is stored separately in encrypted storage to recover after an app restart.
- Profile/password maintenance, in-app notifications and password-confirmed account
  deletion. Account privacy/deletion is also reachable before onboarding completes.
- Automatic light/dark colors, native stacks/tabs, safe areas and scalable text.

## Run on your Android phone

From `C:\Users\chima\Desktop\Nutrimind`:

```powershell
cd mobile
npm ci
Copy-Item .env.example .env.local
# Edit .env.local before starting.
npm start
```

Install the matching **Expo Go** on your phone and scan the terminal QR code. The
phone and laptop need to be able to reach each other. The server must already be
running, on the matching candidate, with `MOBILE_AUTH_ENABLED=true`. This change
does **not** enable or deploy that flag anywhere automatically.

Public mobile configuration:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_LAPTOP_LAN_IP:5000/api
EXPO_PUBLIC_WEB_URL=https://YOUR_STAGING_WEBSITE
```

Android emulator: use `http://10.0.2.2:5000/api`. A phone's `localhost` refers to
the phone, not this laptop. Remote API URLs must use HTTPS. Local HTTP is restricted
to development mode and LAN/loopback/emulator hosts; use HTTPS for internal release
builds. Do not disable TLS verification. Never put Neon, Gemini, SMTP or JWT secrets
in `EXPO_PUBLIC_*`. Expo exports those values into the client bundle.

No API URL is selected by default. The app shows configuration guidance without
contacting demo when it is missing. Restart Metro after editing public variables.

**Current host setup:** Docker remains removed. Portable PostgreSQL 17 now provides
a loopback-only rehearsal database on port 55433; its staging-backup restore and
33 actual HTTP/SQL checks passed. That rehearsal database is stopped when idle.
The Android app uses the separate Neon staging project through a local test API
on port 5102. Demo is not a development target. See the dated verification record
in `docs/MOBILE_MEMBER_APP.md`.

On this configured PC, keep these two terminals running:

```powershell
# Terminal 1: bounded test API, separate staging database.
cd C:\Users\chima\Desktop\Nutrimind\backend
node .local/mobile-native-20261024/start-mobile-staging.cjs

# Terminal 2: emulator and native app.
cd C:\Users\chima\Desktop\Nutrimind\mobile
npm run android:local
```

The first command uses an ignored, host-specific environment and pinned compiled
API. It is not included in a fresh clone. Keep the private configuration/backups
out of Git; another computer needs its own confirmed test setup. This runtime
disables external AI, email, push and payments, and does not start automatic
worker polling. It retains the normal HTTP handlers and on-demand planning rules.
Free Nara answers and catalogue-backed plans work; a Gemini reply is not verified.
Email codes for test accounts are captured privately instead of delivered.

## Run on a Windows Android emulator

Install Android Studio, Android SDK Platform-Tools, Android Emulator and one
x86_64 Android system image. Create a phone in Device Manager. The current host
uses the `Kainara_Pixel_7` Android 16 device with 2 GB RAM and two virtual cores.
Windows Hypervisor Platform acceleration is available; no additional driver is
needed on this host.

Open a fresh terminal so the user-level `ANDROID_HOME` setting is loaded:

```powershell
cd C:\Users\chima\Desktop\Nutrimind\mobile
npm run android:local
```

`android:local` binds Metro to IPv4 loopback and uses Expo's Android opener. This
avoids a verified Windows mismatch where `localhost` selected IPv6 but the ADB
reverse connection used IPv4. The regular `android` script remains available for
LAN development.

The emulator can reach a running laptop API at `http://10.0.2.2:5000/api`.
This PC's ignored `.env.local` selects `http://10.0.2.2:5102/api` for staging.
The emulator does not provide an API or database. Without mobile configuration,
the native sign-in screen shows a setup notice and cannot submit credentials.
Keep Metro running while using the development app; Expo Go is its test host,
not a signed KAINARA APK.

## Checks and bundles

```powershell
npm run check
npm run doctor
npm run export:android
npm run export:ios
```

`check` runs TypeScript, lint, pure client/policy tests and React Native component
tests. Component tests use synthetic local fixtures and mocked API/native storage;
they are not device tests. Bundle export produces JavaScript/assets, **not an APK
or IPA**. Build/signing configuration is in `eas.json`; creating an EAS project,
developer accounts, production identifiers, signing and store submission are
separate steps. Do not run a paid/cloud build or publish without that setup.

## API compatibility and session security

The new `/api/auth/mobile/{login,register,refresh,logout}` transport is disabled
unless `MOBILE_AUTH_ENABLED=true`. It uses existing credential checks, hashed
refresh-session records, rotation, revocation and shared attempt budgets. It does
not change the browser HttpOnly-cookie endpoints or require a schema migration.
Origin/Fetch-Metadata rejection prevents accidental use from the website; it is
not device authentication and does not replace credential/session checks.

The mobile client writes a token pair as one SecureStore item. Protected API calls
still use Bearer access tokens. Parallel 401s share a refresh; uncertain writes
are not automatically retried. Logout revokes the refresh session before clearing
it locally; outages show an error and allow a deliberate retry. Persisted tokens
are scoped to this installation and must not be included in device backups.

Do not issue `npm audit fix --force`: it proposes incompatible Expo/Jest downgrades.
The existing repository-maintained bounded braces fork is copied into this workspace
with its license, installed as a local package, and tested through an actual glob
consumer. Registry scanning does not audit this local fork. Remaining toolchain
advisories and the device-verification checklist are in
[`../docs/MOBILE_MEMBER_APP.md`](../docs/MOBILE_MEMBER_APP.md).

## Remaining web / release work

- Staff portals, detailed clinical clarification/corrections, membership checkout,
  plan repair controls, swaps and broader planning-settings editing remain on web.
  Browser handoffs require their own web sign-in and do not pass tokens in URLs.
- Google-only native sign-in/linking needs native OAuth clients and platform
  configuration. Password-only deletion is implemented here; Google-only deletion
  remains on the website's existing reauthentication flow.
- Native push token registration/delivery is not the website's Web Push system.
  In-app notifications work through the existing endpoint; no native push claim.
- Offline mutation queues are not implemented. Do not imply that logging or an
  approval works offline. Server failures must not display cached health state as
  fresh or silently replay writes.
- Actual devices must verify keyboards/IME, command Enter/Tab/Escape support,
  two-Backspace/held-key behavior, accessibility announcements, font scaling,
  native Back, both themes, image rendering, sharing and network-loss recovery.
- No staging/demo promotion or app-store release has been performed.
