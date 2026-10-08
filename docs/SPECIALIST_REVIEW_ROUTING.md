# Specialist review priority

This feature gives matching Registered Nutritionist-Dietitians (RNDs) first access to new member meal, health-profile and supporting-document reviews. It starts **disabled**. It does not add doctor or nurse roles.

## Set up

1. Apply `202610080001_specialist_review_routing` to the authorized database with `npx prisma migrate deploy`, then generate the Prisma client and restart the API. Follow the database authorization and backup workflow in [README.md](../README.md#prismadatabase-workflow).
2. In **Admin → People → Nutritionists → Professional records**, open **Verify review expertise**. Record verified condition expertise, years of experience and the professional evidence reference. Editing an RND's public specialization or self-reported application experience does not qualify them for priority.
3. Each currently eligible RND turns on **Accepting new reviews** on their profile. Availability defaults to off. Turning it off stops new specialist assignments; valid existing claims can be finished until their normal expiry.
4. After reviewing the mappings, enable **Specialist review priority** in the professional records panel. Its recent decisions show the routing stage, reason, pool size and Philippine-time opening deadline.
5. To stop priority routing, turn that control off. Outstanding specialist episodes open to eligible RNDs; disabling does not approve meals or change clinical evidence.

## Matching and access

- Supported verified tags are diabetes, hypertension, kidney disease, heart conditions and pregnancy. A specialist must cover **every** recorded condition. Custom or unmapped conditions, no condition tags, and no fully matching available specialist open directly to the general eligible-RND queue.
- A stable pool contains at most three matching RNDs. Rank new pool members by verified years of experience, then fewer active claims, then longest since their last routing assignment, then stable ID. Missing or ineligible pool members are replaced without extending the clock.
- Current verification, licence validity in Philippine time, active nutritionist role, verified email, absence of suspension and activated invitation status (when applicable) remain required. Admin-verified expertise is additional routing evidence, not a substitute for those gates.
- Related profile, document and first dependent meal cycle work shares one episode. Its opening time is at most 24 hours from the known ready time. The first observed task anchors the episode; later related tasks, evidence edits, safety revisions and pool replacements cannot extend it. Later independent meal cycles have their own episode.
- General access opens earlier at two hours before the earliest stored shopping/cook deadline. The cook deadline currently supplied by the backend is the meal's scheduled date; this feature does not create a new clock-time cooking deadline.
- Existing work predating activation stays general. Once an episode opens, it never becomes specialist-only again. An API worker sweeps ready work every 30 seconds; queue reads and direct actions also refresh routing. This is not a guarantee of notification or review response time.
- Lists, counts, direct details, private document downloads, claims, approvals, rejections and replacement decisions apply routing. Hidden work returns a generic not-found response. When routing is enabled, different members' meal cases remain separate even if their recipes match. Same-member duplicates retain the existing scope checks.
- Claims remain exclusive and last 30 minutes. Material evidence changes release old claims. Lost verification/eligibility or revoked matching expertise releases specialist claims when routing is refreshed. Availability alone does not revoke a valid claim.
- Shared library verification, outside-meal review and existing audit/dispute work remain under their existing access rules. No additional review quorum or legacy lead-reviewer role is introduced. Clinical, report, ingredient, allergy and decision gates still apply after general opening.

## Verification

Backend policy tests cover matching, ranking, eligibility, pool stability, the maximum window and early opening. `npm --prefix backend run test:acceptance:specialist-routing` is a guarded HTTP/SQL acceptance script for a **fresh, disposable** PostgreSQL database at `127.0.0.1:55483/kainara_specialist_routing`; it refuses other targets and external provider credentials. It is not a shared-database setup or seed command.

The fixture covers admin verification, RND availability, hidden queues/counts/direct actions, encrypted document access, a shared clock across stages, evidence and safety revisions, expiry, credential revocation, separate member decisions, idempotent notifications and disabling. Synthetic meals intentionally omit full grocery/catalogue data, so related grocery and disabled-AI background warnings do not constitute verification of those integrations. No real clinical records or provider calls are used.

Frontend tests cover saved and failed toggles, verified zero years, stable verification drafts during polling and protection from a former account's late response. `specialist-review-routing.spec.ts` checks admin and RND controls at phone and desktop widths with intercepted synthetic API responses. Software verification does not establish clinical approval; see the [clinical policy approval record](CLINICAL_POLICY_APPROVAL.md).
