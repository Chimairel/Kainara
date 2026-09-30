import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  BrainCircuit,
  Clock,
  Compass,
  FileText,
  HeartPulse,
  Repeat2,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { evidenceRegisterSections } from './EvidenceRegister';
import { policyChapters } from './DocsPolicies';

export type DocsSection = { id: string; title: string; content: ReactNode };
export type DocsChapter = {
  id: string;
  title: string;
  shortTitle: string;
  group: 'Start here' | 'Use KAINARA' | 'Review and evidence' | 'Policies and help';
  icon: LucideIcon;
  tone: 'accent' | 'cyan' | 'green' | 'amber';
  aliases?: string[];
  summary: ReactNode;
  sections: DocsSection[];
};

const inlineLink =
  'font-semibold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover';

export const docsChapters: DocsChapter[] = [
  {
    id: 'what-is-kainara',
    title: 'What KAINARA is',
    shortTitle: 'What KAINARA is',
    group: 'Start here',
    icon: BookOpen,
    tone: 'accent',
    summary:
      'A Filipino-focused meal planning and nutrition tracking app that combines local recipes, food-composition references, calculated targets, and scoped professional review.',
    sections: [
      {
        id: 'what-is-kainara-purpose',
        title: 'Purpose and limits',
        content: (
          <>
            <p>
              KAINARA helps people plan meals and record nutrition in a Filipino food context. It offers educational
              guidance and planning tools, not diagnosis or treatment. Gemini can assist with drafts and estimates,
              while recorded data and review rules decide what can be used.
            </p>
            <p>
              The app starts with the information a person provides: body measurements, goals, food preferences,
              restrictions, and a shopping schedule. It then looks for meals that fit the recorded context and presents
              them in a dated plan. The plan is a way to organize choices and track them; it cannot observe what a
              person buys, cooks, or eats.
            </p>
            <p>
              A recipe source, a food-composition record, an AI estimate, and a nutritionist decision answer different
              questions. For example, a published recipe establishes that the dish exists, while a composition record
              describes a food item and serving. Neither alone shows that a prepared meal is suitable for a particular
              medical condition.
            </p>
          </>
        ),
      },
      {
        id: 'what-is-kainara-roles',
        title: 'Who uses it',
        content: (
          <>
            <p>
              Users set a profile, view plans, log food, and manage their data. Registered Nutritionist-Dietitians
              review clinical profiles, documents, meal cases, and new recipe submissions. Administrators manage
              accounts, nutritionist applications, and source data.
            </p>
            <p>
              Users are responsible for keeping their declarations current and checking the actual ingredients and
              portions they use. Nutritionists make scoped decisions from the evidence available in a review.
              Administrators maintain the platform and verify professional access, but an administrator adding a recipe
              does not make it a nutritionist-approved meal.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    shortTitle: 'Getting started',
    group: 'Start here',
    icon: Compass,
    tone: 'accent',
    summary: 'Create an account, enter your planning context, review the notices, then read your nutrition guidance.',
    sections: [
      {
        id: 'getting-started-profile',
        title: 'Build your profile',
        content: (
          <>
            <p>
              Register and verify your email. Enter body measurements, activity, goal, and food preferences. Declare
              conditions, allergies, and food restrictions accurately. Supporting clinical documents are optional to
              upload during onboarding, although some cases need reviewed evidence before planning.
            </p>
            <p>
              The measurements and activity level help calculate an initial energy target. Diet and food preferences
              narrow the recipes the planner can consider. Conditions and allergies are treated differently from
              ordinary preferences because they may require a profile review and can rule out meals that would otherwise
              fit the calorie target.
            </p>
            <p>
              If a condition is unclear, describe it as accurately as you can rather than choosing a more specific
              diagnosis you have not received. You can provide a relevant clinical document during the optional
              onboarding step or later from your profile. Uploading a file does not automatically confirm its contents
              or unlock planning.
            </p>
          </>
        ),
      },
      {
        id: 'getting-started-finish',
        title: 'Finish onboarding',
        content: (
          <>
            <p>
              Choose a grocery shopping day, review your answers, and accept the current notices. Read and acknowledge
              your{' '}
              <Link href="/profile/nutrition-report" className={inlineLink}>
                Nutrition Guidance
              </Link>
              , which explains calculated targets and restrictions without requiring AI to write the report.
            </p>
            <p>
              The shopping day determines where the regular seven-day cycle begins. If you join before that cycle
              starts, KAINARA may prepare a shorter starter window for the intervening days. Review the summary before
              accepting it: a wrong condition, allergy, or measurement can affect which meals the system considers.
            </p>
            <p>
              Nutrition Guidance records how the current target and restrictions were derived. Acknowledging that you
              have read it does not mean a nutritionist has approved the profile or every meal. If you correct your
              profile later, the guidance and planning status may need to be refreshed.
            </p>
          </>
        ),
      },
      {
        id: 'getting-started-review',
        title: 'When a nutritionist reviews your profile',
        content: (
          <>
            <p>
              Restricted profiles wait for a nutritionist to confirm the recorded planning context. The nutritionist can
              request a document or correction. This confirmation is separate from approval of a particular meal. Users
              with no declared condition, allergy, or restriction can use eligible base recipes without a case review.
            </p>
            <p>
              The review asks whether the recorded restrictions are specific and supported enough for meal planning. It
              does not diagnose a condition. Where the policy requires a document or more detail, the profile remains
              pending until that requirement is met and a nutritionist records a decision.
            </p>
            <p>
              After a restricted profile is confirmed, a proposed meal still goes through its own case review. That
              second decision considers the meal, serving, and health context together. A later change to a condition or
              allergy can make an older decision inapplicable even when the dish itself has not changed.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'meal-planning',
    title: 'Plans and shopping cycles',
    shortTitle: 'Plans and shopping cycles',
    group: 'Use KAINARA',
    icon: Clock,
    tone: 'cyan',
    summary:
      'Your shopping day anchors a seven-day cycle. A shorter starter plan can bridge the days before the next cycle.',
    sections: [
      {
        id: 'meal-planning-targets',
        title: 'Targets and dates',
        content: (
          <>
            <p>
              KAINARA estimates a daily energy target from the profile and allocates it across breakfast, lunch, and
              dinner. A slot date is the day the meal is scheduled, not when the recipe was generated. The starter plan
              and following weekly cycle are separate selections.
            </p>
            <p>
              Targets are planning estimates based on the recorded measurements, activity, and goal. They are used to
              compare possible servings for a slot. They are not measurements of a person&apos;s exact energy needs, and
              the actual food prepared can differ from a recorded recipe.
            </p>
            <p>
              Each planned day has its own breakfast, lunch, and dinner positions. If the next regular cycle begins soon
              after signup, the starter window can be only one day long. The following week should be selected as its
              own cycle; it is not intended to be a copy of the starter day.
            </p>
          </>
        ),
      },
      {
        id: 'meal-planning-selection',
        title: 'How meals are selected',
        content: (
          <>
            <p>
              The planner tries recorded eligible servings first, then other eligible published recipes. It checks
              current restrictions, source availability, ingredient and serving data, and the slot&apos;s energy range.
              A restricted user&apos;s saved candidate may still need one or two independent case decisions before it is
              actionable.
            </p>
            <p>
              A verified base recipe is only a starting point. The planner still needs a usable portion, enough
              ingredient and nutrition information for its checks, and a fit for the requested meal type and target
              range. A dish that appears in the browse catalogue can therefore be absent from a plan without being
              medically unsafe.
            </p>
            <p>
              For a user with a restricted profile, a new candidate is a proposal until the required review is complete.
              KAINARA can show that a meal is awaiting review, but it should not present a pending case as an approved
              instruction to eat that meal.
            </p>
          </>
        ),
      },
      {
        id: 'meal-planning-gaps',
        title: 'Variety and missing slots',
        content: (
          <>
            <p>
              KAINARA prefers distinct dishes. When the suitable pool is too small, an eligible recipe can recur on
              another day. A slot can remain empty when no candidate passes the requirements or generation is pending. A
              missing slot is not an instruction to skip eating.
            </p>
            <p>
              The available set changes with the user&apos;s energy target, diet, allergies, conditions, recipe data,
              and active reviews. To fill more days, the planner can rotate a recipe that already passed those checks;
              it does not relax a restriction simply to avoid a blank slot. This means repetition may be more visible
              when few recipes fit a particular breakfast or serving range.
            </p>
            <p>
              If a day is incomplete, check the status shown for that plan and any available retry action. The app may
              still be preparing candidates, or the present catalogue may have no eligible option. Use your own food
              judgment and professional advice as needed; the empty slot is a system limitation.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'meal-library',
    title: 'Meal Library',
    shortTitle: 'Meal Library',
    group: 'Use KAINARA',
    icon: UtensilsCrossed,
    tone: 'green',
    summary:
      'The Library distinguishes a verified base recipe from a reusable approval and a serving scheduled in your own plan.',
    sections: [
      {
        id: 'meal-library-labels',
        title: 'What the labels mean',
        content: (
          <>
            <p>
              <strong className="text-brand-text">Verified base recipes</strong> are published Panlasang Pinoy dishes or
              other recipes whose identity was checked. That means the dish is a real recipe; it does not certify
              nutrition or suitability for everyone. <strong className="text-brand-text">Reusable recipes</strong> have
              recorded serving and safety evidence for the relevant query.{' '}
              <strong className="text-brand-text">Meals in your plan</strong> are scheduled portions and may appear
              before separate reusable certification.
            </p>
            <p>
              The labels refer to different records. A base recipe can be browsed because its identity is known, while
              the planner may still lack the portion or ingredient evidence needed to schedule it. A case approval is
              narrower: it applies to a recorded serving and health context and can be reused only when the later
              user&apos;s relevant context matches the approved scope.
            </p>
          </>
        ),
      },
      {
        id: 'meal-library-use',
        title: 'Browsing and use',
        content: (
          <>
            <p>
              Browsing a recipe does not add it to your plan. Planning and swaps check your current profile, source
              availability, serving data, and the selected slot. A goal or calorie mismatch can change eligibility
              without changing the identity of the dish.
            </p>
            <p>
              The browse view is meant for discovery. It can show more verified dishes than the number currently
              suitable for a plan. To understand why a recipe was scheduled, compare its recorded serving and status
              with the date, meal type, and your current profile. If your health information changes, a recipe that
              appeared earlier may need a fresh decision.
            </p>
          </>
        ),
      },
      {
        id: 'meal-library-flags',
        title: 'Flags and approvals',
        content: (
          <>
            <p>
              A flagged base meal is withheld together with its serving variants and associated approvals until
              reviewed. A case approval can also be flagged or become due for recheck without changing the published
              base recipe.
            </p>
            <p>
              These two levels matter when something is questioned. A meal-level flag pauses the underlying dish and
              every approval built on it. An approval-level flag applies only to the particular serving and health
              context reviewed. A due or disputed approval is also unavailable for reuse until the required follow-up is
              recorded.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'tracking',
    title: 'Daily tracking',
    shortTitle: 'Daily tracking',
    group: 'Use KAINARA',
    icon: Sparkles,
    tone: 'green',
    aliases: ['daily-tracking'],
    summary: 'Record what you actually ate or skipped and use progress summaries as a record of your entries.',
    sections: [
      {
        id: 'tracking-meals',
        title: 'Meals and daily progress',
        content: (
          <>
            <p>
              On the dashboard, mark a scheduled meal eaten or skipped. A scheduled meal alone is not proof that it was
              eaten. The calorie and macro summaries depend on what has been recorded.
            </p>
            <p>
              Plan cards describe what was proposed for a date. When you mark a meal eaten, the app can include that
              record in progress summaries; when you skip it, the record reflects that choice instead. Logging a
              different food outside the plan is a separate action. The difference matters because a plan, a completed
              meal, and an outside meal are not interchangeable evidence of intake.
            </p>
          </>
        ),
      },
      {
        id: 'tracking-other',
        title: 'Water, weight, and changes',
        content: (
          <>
            <p>
              Record water and weight separately. Weight and adherence summaries are not diagnoses. If you change a
              restriction or another planning input, review the current plan again; a saved meal can need revalidation
              even when its name is unchanged.
            </p>
            <p>
              Progress charts summarize the entries available to the system. A missing entry can mean that nothing was
              recorded, not that no food or water was consumed. Weight changes can have many causes, so use these charts
              as a personal record rather than as a medical interpretation.
            </p>
            <p>
              If you update an allergy, condition, or food restriction, check meals already scheduled for future dates.
              KAINARA may pause or recheck their use because the earlier decision was made for the previous profile.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'outside-meals',
    title: 'Food outside your plan',
    shortTitle: 'Food logging',
    group: 'Use KAINARA',
    icon: FileText,
    tone: 'amber',
    summary: 'Log food eaten outside the plan without treating that log as a verified recipe.',
    sections: [
      {
        id: 'outside-meals-log',
        title: 'Recording food or a snack',
        content: (
          <>
            <p>
              Record a meal, snack, drink, or individual food you actually consumed outside the plan. Enter known
              ingredients and portion details when available. Nutrition may be estimated or incomplete. An allergy or
              condition warning is not a substitute for checking the real food, packaging, and preparation.
            </p>
            <p>
              A useful entry identifies the food and any known ingredients. Grams and preparation notes help narrow an
              AI estimate but are optional; without them, the estimate assumes a typical serving and remains
              provisional. Restaurant recipes, sauces, cooking oils, and shared equipment may not be visible to KAINARA.
            </p>
            <p>
              If a warning appears, check the food directly and follow the advice of your own healthcare professional
              for serious allergies or medical restrictions. An absent warning does not prove that an unlisted
              ingredient or cross-contact is absent.
            </p>
          </>
        ),
      },
      {
        id: 'outside-meals-library',
        title: 'Proposing a reusable recipe',
        content: (
          <>
            <p>
              An outside log records your consumption. With separate consent, a reusable recipe proposal may enter meal
              verification. Neither the log nor the proposal automatically becomes a verified base recipe or a
              health-context case approval.
            </p>
            <p>
              This separation lets you track a meal without publishing it to other users. If you separately propose it
              for the catalogue, a nutritionist first checks the submitted dish as a general recipe. Only after that
              meal verification can it join the verified base library, and its ingredient, portion, and nutrition
              evidence still determine whether planning can use it.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'meal-swaps',
    title: 'Meal swaps',
    shortTitle: 'Meal swaps',
    group: 'Use KAINARA',
    icon: Repeat2,
    tone: 'cyan',
    summary: 'Preview a replacement for a scheduled slot and confirm it only when it fits your current context.',
    sections: [
      {
        id: 'meal-swaps-preview',
        title: 'Preview and confirm',
        content: (
          <>
            <p>
              KAINARA checks current profile restrictions and the destination slot, and warns when the calorie
              difference is substantial. A confirmed swap changes that plan slot and refreshes its grocery data; it does
              not approve the replacement for every other user.
            </p>
            <p>
              Open the replacement choices from a scheduled meal and inspect the candidate before confirming. The
              comparison concerns the meal in that particular breakfast, lunch, or dinner position. A recipe that is
              eligible elsewhere may still be a poor fit for the current slot&apos;s target or recorded restrictions.
            </p>
            <p>
              After confirmation, use the updated plan and grocery list rather than an earlier export. The swap affects
              your own saved cycle; it does not change the published base recipe or extend a case approval to a
              different health profile.
            </p>
          </>
        ),
      },
      {
        id: 'meal-swaps-limits',
        title: 'Availability',
        content: (
          <>
            <p>
              Choices may be limited by serving evidence, flags, review state, and your profile. If a meal has been
              logged or shopping has begun, whole-plan replacement may be unavailable; inspect the controls shown for
              that cycle.
            </p>
            <p>
              A small swap list is often a sign that few recorded servings pass all checks at once. Browsable recipes
              without planning-ready evidence are not automatically offered as replacements. If a base meal or its
              particular case approval has been flagged, the affected option is held back until the review is resolved.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'groceries',
    title: 'Grocery lists',
    shortTitle: 'Grocery lists',
    group: 'Use KAINARA',
    icon: ShoppingCart,
    tone: 'accent',
    summary: 'The grocery page groups ingredients from your saved meals and helps track purchases.',
    sections: [
      {
        id: 'groceries-list',
        title: 'Using the list',
        content: (
          <>
            <p>
              Check the linked recipes and actual household portions before shopping. Quantities, units, and
              availability can be incomplete. A changed meal or plan can make an older grocery list stale.
            </p>
            <p>
              Choose Current week or Next week to view the ingredients available for that cycle. Both tabs can be
              selected. If no upcoming cycle is available, the page shows “No grocery list for next week yet”. Switching
              tabs does not create a plan. Lists include available cleared ingredients and may remain partial while
              other meals are pending. Marking an item purchased is a checklist action; it does not verify the amount
              bought or the safety of a particular product. Check package labels, substitutions, and household serving
              sizes yourself.
            </p>
            <p>
              When a meal is swapped, paused, or regenerated, review the list again. An earlier screen capture or
              printout may still contain ingredients from the old plan, while a newly generated list reflects the
              recorded meals at its creation time.
            </p>
          </>
        ),
      },
      {
        id: 'groceries-export',
        title: 'PDF export',
        content: (
          <>
            <p>
              Where offered, the PDF reflects the recorded list at that point in time. It is a shopping aid, not a
              guarantee that every listed quantity covers a prepared recipe.
            </p>
            <p>
              Keep the export alongside the source recipes if you need preparation detail. Ingredient names, household
              measures, edible weights, and package sizes do not always translate exactly into one another. Use the PDF
              as a checklist and confirm the quantities needed for the way you intend to cook.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'professional-review',
    title: 'Nutritionist and admin review',
    shortTitle: 'Professional review',
    group: 'Review and evidence',
    icon: Stethoscope,
    tone: 'green',
    summary:
      'Meal verification, profile review, and case approval answer different questions and keep separate decision records.',
    sections: [
      {
        id: 'professional-review-types',
        title: 'Three review types',
        content: (
          <>
            <p>
              <strong className="text-brand-text">Meal verification</strong> checks a new dish as a base recipe without
              a patient profile. <strong className="text-brand-text">Profile review</strong> checks declared
              restrictions and submitted evidence before restricted planning.{' '}
              <strong className="text-brand-text">Case approval</strong> checks a particular meal and serving against a
              recorded health context. None is a universal safety guarantee.
            </p>
            <p>
              For example, an administrator can submit a new recipe for meal verification. That decision establishes
              whether the dish belongs in the base catalogue. Separately, a user who declares hypertension may need
              their restriction context confirmed. A proposed serving for that user then receives its own case decision.
              Passing one stage does not silently grant the other two.
            </p>
            <p>
              Published Panlasang Pinoy recipes carry a source-based verification label because they are established
              dishes. That label does not claim that every imported ingredient quantity or nutrient value has been
              checked for planning, and it does not create a health-context approval.
            </p>
          </>
        ),
      },
      {
        id: 'professional-review-decisions',
        title: 'Decisions and rechecks',
        content: (
          <>
            <p>
              Nutritionists claim review work and record reasons. Higher risk cases may need an independent second
              decision. Flags, due reviews, disputes, changed recipes, or changed user profiles can block reuse.
              Administrators verify nutritionist applications and can submit new recipes for meal verification.
            </p>
            <p>
              A case decision is tied to the ingredients, serving, and profile evidence inspected at review time.
              Another user can benefit from a reusable decision only when the relevant context matches its recorded
              scope and the approval is still active. A second decision, when required, must be made independently
              rather than counted twice from one reviewer.
            </p>
            <p>
              Scheduled rechecks ask whether an older approval still has current support. A flag raises a specific
              concern; a dispute records conflicting decisions that need resolution. These states keep an approval out
              of reuse while the follow-up is incomplete. A flag on the base meal has a wider effect and pauses its
              related variants and approvals.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'data-sources',
    title: 'Sources and evidence',
    shortTitle: 'Sources and evidence',
    group: 'Review and evidence',
    icon: BrainCircuit,
    tone: 'cyan',
    summary:
      'The methods, Philippine nutrition data, safety guidance, and recipe sources behind KAINARA, with each source’s role and limits stated clearly.',
    sections: [
      {
        id: 'data-sources-reference',
        title: 'Published recipes and composition',
        content: (
          <>
            <p>
              Panlasang Pinoy supplies source recipes and attributed images or links where available. The DOST-FNRI
              Philippine Food Composition Tables provide food-level nutrient references. Other configured composition
              records may supplement a missing match. These sources do not establish laboratory-measured nutrients for
              every whole recipe or a confirmed edible weight for every ingredient.
            </p>
            <p>
              The recipe source describes a dish and its preparation. A food-composition table describes individual food
              items, often for a defined edible amount. Connecting an ingredient phrase from a recipe to a composition
              record requires an identity match, and turning household measures into nutrient totals requires usable
              amounts. A familiar name alone cannot fill a missing weight or resolve a vague ingredient.
            </p>
            <p>
              The full source register appears below. You can also inspect the{' '}
              <a
                href="https://i.fnri.dost.gov.ph/fct/library"
                className={inlineLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                official PhilFCT resource
              </a>{' '}
              directly.
            </p>
          </>
        ),
      },
      {
        id: 'data-sources-estimates',
        title: 'AI estimates and labels',
        content: (
          <>
            <p>
              Gemini can draft meal candidates and assist with some estimates. Generated values are checked against
              structured rules and may still need professional review. Recipe verification and case-review statuses
              describe their respective decisions; a displayed nutrient value is not proof of a laboratory measurement.
            </p>
            <p>
              An AI-produced meal name or nutrient number is a proposal, not measured food data. The system checks
              available structure and restrictions before saving a candidate, and a restricted case may still wait for a
              nutritionist. If a needed ingredient, serving, or source detail cannot be established, the application
              should show that gap rather than treating an estimate as confirmed composition.
            </p>
          </>
        ),
      },
      ...evidenceRegisterSections,
    ],
  },
  {
    id: 'clinical-guidelines',
    title: 'Clinical Guidelines',
    shortTitle: 'Clinical Guidelines',
    group: 'Review and evidence',
    icon: HeartPulse,
    tone: 'amber',
    aliases: ['clinical-safety'],
    summary: 'Accurate declarations and current review evidence are central to restriction-aware planning.',
    sections: [
      {
        id: 'clinical-guidelines-profile',
        title: 'Keep the profile accurate',
        content: (
          <>
            <p>
              Enter diagnosed conditions, allergies, medications or relevant risk context truthfully and update them
              when they change. A vague entry may need correction. Some conditions require reviewed documents; a
              nutritionist may also request evidence for a specific declared area. Do not upload another person&apos;s
              record, and cover unrelated identifiers before submitting a supporting file.
            </p>
            <p>
              The system can only compare meals against the restrictions it has recorded. For example, a broad label may
              not contain the severity or subtype needed for a useful decision. A nutritionist can ask for clarification
              or supporting evidence before confirming that the profile is specific enough for planning.
            </p>
            <p>
              A document review checks whether the submitted material supplies relevant nutrition context. It is not a
              medical diagnosis or a guarantee that the file is authentic. If a condition, medication, allergy, or
              clinical instruction changes later, update the profile rather than relying on an older review.
            </p>
          </>
        ),
      },
      {
        id: 'clinical-guidelines-gates',
        title: 'Review gates',
        content: (
          <>
            <p>
              Restricted profiles wait for a current profile decision and a meal-specific case decision. A second
              independent reviewer can be required. Ingredient conflicts, missing evidence, flags, expired approvals,
              and changed profiles can block use. Nutritionists assess recorded evidence; they do not diagnose through
              this app.
            </p>
            <p>
              Profile confirmation allows the system to prepare candidates for the declared restrictions. It does not
              approve all meals bearing a matching condition label. The case review checks a particular ingredient set
              and serving against the recorded context, and an approval can be reused only within that scope while it
              remains current.
            </p>
            <p>
              These checks are deliberately separate. A verified recipe may still have incomplete nutrition evidence. A
              suitable serving may still lack a case decision. A previously approved case may be paused after a flag,
              source change, or scheduled recheck. The status shown with the meal indicates which step is still
              outstanding.
            </p>
          </>
        ),
      },
      {
        id: 'clinical-guidelines-urgent',
        title: 'Urgent concerns',
        content: (
          <>
            <p>
              If you have a severe reaction, symptoms, or an urgent medical concern, seek in-person or emergency care.
              Do not rely on KAINARA to identify or manage an emergency.
            </p>
            <p>
              Meal planning cannot account for every ingredient substitution, preparation mistake, cross-contact event,
              or change in a person&apos;s health. Follow an existing care plan from your qualified healthcare
              professional and use local emergency services when urgent help is needed.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'medical-disclaimers',
    title: 'Medical Disclaimers',
    shortTitle: 'Medical Disclaimers',
    group: 'Policies and help',
    icon: ShieldAlert,
    tone: 'amber',
    summary:
      'KAINARA supports meal planning and education, with limits that matter most for allergies and medical conditions.',
    sections: [
      {
        id: 'medical-disclaimers-scope',
        title: 'Scope of the service',
        content: (
          <>
            <p>
              KAINARA is not a medical device, clinician, emergency service, diagnosis, prescription, or treatment plan.
              An AI result, published recipe, nutritionist review, and case approval each have different scopes. None
              guarantees freedom from allergens, cross-contact, preparation errors, or adverse effects.
            </p>
            <p>
              The app helps organize meal choices from the information and evidence recorded in it. A
              nutritionist&apos;s decision relates to the recipe, serving, and user context presented for that review;
              it does not certify an independently prepared dish or replace individualized medical care. AI estimates
              and recipe labels should be read with their stated limits.
            </p>
          </>
        ),
      },
      {
        id: 'medical-disclaimers-checks',
        title: 'Check the actual food',
        content: (
          <>
            <p>
              Nutrition data may be estimated, incomplete, or based on a different serving than what you eat. Check
              ingredients, labels, portions, and preparation, particularly for allergies and conditions. Discuss
              individual restrictions and medication-related diet changes with your own qualified healthcare
              professional.
            </p>
            <p>
              A named dish can be prepared in many ways. Sauces, oils, garnishes, packaged substitutes, and restaurant
              practices may change both nutrient amounts and allergen exposure. Compare the plan with the actual
              ingredients and packaging before eating. Seek qualified advice if your medical instructions conflict with
              a suggestion in the app.
            </p>
          </>
        ),
      },
    ],
  },
  ...policyChapters,
];
