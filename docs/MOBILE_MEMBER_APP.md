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

No Android SDK/emulator/connected device or Apple simulator is available on this
host. Native screenshots, layout/keyboard/IME/held Backspace checks, screen-reader
feedback, large text, appearance, native Back, sharing and performance remain
unverified. A browser render is not substituted for native evidence. Impeccable's
native visual finish verdict remains open; DESIGN.md is inherited unchanged.

The owner's disk cleanup removed local Docker/PostgreSQL. No replacement database
was created or Neon data queried. Actual HTTP/SQL account lifecycles must be tested
against a confirmed isolated target; hosted functional verification belongs on
staging only. The October 20 additive submitted-message migration also remains a
prerequisite wherever that earlier assistant implementation is activated. This
mobile update itself adds no migration.

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
