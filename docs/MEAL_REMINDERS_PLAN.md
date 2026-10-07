# Meal times and device notifications

## Scope

- Collect editable breakfast, lunch and dinner times plus an IANA timezone in onboarding Preferences. Preserve completed accounts; they can save times under Food & planning.
- Store this schedule separately from clinical profile revisions. Reminders are opt-in; preparation is 60 minutes before, logging is 60 minutes after the saved time.
- Add authenticated Web Push subscriptions, a push-only service worker, account/device controls, and a test notification. No API or private-page caching.
- Reuse the inbox for reminders and existing alerts. A backend worker checks every 30 seconds while the API is running; an authenticated cron endpoint supports an external scheduler.
- Before creating and delivering a meal reminder, enforce current consent/report, account status, current recipe/clinical clearance, date and unlogged status. Pending, rejected, invalidated, canceled or already logged/skipped slots are excluded.
- Deduplicate reminder inbox records by account/day/type/kind, and deliveries by notification/device. Atomically claim each delivery once. Ambiguous provider failures or worker crashes are not automatically replayed; delivery remains best effort.
- Suppress stale reminders after 10 minutes. Permission, offline devices and OS settings can delay or prevent delivery. iPhone/iPad require a Home Screen installation.

## Verification and rollout

- Test time validation, timezone/DST/midnight scheduling, prerequisites, fresh clearance checks, deduplication, account ownership, endpoint restrictions, expiration and provider failures.
- Test onboarding persistence, saved schedule edits, permission denial, device enable/disable, logout and service-worker clicks using synthetic responses.
- Validate the additive Prisma migration in a disposable local PostgreSQL database before shared development migration. Preserve unrelated changes and provider credentials.
- Document stable VAPID key setup, feature enablement, scheduler behavior and physical-device checks. Push development only; hosted demo promotion is separate.
