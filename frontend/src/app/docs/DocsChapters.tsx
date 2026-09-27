import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BookOpen, BrainCircuit, Clock, Compass, FileText, HeartPulse, HelpCircle,
  Lock, Repeat2, ShieldAlert, ShoppingCart, Sparkles, Stethoscope, User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { evidenceRegisterSections } from './EvidenceRegister';

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

const inlineLink = 'font-semibold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover';

export const docsChapters: DocsChapter[] = [
  {
    id: 'what-is-kainara', title: 'What KAINARA is', shortTitle: 'What KAINARA is',
    group: 'Start here', icon: BookOpen, tone: 'accent',
    summary: 'A Filipino-focused meal planning and nutrition tracking app that combines local recipes, food-composition references, calculated targets, and scoped professional review.',
    sections: [
      { id: 'what-is-kainara-purpose', title: 'Purpose and limits', content: <>
        <p>KAINARA helps people plan meals and record nutrition in a Filipino food context. It offers educational guidance and planning tools, not diagnosis or treatment. Gemini can assist with drafts and estimates, while recorded data and review rules decide what can be used.</p>
        <p>The app starts with the information a person provides: body measurements, goals, food preferences, restrictions, and a shopping schedule. It then looks for meals that fit the recorded context and presents them in a dated plan. The plan is a way to organize choices and track them; it cannot observe what a person buys, cooks, or eats.</p>
        <p>A recipe source, a food-composition record, an AI estimate, and a nutritionist decision answer different questions. For example, a published recipe establishes that the dish exists, while a composition record describes a food item and serving. Neither alone shows that a prepared meal is suitable for a particular medical condition.</p>
      </> },
      { id: 'what-is-kainara-roles', title: 'Who uses it', content: <>
        <p>Users set a profile, view plans, log food, and manage their data. Registered Nutritionist-Dietitians review clinical profiles, documents, meal cases, and new recipe submissions. Administrators manage accounts, nutritionist applications, and source data.</p>
        <p>Users are responsible for keeping their declarations current and checking the actual ingredients and portions they use. Nutritionists make scoped decisions from the evidence available in a review. Administrators maintain the platform and verify professional access, but an administrator adding a recipe does not make it a nutritionist-approved meal.</p>
      </> },
    ],
  },
  {
    id: 'getting-started', title: 'Getting started', shortTitle: 'Getting started',
    group: 'Start here', icon: Compass, tone: 'accent',
    summary: 'Create an account, enter your planning context, review the notices, then read your nutrition guidance.',
    sections: [
      { id: 'getting-started-profile', title: 'Build your profile', content: <>
        <p>Register and verify your email. Enter body measurements, activity, goal, and food preferences. Declare conditions, allergies, and food restrictions accurately. Supporting clinical documents are optional to upload during onboarding, although some cases need reviewed evidence before planning.</p>
        <p>The measurements and activity level help calculate an initial energy target. Diet and food preferences narrow the recipes the planner can consider. Conditions and allergies are treated differently from ordinary preferences because they may require a profile review and can rule out meals that would otherwise fit the calorie target.</p>
        <p>If a condition is unclear, describe it as accurately as you can rather than choosing a more specific diagnosis you have not received. You can provide a relevant clinical document during the optional onboarding step or later from your profile. Uploading a file does not automatically confirm its contents or unlock planning.</p>
      </> },
      { id: 'getting-started-finish', title: 'Finish onboarding', content: <>
        <p>Choose a grocery shopping day, review your answers, and accept the current notices. Read and acknowledge your <Link href="/profile/nutrition-report" className={inlineLink}>Nutrition Guidance</Link>, which explains calculated targets and restrictions without requiring AI to write the report.</p>
        <p>The shopping day determines where the regular seven-day cycle begins. If you join before that cycle starts, KAINARA may prepare a shorter starter window for the intervening days. Review the summary before accepting it: a wrong condition, allergy, or measurement can affect which meals the system considers.</p>
        <p>Nutrition Guidance records how the current target and restrictions were derived. Acknowledging that you have read it does not mean a nutritionist has approved the profile or every meal. If you correct your profile later, the guidance and planning status may need to be refreshed.</p>
      </> },
      { id: 'getting-started-review', title: 'When a nutritionist reviews your profile', content: <>
        <p>Restricted profiles wait for a nutritionist to confirm the recorded planning context. The nutritionist can request a document or correction. This confirmation is separate from approval of a particular meal. Users with no declared condition, allergy, or restriction can use eligible base recipes without a case review.</p>
        <p>The review asks whether the recorded restrictions are specific and supported enough for meal planning. It does not diagnose a condition. Where the policy requires a document or more detail, the profile remains pending until that requirement is met and a nutritionist records a decision.</p>
        <p>After a restricted profile is confirmed, a proposed meal still goes through its own case review. That second decision considers the meal, serving, and health context together. A later change to a condition or allergy can make an older decision inapplicable even when the dish itself has not changed.</p>
      </> },
    ],
  },
  {
    id: 'meal-planning', title: 'Plans and shopping cycles', shortTitle: 'Plans and shopping cycles',
    group: 'Use KAINARA', icon: Clock, tone: 'cyan',
    summary: 'Your shopping day anchors a seven-day cycle. A shorter starter plan can bridge the days before the next cycle.',
    sections: [
      { id: 'meal-planning-targets', title: 'Targets and dates', content: <>
        <p>KAINARA estimates a daily energy target from the profile and allocates it across breakfast, lunch, and dinner. A slot date is the day the meal is scheduled, not when the recipe was generated. The starter plan and following weekly cycle are separate selections.</p>
        <p>Targets are planning estimates based on the recorded measurements, activity, and goal. They are used to compare possible servings for a slot. They are not measurements of a person&apos;s exact energy needs, and the actual food prepared can differ from a recorded recipe.</p>
        <p>Each planned day has its own breakfast, lunch, and dinner positions. If the next regular cycle begins soon after signup, the starter window can be only one day long. The following week should be selected as its own cycle; it is not intended to be a copy of the starter day.</p>
      </> },
      { id: 'meal-planning-selection', title: 'How meals are selected', content: <>
        <p>The planner tries recorded eligible servings first, then other eligible published recipes. It checks current restrictions, source availability, ingredient and serving data, and the slot&apos;s energy range. A restricted user&apos;s saved candidate may still need one or two independent case decisions before it is actionable.</p>
        <p>A verified base recipe is only a starting point. The planner still needs a usable portion, enough ingredient and nutrition information for its checks, and a fit for the requested meal type and target range. A dish that appears in the browse catalogue can therefore be absent from a plan without being medically unsafe.</p>
        <p>For a user with a restricted profile, a new candidate is a proposal until the required review is complete. KAINARA can show that a meal is awaiting review, but it should not present a pending case as an approved instruction to eat that meal.</p>
      </> },
      { id: 'meal-planning-gaps', title: 'Variety and missing slots', content: <>
        <p>KAINARA prefers distinct dishes. When the suitable pool is too small, an eligible recipe can recur on another day. A slot can remain empty when no candidate passes the requirements or generation is pending. A missing slot is not an instruction to skip eating.</p>
        <p>The available set changes with the user&apos;s energy target, diet, allergies, conditions, recipe data, and active reviews. To fill more days, the planner can rotate a recipe that already passed those checks; it does not relax a restriction simply to avoid a blank slot. This means repetition may be more visible when few recipes fit a particular breakfast or serving range.</p>
        <p>If a day is incomplete, check the status shown for that plan and any available retry action. The app may still be preparing candidates, or the present catalogue may have no eligible option. Use your own food judgment and professional advice as needed; the empty slot is a system limitation.</p>
      </> },
    ],
  },
  {
    id: 'meal-library', title: 'Meal Library', shortTitle: 'Meal Library',
    group: 'Use KAINARA', icon: UtensilsCrossed, tone: 'green',
    summary: 'The Library distinguishes a verified base recipe from a reusable approval and a serving scheduled in your own plan.',
    sections: [
      { id: 'meal-library-labels', title: 'What the labels mean', content: <>
        <p><strong className="text-brand-text">Verified base recipes</strong> are published Panlasang Pinoy dishes or other recipes whose identity was checked. That means the dish is a real recipe; it does not certify nutrition or suitability for everyone. <strong className="text-brand-text">Reusable recipes</strong> have recorded serving and safety evidence for the relevant query. <strong className="text-brand-text">Meals in your plan</strong> are scheduled portions and may appear before separate reusable certification.</p>
        <p>The labels refer to different records. A base recipe can be browsed because its identity is known, while the planner may still lack the portion or ingredient evidence needed to schedule it. A case approval is narrower: it applies to a recorded serving and health context and can be reused only when the later user&apos;s relevant context matches the approved scope.</p>
      </> },
      { id: 'meal-library-use', title: 'Browsing and use', content: <>
        <p>Browsing a recipe does not add it to your plan. Planning and swaps check your current profile, source availability, serving data, and the selected slot. A goal or calorie mismatch can change eligibility without changing the identity of the dish.</p>
        <p>The browse view is meant for discovery. It can show more verified dishes than the number currently suitable for a plan. To understand why a recipe was scheduled, compare its recorded serving and status with the date, meal type, and your current profile. If your health information changes, a recipe that appeared earlier may need a fresh decision.</p>
      </> },
      { id: 'meal-library-flags', title: 'Flags and approvals', content: <>
        <p>A flagged base meal is withheld together with its serving variants and associated approvals until reviewed. A case approval can also be flagged or become due for recheck without changing the published base recipe.</p>
        <p>These two levels matter when something is questioned. A meal-level flag pauses the underlying dish and every approval built on it. An approval-level flag applies only to the particular serving and health context reviewed. A due or disputed approval is also unavailable for reuse until the required follow-up is recorded.</p>
      </> },
    ],
  },
  {
    id: 'tracking', title: 'Daily tracking', shortTitle: 'Daily tracking',
    group: 'Use KAINARA', icon: Sparkles, tone: 'green', aliases: ['daily-tracking'],
    summary: 'Record what you actually ate or skipped and use progress summaries as a record of your entries.',
    sections: [
      { id: 'tracking-meals', title: 'Meals and daily progress', content: <>
        <p>On the dashboard, mark a scheduled meal eaten or skipped. A scheduled meal alone is not proof that it was eaten. The calorie and macro summaries depend on what has been recorded.</p>
        <p>Plan cards describe what was proposed for a date. When you mark a meal eaten, the app can include that record in progress summaries; when you skip it, the record reflects that choice instead. Logging a different food outside the plan is a separate action. The difference matters because a plan, a completed meal, and an outside meal are not interchangeable evidence of intake.</p>
      </> },
      { id: 'tracking-other', title: 'Water, weight, and changes', content: <>
        <p>Record water and weight separately. Weight and adherence summaries are not diagnoses. If you change a restriction or another planning input, review the current plan again; a saved meal can need revalidation even when its name is unchanged.</p>
        <p>Progress charts summarize the entries available to the system. A missing entry can mean that nothing was recorded, not that no food or water was consumed. Weight changes can have many causes, so use these charts as a personal record rather than as a medical interpretation.</p>
        <p>If you update an allergy, condition, or food restriction, check meals already scheduled for future dates. KAINARA may pause or recheck their use because the earlier decision was made for the previous profile.</p>
      </> },
    ],
  },
  {
    id: 'outside-meals', title: 'Outside meals', shortTitle: 'Outside meals',
    group: 'Use KAINARA', icon: FileText, tone: 'amber',
    summary: 'Log food eaten outside the plan without treating that log as a verified recipe.',
    sections: [
      { id: 'outside-meals-log', title: 'Recording an outside meal', content: <>
        <p>Enter the dish, ingredients, and portion as accurately as possible. Nutrition may be estimated or incomplete. An allergy or condition warning is not a substitute for checking the real food, packaging, and preparation.</p>
        <p>Use an outside log for a meal you actually ate that was not the scheduled plan item. A useful entry identifies the food, any known ingredients, and the amount consumed. Restaurant recipes, sauces, cooking oils, and shared equipment may not be visible to KAINARA, so an estimate should be read as approximate.</p>
        <p>If a warning appears, check the food directly and follow the advice of your own healthcare professional for serious allergies or medical restrictions. An absent warning does not prove that an unlisted ingredient or cross-contact is absent.</p>
      </> },
      { id: 'outside-meals-library', title: 'Proposing a reusable recipe', content: <>
        <p>An outside log records your consumption. With separate consent, a reusable recipe proposal may enter meal verification. Neither the log nor the proposal automatically becomes a verified base recipe or a health-context case approval.</p>
        <p>This separation lets you track a meal without publishing it to other users. If you separately propose it for the catalogue, a nutritionist first checks the submitted dish as a general recipe. Only after that meal verification can it join the verified base library, and its ingredient, portion, and nutrition evidence still determine whether planning can use it.</p>
      </> },
    ],
  },
  {
    id: 'meal-swaps', title: 'Meal swaps', shortTitle: 'Meal swaps',
    group: 'Use KAINARA', icon: Repeat2, tone: 'cyan',
    summary: 'Preview a replacement for a scheduled slot and confirm it only when it fits your current context.',
    sections: [
      { id: 'meal-swaps-preview', title: 'Preview and confirm', content: <>
        <p>KAINARA checks current profile restrictions and the destination slot, and warns when the calorie difference is substantial. A confirmed swap changes that plan slot and refreshes its grocery data; it does not approve the replacement for every other user.</p>
        <p>Open the replacement choices from a scheduled meal and inspect the candidate before confirming. The comparison concerns the meal in that particular breakfast, lunch, or dinner position. A recipe that is eligible elsewhere may still be a poor fit for the current slot&apos;s target or recorded restrictions.</p>
        <p>After confirmation, use the updated plan and grocery list rather than an earlier export. The swap affects your own saved cycle; it does not change the published base recipe or extend a case approval to a different health profile.</p>
      </> },
      { id: 'meal-swaps-limits', title: 'Availability', content: <>
        <p>Choices may be limited by serving evidence, flags, review state, and your profile. If a meal has been logged or shopping has begun, whole-plan replacement may be unavailable; inspect the controls shown for that cycle.</p>
        <p>A small swap list is often a sign that few recorded servings pass all checks at once. Browsable recipes without planning-ready evidence are not automatically offered as replacements. If a base meal or its particular case approval has been flagged, the affected option is held back until the review is resolved.</p>
      </> },
    ],
  },
  {
    id: 'groceries', title: 'Grocery lists', shortTitle: 'Grocery lists',
    group: 'Use KAINARA', icon: ShoppingCart, tone: 'accent',
    summary: 'The grocery page groups ingredients from your saved meals and helps track purchases.',
    sections: [
      { id: 'groceries-list', title: 'Using the list', content: <>
        <p>Check the linked recipes and actual household portions before shopping. Quantities, units, and availability can be incomplete. A changed meal or plan can make an older grocery list stale.</p>
        <p>The grocery list combines ingredients from meals saved in the current plan and groups them to make shopping easier. Marking an item purchased is a checklist action; it does not verify the amount bought or the safety of a particular product. Check package labels, substitutions, and household serving sizes yourself.</p>
        <p>When a meal is swapped, paused, or regenerated, review the list again. An earlier screen capture or printout may still contain ingredients from the old plan, while a newly generated list reflects the recorded meals at its creation time.</p>
      </> },
      { id: 'groceries-export', title: 'PDF export', content: <>
        <p>Where offered, the PDF reflects the recorded list at that point in time. It is a shopping aid, not a guarantee that every listed quantity covers a prepared recipe.</p>
        <p>Keep the export alongside the source recipes if you need preparation detail. Ingredient names, household measures, edible weights, and package sizes do not always translate exactly into one another. Use the PDF as a checklist and confirm the quantities needed for the way you intend to cook.</p>
      </> },
    ],
  },
  {
    id: 'professional-review', title: 'Nutritionist and admin review', shortTitle: 'Professional review',
    group: 'Review and evidence', icon: Stethoscope, tone: 'green',
    summary: 'Meal verification, profile review, and case approval answer different questions and keep separate decision records.',
    sections: [
      { id: 'professional-review-types', title: 'Three review types', content: <>
        <p><strong className="text-brand-text">Meal verification</strong> checks a new dish as a base recipe without a patient profile. <strong className="text-brand-text">Profile review</strong> checks declared restrictions and submitted evidence before restricted planning. <strong className="text-brand-text">Case approval</strong> checks a particular meal and serving against a recorded health context. None is a universal safety guarantee.</p>
        <p>For example, an administrator can submit a new recipe for meal verification. That decision establishes whether the dish belongs in the base catalogue. Separately, a user who declares hypertension may need their restriction context confirmed. A proposed serving for that user then receives its own case decision. Passing one stage does not silently grant the other two.</p>
        <p>Published Panlasang Pinoy recipes carry a source-based verification label because they are established dishes. That label does not claim that every imported ingredient quantity or nutrient value has been checked for planning, and it does not create a health-context approval.</p>
      </> },
      { id: 'professional-review-decisions', title: 'Decisions and rechecks', content: <>
        <p>Nutritionists claim review work and record reasons. Higher risk cases may need an independent second decision. Flags, due reviews, disputes, changed recipes, or changed user profiles can block reuse. Administrators verify nutritionist applications and can submit new recipes for meal verification.</p>
        <p>A case decision is tied to the ingredients, serving, and profile evidence inspected at review time. Another user can benefit from a reusable decision only when the relevant context matches its recorded scope and the approval is still active. A second decision, when required, must be made independently rather than counted twice from one reviewer.</p>
        <p>Scheduled rechecks ask whether an older approval still has current support. A flag raises a specific concern; a dispute records conflicting decisions that need resolution. These states keep an approval out of reuse while the follow-up is incomplete. A flag on the base meal has a wider effect and pauses its related variants and approvals.</p>
      </> },
    ],
  },
  {
    id: 'data-sources', title: 'Sources and evidence', shortTitle: 'Sources and evidence',
    group: 'Review and evidence', icon: BrainCircuit, tone: 'cyan',
    summary: 'The methods, Philippine nutrition data, safety guidance, and recipe sources behind KAINARA, with each source’s role and limits stated clearly.',
    sections: [
      { id: 'data-sources-reference', title: 'Published recipes and composition', content: <>
        <p>Panlasang Pinoy supplies source recipes and attributed images or links where available. The DOST-FNRI Philippine Food Composition Tables provide food-level nutrient references. Other configured composition records may supplement a missing match. These sources do not establish laboratory-measured nutrients for every whole recipe or a confirmed edible weight for every ingredient.</p>
        <p>The recipe source describes a dish and its preparation. A food-composition table describes individual food items, often for a defined edible amount. Connecting an ingredient phrase from a recipe to a composition record requires an identity match, and turning household measures into nutrient totals requires usable amounts. A familiar name alone cannot fill a missing weight or resolve a vague ingredient.</p>
        <p>The full source register appears below. You can also inspect the <a href="https://i.fnri.dost.gov.ph/fct/library" className={inlineLink} target="_blank" rel="noopener noreferrer">official PhilFCT resource</a> directly.</p>
      </> },
      { id: 'data-sources-estimates', title: 'AI estimates and labels', content: <>
        <p>Gemini can draft meal candidates and assist with some estimates. Generated values are checked against structured rules and may still need professional review. The app labels source recipes, estimates, and nutritionist decisions differently.</p>
        <p>An AI-produced meal name or nutrient number is a proposal, not measured food data. The system checks available structure and restrictions before saving a candidate, and a restricted case may still wait for a nutritionist. If a needed ingredient, serving, or source detail cannot be established, the application should show that gap rather than treating an estimate as confirmed composition.</p>
      </> },
      ...evidenceRegisterSections,
    ],
  },
  {
    id: 'clinical-guidelines', title: 'Clinical Guidelines', shortTitle: 'Clinical Guidelines',
    group: 'Review and evidence', icon: HeartPulse, tone: 'amber', aliases: ['clinical-safety'],
    summary: 'Accurate declarations and current review evidence are central to restriction-aware planning.',
    sections: [
      { id: 'clinical-guidelines-profile', title: 'Keep the profile accurate', content: <>
        <p>Enter diagnosed conditions, allergies, medications or relevant risk context truthfully and update them when they change. A vague entry may need correction. Some conditions require reviewed documents; a nutritionist may also request evidence for a specific declared area. Do not upload another person&apos;s record, and cover unrelated identifiers before submitting a supporting file.</p>
        <p>The system can only compare meals against the restrictions it has recorded. For example, a broad label may not contain the severity or subtype needed for a useful decision. A nutritionist can ask for clarification or supporting evidence before confirming that the profile is specific enough for planning.</p>
        <p>A document review checks whether the submitted material supplies relevant nutrition context. It is not a medical diagnosis or a guarantee that the file is authentic. If a condition, medication, allergy, or clinical instruction changes later, update the profile rather than relying on an older review.</p>
      </> },
      { id: 'clinical-guidelines-gates', title: 'Review gates', content: <>
        <p>Restricted profiles wait for a current profile decision and a meal-specific case decision. A second independent reviewer can be required. Ingredient conflicts, missing evidence, flags, expired approvals, and changed profiles can block use. Nutritionists assess recorded evidence; they do not diagnose through this app.</p>
        <p>Profile confirmation allows the system to prepare candidates for the declared restrictions. It does not approve all meals bearing a matching condition label. The case review checks a particular ingredient set and serving against the recorded context, and an approval can be reused only within that scope while it remains current.</p>
        <p>These checks are deliberately separate. A verified recipe may still have incomplete nutrition evidence. A suitable serving may still lack a case decision. A previously approved case may be paused after a flag, source change, or scheduled recheck. The status shown with the meal indicates which step is still outstanding.</p>
      </> },
      { id: 'clinical-guidelines-urgent', title: 'Urgent concerns', content: <>
        <p>If you have a severe reaction, symptoms, or an urgent medical concern, seek in-person or emergency care. Do not rely on KAINARA to identify or manage an emergency.</p>
        <p>Meal planning cannot account for every ingredient substitution, preparation mistake, cross-contact event, or change in a person&apos;s health. Follow an existing care plan from your qualified healthcare professional and use local emergency services when urgent help is needed.</p>
      </> },
    ],
  },
  {
    id: 'medical-disclaimers', title: 'Medical Disclaimers', shortTitle: 'Medical Disclaimers',
    group: 'Policies and help', icon: ShieldAlert, tone: 'amber',
    summary: 'KAINARA supports meal planning and education, with limits that matter most for allergies and medical conditions.',
    sections: [
      { id: 'medical-disclaimers-scope', title: 'Scope of the service', content: <>
        <p>KAINARA is not a medical device, clinician, emergency service, diagnosis, prescription, or treatment plan. An AI result, published recipe, nutritionist review, and case approval each have different scopes. None guarantees freedom from allergens, cross-contact, preparation errors, or adverse effects.</p>
        <p>The app helps organize meal choices from the information and evidence recorded in it. A nutritionist&apos;s decision relates to the recipe, serving, and user context presented for that review; it does not certify an independently prepared dish or replace individualized medical care. AI estimates and recipe labels should be read with their stated limits.</p>
      </> },
      { id: 'medical-disclaimers-checks', title: 'Check the actual food', content: <>
        <p>Nutrition data may be estimated, incomplete, or based on a different serving than what you eat. Check ingredients, labels, portions, and preparation, particularly for allergies and conditions. Discuss individual restrictions and medication-related diet changes with your own qualified healthcare professional.</p>
        <p>A named dish can be prepared in many ways. Sauces, oils, garnishes, packaged substitutes, and restaurant practices may change both nutrient amounts and allergen exposure. Compare the plan with the actual ingredients and packaging before eating. Seek qualified advice if your medical instructions conflict with a suggestion in the app.</p>
      </> },
    ],
  },
  {
    id: 'terms-of-service', title: 'Terms of Service', shortTitle: 'Terms of Service',
    group: 'Policies and help', icon: FileText, tone: 'accent',
    summary: 'These terms explain personal use, service limits, your content, and account controls for the current capstone implementation.',
    sections: [
      { id: 'terms-of-service-use', title: 'Use and eligibility', content: <>
        <p>By creating an account and accepting the displayed version, you may use KAINARA for personal meal planning and tracking. Provide accurate account and health information, keep credentials private, and do not submit another person&apos;s medical records or harmful or unlawful content. Access may be restricted or suspended when information is unsafe or an account is misused.</p>
        <p>Your profile is used to select and review meals, so corrections should be made when important facts change. Do not use another person&apos;s account or present another person&apos;s health information as your own. The service may require a new acknowledgment when a material version of these notices is introduced.</p>
      </> },
      { id: 'terms-of-service-limits', title: 'Service limits', content: <>
        <p>Plans, recipes, estimates, source links, and third-party services can be incomplete, unavailable, or changed. A slot may remain unfilled while evidence or generation capacity is unavailable. Review suggestions before eating. You remain responsible for food selection, purchase, storage, and preparation. Professional review applies only to the recorded recipe, serving, and health context.</p>
        <p>Availability of a recipe in the catalogue does not promise that it can fill a given plan slot. Data gaps, a restricted profile, an active flag, or a pending case decision may prevent use. The app may also be unable to produce a complete cycle when no candidate meets the current requirements. Check the status of each meal rather than assuming that a displayed title is an approval.</p>
      </> },
      { id: 'terms-of-service-content', title: 'Your content and changes', content: <>
        <p>You retain rights to information and images you provide while allowing KAINARA to process them for requested features and permitted review workflows. An outside recipe enters the reusable catalogue only through separate consent and verification. The operator may update the service and terms; material consent changes should be presented for acceptance before continued use.</p>
        <p>Information you enter can be used to build a plan, maintain your records, and enable authorized review of a restricted profile or meal case. A private outside-meal log is not automatically a public recipe submission. Where you choose to propose a reusable dish, that proposal follows the separate verification process described in this guide.</p>
      </> },
      { id: 'terms-of-service-account', title: 'Account controls', content: <>
        <p>You can export supported account data and request self-service deletion from Security & privacy after reauthentication. Deletion may leave independent non-patient recipe records and limited audit evidence needed for integrity. These terms do not remove rights granted by applicable Philippine law.</p>
        <p>Use your profile and account settings to correct details that affect planning. If you withdraw a clinical document, decisions that relied on that document may no longer be usable. Exported records reflect the fields supported by the current export feature; consult the Privacy Policy for the kinds of information processed and the limits of these controls.</p>
      </> },
    ],
  },
  {
    id: 'privacy-policy', title: 'Privacy Policy', shortTitle: 'Privacy Policy',
    group: 'Policies and help', icon: Lock, tone: 'green',
    summary: 'What KAINARA records, why it is used, who can access it, and the controls available to you.',
    sections: [
      { id: 'privacy-policy-collected', title: 'Data collected', content: <>
        <p>The app stores registration and login details; profile, goals, conditions, allergies, and preferences; optional clinical documents and review outcomes; plans, logs, grocery and progress records; consent events; and operational audit records. Health data is sensitive personal information under the Philippine <a href="https://officialgazette.gov.ph/2012/08/15/republic-act-no-10173/" className={inlineLink} target="_blank" rel="noopener noreferrer">Data Privacy Act of 2012</a>.</p>
        <p>These records arise as you register, complete onboarding, use the planner, log activity, submit a document, or receive a professional decision. An optional document may contain more information than the app needs; provide only a relevant file and conceal unrelated identifiers where possible. The app also records the version of the notices you accepted.</p>
      </> },
      { id: 'privacy-policy-purpose', title: 'Why it is used', content: <>
        <p>Records support authentication, calculated guidance, meal preparation and tracking, restriction checks, professional review, account controls, and service integrity. Where an AI feature is used, relevant meal parameters or text may be sent to the configured AI provider. Recipe and composition sources may be accessed for links or matching.</p>
        <p>For example, measurements and activity support the energy estimate, while conditions and allergies narrow meal choices and inform a case review. Saved plan and log records let you see the difference between proposed and recorded meals. Review and audit records help explain why a particular profile, recipe, or approval changed status.</p>
        <p>AI-assisted features may need part of a meal request to generate or estimate a candidate. The applicable provider and data handling arrangements should be confirmed by the operator before public deployment; the presence of an AI feature does not itself establish a lawful basis or a completed privacy assessment.</p>
      </> },
      { id: 'privacy-policy-access', title: 'Who can access it', content: <>
        <p>Authorized nutritionists inspect assigned or claimed review information. Original clinical-document access is claim-controlled and logged. Administrators access information needed for their role. Hosting, email, storage, and AI providers may process data necessary to deliver those services under their arrangements. The public recipe catalogue does not list your clinical profile.</p>
        <p>A nutritionist reviewing a profile or meal case needs the relevant recorded context to make that decision. The original document is treated more narrowly than its status or confirmed facts: access requires the appropriate review claim and leaves an access event. Other users browsing a meal cannot see the patient context behind a private case review.</p>
      </> },
      { id: 'privacy-policy-choices', title: 'Storage and choices', content: <>
        <p>Clinical-document bytes are encrypted in storage by the application, and account APIs require authentication. No security measure removes all risk. You may update your profile, withdraw a document, export supported records, or delete your account after reauthentication. A raw clinical file can be downloaded separately while you own it. Backup and audit retention depends on the deployed operator&apos;s schedule; this capstone does not specify a universal deletion period. See the <a href="https://privacy.gov.ph/data-subject-rights/" className={inlineLink} target="_blank" rel="noopener noreferrer">National Privacy Commission&apos;s data-subject rights guide</a>.</p>
        <p>Changing a restriction or withdrawing evidence can pause planning or invalidate an approval tied to the earlier version. Account export and deletion are available through the supported controls, but an exported bundle may not include the bytes of a clinical file; use the separate file download where available. Questions about access, correction, or removal should go to the operator contact published for the deployed service.</p>
      </> },
    ],
  },
  {
    id: 'data-protection-notice', title: 'Data Protection Notice', shortTitle: 'Data Protection Notice',
    group: 'Policies and help', icon: ShieldAlert, tone: 'cyan',
    summary: 'Separate health-data and document consents support the app’s review and planning workflows.',
    sections: [
      { id: 'data-protection-notice-consent', title: 'Consent and documents', content: <>
        <p>Onboarding asks for separate acknowledgments of the clinical disclaimer, health-data processing, and Terms and Privacy notices. A clinical-record upload requires another explicit consent checkbox. Documents are optional during onboarding, but unreviewed required evidence can keep a restricted profile from planning. Withdrawing a document can invalidate decisions that depended on it.</p>
        <p>The upload choice and the planning requirement are different. You may skip the optional upload step, yet a particular declared condition can still require reviewed evidence before its profile is confirmed. A nutritionist can also request clarification or a document after inspecting a vague or higher-risk entry. The app should explain what is outstanding instead of treating a submitted file as automatically sufficient.</p>
        <p>Before uploading, check that the file belongs to you and is relevant to the declared condition. The review can confirm usable nutrition context from the record; it cannot authenticate the document or replace a diagnosis by your own healthcare professional.</p>
      </> },
      { id: 'data-protection-notice-operator', title: 'Before public deployment', content: <>
        <p>The operator should publish verified privacy contact details, a retention schedule, provider disclosures, and any required jurisdiction-specific notices. This capstone interface is not proof of regulatory compliance or independent clinical validation. The <a href="https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/" className={inlineLink} target="_blank" rel="noopener noreferrer">National Privacy Commission rules</a> are the official reference for Philippine data-protection requirements.</p>
        <p>These notices describe the features and limits currently documented in the capstone. They do not substitute for the operator identifying the responsible organization, confirming its actual vendors and hosting arrangements, setting retention practices, and checking the final public terms. The operator should review the published wording whenever deployment details or data flows change.</p>
      </> },
    ],
  },
  {
    id: 'account-settings', title: 'Account controls', shortTitle: 'Account controls',
    group: 'Policies and help', icon: User, tone: 'green',
    summary: 'Keep your details current and use the account tools to inspect, export, or remove supported records.',
    sections: [
      { id: 'account-settings-profile', title: 'Profile and security', content: <>
        <p>Use <Link href="/profile" className={inlineLink}>Profile</Link> to review and update health details, goals, nutrition guidance, clinical documents, and security settings. Changes to conditions or allergies may require a fresh profile review and new meal case decisions.</p>
        <p>Profile updates are part of the safety workflow, not just cosmetic changes. If an allergy or condition changes, a prior case approval may describe the wrong context and be withheld. Check your planning status and future meals after saving a significant change. Nutrition Guidance can also reflect a newer version of your inputs.</p>
      </> },
      { id: 'account-settings-data', title: 'Export and deletion', content: <>
        <p>The <Link href="/export" className={inlineLink}>Export</Link> page provides supported saved records. Self-service account deletion is available after reauthentication. Read the Privacy Policy for the scope and limits of export and deletion.</p>
        <p>Review an export before relying on it as a complete personal archive; some file bytes, such as an original clinical upload, may require a separate download. Deletion removes the account through the supported workflow, while independent recipe catalogue records and limited integrity evidence may have a different lifecycle. The final operator should publish its actual retention details.</p>
      </> },
    ],
  },
  {
    id: 'faqs', title: 'Common questions', shortTitle: 'Common questions',
    group: 'Policies and help', icon: HelpCircle, tone: 'cyan',
    summary: 'Answers to the questions that most often come up when browsing recipes or reading a plan.',
    sections: [
      { id: 'faqs-catalogue', title: 'Why can I browse more recipes than appear in my plan?', content: <>
        <p>Base verification means a real published or reviewed dish. Planning also needs usable serving evidence, a matching meal slot and energy range, and your current restrictions to permit it.</p>
        <p>Browsing is intentionally broader than scheduling. It helps you discover dishes even when the system cannot yet calculate a usable portion for your target or a recipe is unsuitable for your recorded context. A catalogue count therefore should not be read as the number of meals ready to fill every breakfast, lunch, and dinner.</p>
      </> },
      { id: 'faqs-repeat', title: 'Why did a dish repeat?', content: <>
        <p>The planner tries distinct eligible dishes first. It can rotate an eligible recipe when the suitable pool is too small to fill the cycle. The starter and next weekly cycle are separate selections.</p>
        <p>Repetition can be more likely in a narrow meal type or energy range. The planner keeps the eligibility checks in place while trying to fill the cycle, so it may reuse an accepted dish instead of substituting one that lacks data or conflicts with a restriction.</p>
      </> },
      { id: 'faqs-gap', title: 'Why is a day missing a meal?', content: <>
        <p>No candidate passed the current requirements for that slot, or generation is still pending. Check the plan status and available retry action. An empty slot is not an instruction to skip eating.</p>
        <p>A gap can result from limited catalogue coverage, incomplete ingredient or serving data, the target range, active flags, or a pending review. The plan screen should indicate whether work is still queued. If no eligible candidate can be found, the app should leave the slot unfilled rather than present an unsupported meal as ready.</p>
      </> },
      { id: 'faqs-profile', title: 'Why does my health profile need review?', content: <>
        <p>A nutritionist first confirms recorded restrictions, possibly after requesting clearer information or a document. Each restricted meal then needs its own case decision.</p>
        <p>The first decision makes the planning context usable; it does not endorse any particular recipe. This is why the profile queue and case approval queue can both appear in the workflow. If your restriction details change, the system may need to revisit the profile and affected meals.</p>
      </> },
    ],
  },
  {
    id: 'help', title: 'Help', shortTitle: 'Help',
    group: 'Policies and help', icon: HelpCircle, tone: 'accent',
    summary: 'Find the right next step for a plan, account, or medical question.',
    sections: [
      { id: 'help-plan', title: 'Plan and account questions', content: <>
        <p>If a plan day is missing a meal, check its generation status; it is not an instruction to skip eating. Use the Profile and Export pages for supported account controls.</p>
        <p>For a repeated meal, first check whether it belongs to a starter window or the next weekly cycle. For a restricted profile, look for pending profile or case review messages before expecting a candidate to become actionable. If you changed a condition or allergy, review the new planning status and any requests for clarification.</p>
        <p>The account pages let you correct profile details, inspect nutrition guidance, manage clinical documents, and export supported data. A problem with a source recipe or estimate should be evaluated against the actual dish and its listed evidence, not only its title.</p>
      </> },
      { id: 'help-medical', title: 'Medical concerns', content: <>
        <p>For medical questions, contact your own qualified healthcare professional. Operator contact details must be verified before the service is offered publicly.</p>
        <p>Do not use the Docs, an AI response, or a meal status as emergency advice. If you suspect a severe reaction or another urgent problem, seek appropriate local emergency care. For a nonurgent conflict between a meal suggestion and your prescribed diet, follow your clinician&apos;s instructions and update or clarify your recorded restrictions.</p>
      </> },
    ],
  },
];
