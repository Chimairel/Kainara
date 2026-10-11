# Member health forms inbox — live release

Published October 11, 2026. Change ID: CHG-20261011-22.

## Scope and target

The previous screenshot showed the old live frontend: the redesign had been pushed to development only. This release applies the nine tested inbox frontend files to the existing live baseline `5a9c025f`, without deploying unrelated development features. Inbox code is commit `0dbb0a9c97184408a12e039a8de7aa8834280d01`; upload exclusions are commit `5a2f830703cd63b0f44c79bf23d83e0f3d9244c0`, now on `origin/demo`.

The official authenticated Vercel CLI verified project `nutrimindv1` (`prj_DxetpuW3fd5zY2ezP4wpdOtQrk8K`) under team `team_Lozv3UR8PDbAp1KaR60QwRHp`. A production build was staged without switching the custom domains, checked READY and HTTP 200, then promoted as `dpl_G1AWza6Av25Wskz3vKJL5e5RM3xs`. Pushing the same committed source to `demo` also triggered the configured Git deployment. The final public deployment is `dpl_DCNabzchQkUHPsMkFdV7SdRRZfXR`, READY, with both `kainara.site` and `www.kainara.site` aliases. Provider metadata confirms Git source `demo` and the exact commit `5a2f830703cd63b0f44c79bf23d83e0f3d9244c0`. Both builds contain the same committed application source.

No backend code, database schema, member form data or deployed environment variables were changed. The compatible API release remains `5a9c025f`, previously verified at Railway deployment `24a6ce5f-4554-4b3c-a9aa-d20aebd9d880`. The separate license-update feature is not included.

## Verification

- The isolated release copy passed 38 targeted tests in six files, TypeScript and source architecture checks. Vercel's production build passed compilation, lint/type validation and all 62 page generations.
- An ordinary live browser login using the existing synthetic member opened the actual public health-details page. The new inbox showed its health-detail task and retained resolved RND question. History selection preserved the saved answer and resolver notes as read-only. Search by RND name filtered the list; clearing search restored both entries. No clinical forms were submitted in this release smoke.
- Screenshot: ignored `backend/.local/health-inbox-live.jpg`. Provider receipts: excluded `.vercel/health-inbox-deployment.json` and `.vercel/health-inbox-git-deployment.json` in the isolated release checkout. Earlier local fixture verification covered both themes, mobile navigation, separate drafts, correction decisions, account switching and stale-context protections; the bounded live check does not claim an exhaustive system test.

## Rollback

Promote the previous working Vercel deployment `dpl_3jjfgEqLLkTCBciRfZR86May5Pbf` to restore the old frontend while retaining the current backend and database. No database rollback is required. Existing browser tabs may need a reload after promotion to pick up the new bundle.
