# Retained meal cards and preparation release — October 13, 2026

## Published version

The owner authorized publication after the live screenshot exposed the older separate recorded-meals panel. Release `95693ec97ed4e902c0b6fbe9b42db9b0c7fbc323` integrates the verified development tree with the preceding live SEO commit `253f2138`. Both development and demo received this release without force or switching the shared checkout.

| Component | Deployment | Verified status |
|---|---|---|
| Railway API, initial deployment | `88a097cf-8b35-4f8e-b7b7-d15cf116e0b8` | SUCCESS; `/ready` returned 200 before frontend publication |
| Railway API, automatic demo rebuild | `73f7847c-41bd-43e4-9eea-f6687abd78db` | SUCCESS at the same release commit |
| Vercel frontend | `dpl_EcNfgoDFqThVEHBjfeJUBm5VCWTc` | READY at the same release commit; www and apex aliases assigned |

The Git-triggered production frontend build became visible after a manual request was queued. The redundant manual deployment `dpl_9N8dfdxvibVEVgob2XfbXmsGQgSt` was cancelled; the verified Git-triggered build is the published release.

## Included behavior

- Retained eaten/skipped meals use the shared menu cards, in meal order, with `Eaten · previous plan` or `Skipped · previous plan`. The separate recorded-meals panel is removed. Retained intake stays read-only and cannot authorize a meal for the updated profile.
- History and retained meals use the shared recipe-photo resolver. A replaced plan row cannot supply a photograph for a different recorded meal. Recorded nutrients, names and review history remain unchanged.
- Active preparation shows Nara cooking for at least five seconds and until the current day has no generation gaps, counting retained intake as occupied. Later unfinished dates use shared meal skeletons. Failure and eligibility states retain priority.
- Shared secondary buttons use the previously approved white meal-action styling.

This publishes the already verified changes from engineering entries 370–372 and the related shared-button update. Implementation remains in `C:\Users\chima\Desktop\Nutrimind`; normal local frontend/backend remain 3000/5000. Uncommitted Antigravity/other-tool files were excluded.

## Verification

- 44 focused frontend tests and 18 backend tests passed, including retained-card ordering/deduplication, preparation timing, history photos, owner-scoped reads and existing reviewer rules.
- Both packages built from a Git archive of committed source inside the shared checkout. Its tree exactly matches the release. The local Windows frontend build reported a dependency-junction standalone-copy warning; local output was not uploaded. Vercel built Git source successfully in its production environment.
- Four actual Chromium localhost journeys passed at 390/1440 pixels in light/dark themes, using intercepted synthetic API responses. They cover extended cooking, automatic polling, retained badges and future-slot skeletons without hosted mutations. This does not measure live provider generation time.
- The owner's existing signed-in Chrome session loaded the published dashboard. Selecting October 12 showed three menu cards, the retained lunch badge, a successfully loaded source photo and no separate recorded-meals panel. Recorded intake remained 912 kcal. This was an actual account/page read, not an intercepted fixture or impersonated session. The screenshot is retained privately at `backend/.local/dashboard-release-20261013/live-bam-i.png`.
- Public homepage and sitemap returned 200; the homepage canonical remained `https://www.kainara.site` and the sitemap retained its four public URLs. SEO implementation files are identical to the preceding live release.

No migration, database repair, profile edit, meal logging action, clinical decision, secret/environment update or DNS change was issued. Schema and dependency files are unchanged. Browser inspection can generate normal session/access activity; it is not a database-mutation rehearsal or a full actor/clinical validation.

## Rollback

The preceding compatible API is Railway `ec46585b-98a2-4240-9b00-4633c7e1329c`; the preceding frontend is Vercel `dpl_EoHVaNqVvLrVvPRSUbJV1q2dMCWP`. Both used `253f2138`. Roll back only for a reproduced release defect. No schema rollback or saved-record restoration is needed; the earlier interface would again show its separate retained-meals panel.
