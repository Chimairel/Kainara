# Device notifications and meal reminders

## Member setup

1. Save breakfast, lunch and dinner times in onboarding Preferences, or in **Profile → Food & planning → Meal times & reminders**. Times use the selected timezone. Suggested onboarding values are editable; existing completed members do not receive invented saved times or get sent back to onboarding.
2. Under Food & planning, turn on **Send meal reminders**, choose the preparation/logging toggles and preparation lead time, then save. Times and reminder preferences are account-wide; device permission is separate.
3. Choose **Enable on this device** and allow the browser permission. Device alerts can also be managed from **Notifications → Device alerts**, including for admin and nutritionist accounts.
4. Use **Send test notification** to check the device's notification panel. Permission is per browser/device. On iPhone/iPad, use the installed Home Screen web app (iOS/iPadOS 16.4+).

Preparation uses the chosen lead time, **0–180 minutes before** the saved eating time, with **60 minutes** retained as the default. Zero means a preparation prompt at the eating time. Logging is **60 minutes after**, for a cleared meal that has not been recorded as done or skipped. Saving times does not change clinical profile/report revisions, regenerate meals or spend a membership allowance. Existing plan calendar labels continue to use Manila business dates; only reminder wall times use the chosen timezone.

## Backend configuration

Apply `20261007100000_meal_reminders_web_push` before running this code. This is additive: three new tables, nullable notification fields and the MEAL_REMINDER enum value. Deploy the matching backend before enabling reminders against a shared database; an older Prisma client may not understand the new notification enum.

Configurable preparation also requires `20261007120000_configurable_meal_preparation`. It adds an integer column with a default of 60 and a database constraint of 0–180. Old clients that omit the field preserve the saved value on updates.

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
- Meal reminders and manually requested tests use high Web Push urgency; other inbox alerts retain normal urgency. This asks the provider for prompt delivery but cannot override connectivity, browser/OS restrictions or guarantee exact arrival. Tests send immediately from the request and expire after five minutes; they do not wait for the 30-second schedule check. Railway logs record provider acceptance duration and notification age without endpoints, keys, user identifiers or message contents. Acceptance is not proof of phone presentation.
- Each notification/device is claimed once. Provider failures and interrupted SENDING attempts are not automatically replayed because delivery can be ambiguous. This favors avoiding duplicate prompts; occasional missed notifications remain possible. The SENT state means provider acceptance, not proof that a person saw the banner.
- Expired endpoints (404/410) are removed. Disabling a device removes its subscription and revokes it in the browser. Explicit logout also revokes the device subscription and closes its current notifications. Other subscribed devices remain active. Account deletion cascades schedules, subscriptions and receipts; exports omit push endpoints and encryption keys.
- The service worker handles push/click events only. It has no fetch handler, does not cache private pages/API responses, and only opens allowed paths on the same origin. Backend subscriptions are owner-scoped and restricted to supported public Google, Mozilla, Apple and Windows push-service hosts.

## Verification

`npm test` runs the backend policy/eligibility/delivery regressions and the frontend UI/device/worker tests. `frontend/e2e/meal-reminders.spec.ts` covers desktop/mobile onboarding and settings; browser push transport is synthetic. `npm run test:acceptance:meal-reminders` requires the explicitly guarded disposable PostgreSQL database on **127.0.0.1:55480/kainara_meal_reminders**, NODE_ENV=test, and blank real-provider credentials. It tests actual HTTP/auth/SQL, clearance and deduplication, with real VAPID encryption but a stubbed send transport. It cannot target the shared development database.

Physical-device delivery while the app is backgrounded/closed still needs the member's permission and the live **Send test notification** check. Hosted activation is separate from a development commit; configure the deployment's VAPID environment after promoting the code.

## Browser registration troubleshooting

If enabling a device reports that the browser cannot connect to its push service, registration failed inside PushManager.subscribe before the application's subscription-save request. In Brave, open `brave://settings/privacy`, enable **Use Google services for push messaging**, and restart the browser before trying again. This browser-level setting is separate from the site's notification permission and cannot be enabled by KAINARA. If it is already enabled, check VPN/network restrictions or compare with another supported browser. Do not change VAPID keys or delete saved meal times to troubleshoot this message. The application now gives these instructions and leaves activation available for a retry; this does not establish that the local browser setting was the cause on a particular device.

The **Send meal reminders** preference must also be enabled and saved for scheduled meal prompts. Device activation alone still allows existing inbox alerts and the test notification.

On Android, Chrome may also display a silent **Tap to copy the URL for this app** notice while an installed web app is open. That is Chrome's web-app control, not a replacement push payload from KAINARA. The KAINARA test says **This is a test notification from KAINARA**. Browser/OS notification settings control Chrome's own notice independently.

For example, dinner at 18:30 with the default 60-minute lead means preparation at 17:30 and logging at 19:30. A 15-minute lead means preparation at 18:15; zero means 18:30. For a near-term preparation check, choose a lead time and save dinner that many minutes plus five minutes from now, provided that day's dinner is cleared and unlogged. A reminder already created for the same meal/day/type is not sent again after changing the schedule. For sound, manage the actual KAINARA/site notification category in Android and choose alerting rather than silent; server urgency cannot force a muted category to play sound. See [Android notification controls](https://support.google.com/android/answer/9079661?hl=en) and [Chrome's URL-copy notification string](https://chromium.googlesource.com/chromium/src/+/d6514607ce6194e4065b923c288e33a02008e1c8/chrome/android/java/strings/android_chrome_strings.grd).

### Locate a missing device banner

- Check **Notifications on this device** on each browser/device. Signing into the same Google account does not subscribe another browser; **Enable on this device** must be completed there.
- **Refresh delivery status** reads only the authenticated owner's current subscription. **Accepted by the push provider** means the server handed the push to the provider, not that the phone displayed it. FAILED, CANCELLED or SENDING identifies a different server stage.
- When this settings panel is open, the service worker reports a timestamp for receipt and whether `showNotification` resolved, rejected, or the payload expired. It does not expose notification contents, identifiers or keys. This status is transient and does not recover historical events from when the panel was closed. Even a resolved display request cannot confirm a visible banner or sound.
- For a delayed test, compare the provider acceptance log's notification age and call duration with the browser receipt time. Connectivity, browser background behavior and OS notification settings remain possible causes after provider acceptance; do not infer a Vercel cron failure from a missing banner. The existing schedule worker runs in the Express API.
- A transient profile network/timeout/502/503/504 failure receives one fresh retry if the signed-in account is unchanged (45-second first request and 15-second retry timeouts). Authorization failures are not retried here; route admission still requires a fresh successful profile. This improves recovery without establishing the cause of a particular phone error.

Brave references: [push messaging setting](https://github.com/brave/brave-core/blob/master/app/brave_settings_strings.grdp), [browser push channel](https://github.com/brave/brave-core/blob/master/browser/gcm_driver/brave_gcm_channel_status.cc).

References: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [Apple/WebKit Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [web-push library](https://github.com/web-push-libs/web-push).
