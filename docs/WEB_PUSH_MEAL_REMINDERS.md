# Device notifications and meal reminders

## Member setup

1. Save breakfast, lunch and dinner times in onboarding Preferences, or in **Profile → Food & planning → Meal times & reminders**. Times use the selected timezone. Suggested onboarding values are editable; existing completed members do not receive invented saved times or get sent back to onboarding.
2. Under Food & planning, choose **Send meal reminders** and the desired preparation/logging options, then save.
3. Choose **Enable on this device** and allow the browser permission. Device alerts can also be managed from **Notifications → Device alerts**, including for admin and nutritionist accounts.
4. Use **Send test notification** to check the device's notification panel. Permission is per browser/device. On iPhone/iPad, use the installed Home Screen web app (iOS/iPadOS 16.4+).

Preparation is **60 minutes before** the saved eating time. Logging is **60 minutes after**, for a cleared meal that has not been recorded as done or skipped. Saving times does not change clinical profile/report revisions, regenerate meals or spend a membership allowance. Existing plan calendar labels continue to use Manila business dates; only reminder wall times use the chosen timezone.

## Backend configuration

Apply `20261007100000_meal_reminders_web_push` before running this code. This is additive: three new tables, nullable notification fields and the MEAL_REMINDER enum value. Deploy the matching backend before enabling reminders against a shared database; an older Prisma client may not understand the new notification enum.

Generate a stable VAPID key pair once using `web-push` and securely configure the backend:

```env
WEB_PUSH_ENABLED=true
WEB_PUSH_PUBLIC_KEY=<public key>
WEB_PUSH_PRIVATE_KEY=<private key>
WEB_PUSH_SUBJECT=https://kainara.site
```

For example, `node -e "console.log(require('web-push').generateVAPIDKeys())"` prints a pair for the operator to store securely. Do not put the private key into frontend environment variables, source control, screenshots or logs. The authenticated configuration endpoint supplies only the public key. Keep the same pair across deployments; replacing it requires browsers to subscribe again. Missing/invalid configuration leaves device activation unavailable while meal-time editing and the existing inbox still work.

The API process runs a non-overlapping worker every **30 seconds** and waits for it on shutdown. The API must stay running for timely delivery. For an external scheduler, call `POST /api/cron/meal-reminders` every minute with `Authorization: Bearer <CRON_SECRET>`. Unique inbox keys and atomic per-device delivery claims make overlapping triggers safe. Hosting sleep/down time prevents timely checks; this is not an exact alarm service.

No external push provider account or native mobile application is required for standard Web Push. Backend HTTPS egress to the browser's push provider must work. The frontend must use HTTPS (localhost is permitted for development). Browser/OS permission, connectivity, Focus/Do Not Disturb and platform policy determine presentation and sound. Web Push does not play the site's custom MP3.

## Behavior and limits

- Inbox alerts created after a device subscribes can be sent to that device. Initial historical inbox contents are not replayed. Existing alert push banners use generic wording rather than private account/health details; reminders use only meal type and an action.
- Generation and delivery both recheck current account/report/consent, dated plan, clinical/recipe clearance and unlogged status. Pending, rejected, canceled, superseded and invalidated meals do not prompt preparation. Changing the schedule or disabling its reminder type also suppresses queued reminders before delivery.
- Reminders expire after ten minutes. Expired reminders leave the visible inbox and unread count. Their push TTL and service-worker checks prevent stale preparation prompts.
- Each notification/device is claimed once. Provider failures and interrupted SENDING attempts are not automatically replayed because delivery can be ambiguous. This favors avoiding duplicate prompts; occasional missed notifications remain possible. The SENT state means provider acceptance, not proof that a person saw the banner.
- Expired endpoints (404/410) are removed. Disabling a device removes its subscription and revokes it in the browser. Explicit logout also revokes the device subscription and closes its current notifications. Other subscribed devices remain active. Account deletion cascades schedules, subscriptions and receipts; exports omit push endpoints and encryption keys.
- The service worker handles push/click events only. It has no fetch handler, does not cache private pages/API responses, and only opens allowed paths on the same origin. Backend subscriptions are owner-scoped and restricted to supported public Google, Mozilla, Apple and Windows push-service hosts.

## Verification

`npm test` runs the backend policy/eligibility/delivery regressions and the frontend UI/device/worker tests. `frontend/e2e/meal-reminders.spec.ts` covers desktop/mobile onboarding and settings; browser push transport is synthetic. `npm run test:acceptance:meal-reminders` requires the explicitly guarded disposable PostgreSQL database on **127.0.0.1:55480/kainara_meal_reminders**, NODE_ENV=test, and blank real-provider credentials. It tests actual HTTP/auth/SQL, clearance and deduplication, with real VAPID encryption but a stubbed send transport. It cannot target the shared development database.

Physical-device delivery while the app is backgrounded/closed still needs the member's permission and the live **Send test notification** check. Hosted activation is separate from a development commit; configure the deployment's VAPID environment after promoting the code.

References: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [Apple/WebKit Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [web-push library](https://github.com/web-push-libs/web-push).
