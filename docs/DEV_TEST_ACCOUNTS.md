# Development test accounts

The admin tool and CLI create clearly marked synthetic accounts in the database already used by your local API. Sign in at `http://localhost:3000/login` with the ordinary password form. There is no test-login endpoint, special cookie or frontend authorization bypass. Gmail, OTP delivery, onboarding screens and the RND application are unnecessary for these fixtures.

## Admin UI

In the local development app, open **Admin → People → Accounts → Create test accounts**. Choose a group name, display name, role and one to ten accounts. Members can configure age, biological sex, height, current and target weight, goal, activity level, dietary preference, rice preference, food culture and shopping day, as well as multiple conditions and allergies. All new members in a group share those selections. RNDs can be active, expired, unverified or suspended. The existing administering account records RND fixture provenance, so creating an RND does not require creating another admin.

Member fields use the ordinary onboarding limits and goal/target-weight rules. Maintain keeps target weight equal to current weight; pregnancy requires a female profile. The normal calculators derive calorie and macro targets from the selected profile, and the acknowledged report baseline saves the same profile snapshot. These fields apply only to member accounts. Defaults remain age 26, male, 170 cm, 65 kg, Maintain, Sedentary, Omnivore, flexible rice, Filipino food culture and Saturday shopping.

Select **Preview accounts**, inspect the database host/name and new/existing rows, then confirm the target and select **Create accounts**. A signed preview expires after ten minutes and binds the actor, database and all options. Editing options requires a new preview. The server accepts only an authenticated live administrator in an explicit development runtime, rejects capstone-demo/production and production-like target markers, and limits requests. The UI is hidden when this capability is unavailable.

Save or copy the returned login credentials before closing. All newly created test accounts across groups and roles share one server-configured password, also used by the CLI. The password is returned only when new accounts are created. Existing passwords, profiles and reviews are unchanged, including accounts created before this policy. The admin tool does not save a local credential guide or persist the plaintext password; if the response is lost, creating a fresh account returns the same password while the server configuration is unchanged. Repeating the same group/role/count keeps existing accounts even if the requested options differ. Use a new group when testing a different profile or RND state.

To choose your own common password, set the server-only `DEV_TEST_ACCOUNT_PASSWORD` in the backend environment (8 or more characters, at most 72 UTF-8 bytes). When omitted, the common password is derived using a dedicated HMAC purpose from the backend `JWT_SECRET`; it is not the signing secret itself. Keep it out of frontend configuration and source control. Changing either setting changes the password for future accounts only; existing accounts retain their original credentials. Ordinary accounts do not use this policy.

Names start with `[TEST <group>]`; emails use the reserved `example.test` domain. Each new account has an atomic audit event attributed to the administering account, without passwords or tokens. No meals, approvals, premium membership or clinical evidence are provisioned. Suspend active test RNDs in Account management when no longer needed. Shared development data remains shared; this tool is not database isolation.

The UI and CLI share the same create-only writer in `backend/src/services/dev-test-accounts`. Existing script imports remain compatibility entry points. No database migration or environment-secret change is needed to use the UI on an already configured development API.

## Default set

`npm --prefix backend run test:accounts -- --set walkthrough` is a read-only dry run. The set name separates independent groups of accounts. The default set name is `qa`.

| Alias | Role | Synthetic setup |
| --- | --- | --- |
| admin | Admin | Normal admin access |
| member-healthy | Member | No conditions |
| member-heart | Member | Heart condition |
| member-diabetes | Member | Diabetes |
| member-kidney | Member | Kidney disease |
| rnd-heart-junior | RND | Heart expertise, 3 years |
| rnd-heart-senior | RND | Heart expertise, 15 years |
| rnd-diabetes | RND | Diabetes expertise, 8 years |
| rnd-kidney | RND | Kidney expertise, 12 years |
| rnd-general | RND | No condition expertise, 25 years |

Emails follow `qa-<set>-<alias>@example.test`, for example `qa-walkthrough-admin@example.test`. Names start with `[TEST walkthrough]`; PRC values and professional bios explicitly identify test credentials. These are not real clinicians or clinical credential verifications.

Members receive complete profile/preferences, explicit safety declarations, disabled meal reminders in Asia/Manila and a clearly marked synthetic acknowledged report baseline. Declared conditions remain subject to the ordinary clinical detail, evidence, approval and meal eligibility checks. The script creates no meals, approvals, clinical documents, subscriptions, premium grants or claims. All eligible test RNDs share the same queue; recorded expertise and experience do not grant priority. Their health details can be filled in through the normal UI as needed.

## Create after confirming the target

Run from the repository root with the normal backend `.env`. `NODE_ENV` must explicitly be `development` or `test`.

```powershell
npm --prefix backend run test:accounts -- --set walkthrough
```

Inspect the printed database host/name and the CREATE/KEEP list. Confirm it is the intended development database. Then use the token printed by that dry run:

```powershell
npm --prefix backend run test:accounts -- --set walkthrough --apply --confirm-target <printed-token> --allow-shared-development
```

Replace `<printed-token>` with the actual value; do not paste the placeholder literally. `--allow-shared-development` is required for a remote target such as the configured development Neon database. A local loopback database needs the target token but not that extra flag. Production/demo/staging markers and production-like host/database names are refused; the flag is an explicit developer declaration, not automatic proof that an otherwise generically named remote database is safe.

The script uses the same common password as the admin tool and prints the path of a credential JSON file under `backend/.local/dev-test-accounts/`. That directory is Git-ignored. Open that local file to see the email list and `newAccountPassword`; the password is not printed or committed. Optional `DEV_TEST_ACCOUNT_PASSWORD` must meet the limits above. Do not put passwords in a committed JSON specification or CLI argument.

Existing accounts are kept, including their passwords, profiles, expiry/suspension state and review history. Re-running does not repair or reset a used fixture; use a new set/alias to start again. Only accounts marked `passwordApplies: true` in a COMPLETE guide use that guide's password. A PREPARED guide does not establish a successful transaction. Account creation and its synthetic audit events are atomic; collisions refuse the entire group. Repeated concurrent creation of the same set is serialized. No migration is applied automatically.

## Custom roles, conditions and experience

Use a local JSON array with `--spec <path>`; preview and apply must use the same specification. Maximum 30 accounts per invocation. Aliases and set names are lowercase slugs up to 24 characters. Include a synthetic admin when provisioning RNDs so their fixture credential provenance has an actor. Internal roles remain USER/NUTRITIONIST/ADMIN; the specification uses USER/RND/ADMIN.

```json
[
  { "alias": "admin", "name": "Test Admin", "role": "ADMIN" },
  {
    "alias": "heart-member",
    "name": "Test Heart Member",
    "role": "USER",
    "member": {
      "conditions": ["HEART_CONDITION"],
      "allergens": ["NONE"],
      "profile": {
        "age": 45,
        "biologicalSex": "FEMALE",
        "heightCm": 165,
        "weightKg": 72,
        "targetWeightKg": 65,
        "goal": "LOSE_WEIGHT",
        "activityLevel": "ACTIVE",
        "dietaryPreference": "PESCATARIAN",
        "ricePreference": "NO_RICE",
        "foodCulture": "Filipino",
        "shoppingDayOfWeek": 2
      }
    }
  },
  {
    "alias": "heart-rnd",
    "name": "Test Heart RND",
    "role": "RND",
    "rnd": { "expertise": ["HEART_CONDITION"], "experienceYears": 12, "status": "ACTIVE" }
  },
  {
    "alias": "expired-rnd",
    "name": "Test Expired RND",
    "role": "RND",
    "rnd": { "expertise": ["DIABETES"], "experienceYears": 20, "status": "EXPIRED" }
  }
]
```

Conditions: DIABETES, HYPERTENSION, KIDNEY_DISEASE, HEART_CONDITION, PREGNANT or NONE. Allergens: SHELLFISH, NUTS, DAIRY, GLUTEN, EGGS or NONE. NONE cannot accompany another declaration or appear in RND expertise. RND status can be ACTIVE, EXPIRED, UNVERIFIED or SUSPENDED. Expired/unverified accounts can authenticate but cannot perform clinical reviews; suspended accounts cannot log in. Missing member settings default to NONE declarations. Missing RND settings default to active, general expertise and zero years.

Optional `member.profile` fields use the defaults above when omitted. Shopping days use 0 for Sunday through 6 for Saturday. Derived calorie targets, report versions and other unsupported fields are rejected. For a pregnancy fixture with an explicit profile, set `biologicalSex` to `FEMALE`; an omitted profile retains the existing automatic female baseline.

## Which tests use localhost

Use the normal localhost app for sign-in, role navigation, responsive UI and controlled journeys involving only synthetic accounts and purpose-created test meals. Active test RNDs join the actual configured shared review pool; localhost is a web address, not database isolation. Suspend test RNDs through normal admin account controls when they are no longer needed. Keep any review attribution and audit history; do not delete reviewers who have participated in decisions.

Use a disposable database for destructive tests, bulk import failures, concurrency stress, recipe-wide flags/quarantine or changes to global routing/reference data that could affect existing members. No test should flag a shared recipe merely to exercise the flow. Ordinary auth, evidence and approval gates stay active for both environments. Never send provider requests containing test credentials or real member data.

## Verification

The six policy checks run in the normal backend suite. `scripts/dev-test-accounts-local-acceptance.ts` refuses every target except its exact task-owned loopback PostgreSQL database, and uses actual SQL/password authentication to check all roles, onboarding/report baselines, expertise, negative RND eligibility, preserved passwords, concurrent creation and transaction rollback. It does not start another frontend or call a provider. Database-backed acceptance creates synthetic data only in its authorized disposable target; it does not establish clinical correctness or full browser coverage on the owner's shared app.
