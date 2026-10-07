# Reminder controls and delivery diagnosis

- Replace the three reminder checkboxes with accessible switches and explicit preparation/logging labels.
- Save an account-wide preparation lead time of 0–180 minutes; retain 60 as the existing default. Zero means the eating time. Logging remains 60 minutes after an unlogged meal.
- Preserve old clients that omit the new field, existing saved times, clinical clearance, report/consent checks, expiry and delivery deduplication.
- Show whether the current browser is actually subscribed. Expose owner-scoped last provider delivery state and a refresh action without subscription keys or endpoints.
- Report browser push receipt/display-request results to open application windows for diagnosis. Do not cache private data or store authentication credentials in the worker.
- Retry one transient profile-read failure with a bounded budget, verifying the same account before retrying. Authorization and readiness remain unresolved until a fresh response succeeds.
- Verify schema in task-owned PostgreSQL and back up the shared database before its additive migration. Test custom lead times, legacy payloads, switches, device status, worker display failures and profile retry/logout boundaries.
- Development integration first; hosted display/sound remains under browser and OS control. Provider acceptance is not proof of phone presentation.
