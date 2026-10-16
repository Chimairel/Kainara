# Water history

Implemented October 16, 2026 for the candidate/staging release.

## Member experience

- Progress → Overview includes Water history below the weight history. Dashboard's Water label links directly to it.
- Seven daily bars cover today and the preceding six days in `Asia/Manila`. Select a day using the pointer or keyboard to inspect saved times and amounts.
- A day without entries is labeled **No log**. This describes recording, not actual consumption. There is no inferred intake, invented historical measurement or prescribed water target in this graph.
- Totals include all currently saved entries for that day. Detail shows the newest 50 entries per day, explicitly stating when the list is partial. Entries appear newest first, with stable ID ordering for equal times.
- Removals and resets affect the current saved projection. They are not an immutable event history, and removed entries cannot be recovered from this view. Existing water write behavior is unchanged.

## Data and boundaries

The existing authenticated `GET /api/user/progress/history` response gains an additive optional `waterHistory` object:

```text
timeZone: Asia/Manila
startDate/endDate: YYYY-MM-DD
days: [{date, totalMl, entryCount, entries: [{id, amountMl, loggedAt}]}]
```

WaterService performs one parameter-bound SQL read of the owner's existing indexed WaterLog records over a fixed seven-day interval. Daily totals/counts include all rows in the interval; a window rank bounds returned entry details to 50 per day, at most 350 total. Prisma stores UTC timestamps without a timezone; SQL explicitly applies Manila's +08 offset for daily grouping and serializes entry times with UTC `Z`. Empty dates are filled with zero recorded volume and an empty entry list.

Reuse the existing progress request, account-scoped cache, polling and cancellation boundaries. There is no new browser endpoint request, provider call, dependency, schema migration or write command. Previously cached responses without this additive field show history as unavailable until refreshed rather than fabricating an empty history. Existing route authentication, USER role and setup/consent prerequisites remain.

## Verification

Two backend unit tests cover owner/date binding, seven-day filling and the midnight boundary. Two rendered frontend tests cover exact residual volume, Manila times, day selection, unavailable/empty differences and partial detail disclosure. The guarded `backend/scripts/water-history-local-acceptance.ts` runs only against the disposable loopback assistant database. Real SQL verifies both interval edges, neighboring Manila dates, different-member exclusion, a 25 mL residual, totals over 52 entries with only 50 details, newest ordering and reset projection. All synthetic records roll back; no hosted member record is changed by that test.

Combined verification for the profile-dialog, guide and water candidate: full backend 1,152 pass / zero fail / one existing TODO; 297 affected frontend tests in 56 files pass; both builds, scoped lint, guide parity and UI detector pass. Provider tests use mocks. Fresh browser/mobile visual inspection and a real-device keyboard check remain unverified under the prior browser access-policy limitation.
