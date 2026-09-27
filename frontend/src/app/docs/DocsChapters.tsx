import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BookOpen, BrainCircuit, Clock, Compass, FileText, HeartPulse, HelpCircle,
  Lock, Repeat2, ShieldAlert, ShoppingCart, Sparkles, Stethoscope, User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

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
      </> },
      { id: 'what-is-kainara-roles', title: 'Who uses it', content: <>
        <p>Users set a profile, view plans, log food, and manage their data. Registered Nutritionist-Dietitians review clinical profiles, documents, meal cases, and new recipe submissions. Administrators manage accounts, nutritionist applications, and source data.</p>
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
      </> },
      { id: 'getting-started-finish', title: 'Finish onboarding', content: <>
        <p>Choose a grocery shopping day, review your answers, and accept the current notices. Read and acknowledge your <Link href="/profile/nutrition-report" className={inlineLink}>Nutrition Guidance</Link>, which explains calculated targets and restrictions without requiring AI to write the report.</p>
      </> },
      { id: 'getting-started-review', title: 'When a nutritionist reviews your profile', content: <>
        <p>Restricted profiles wait for a nutritionist to confirm the recorded planning context. The nutritionist can request a document or correction. This confirmation is separate from approval of a particular meal. Users with no declared condition, allergy, or restriction can use eligible base recipes without a case review.</p>
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
      </> },
      { id: 'meal-planning-selection', title: 'How meals are selected', content: <>
        <p>The planner tries recorded eligible servings first, then other eligible published recipes. It checks current restrictions, source availability, ingredient and serving data, and the slot&apos;s energy range. A restricted user&apos;s saved candidate may still need one or two independent case decisions before it is actionable.</p>
      </> },
      { id: 'meal-planning-gaps', title: 'Variety and missing slots', content: <>
        <p>KAINARA prefers distinct dishes. When the suitable pool is too small, an eligible recipe can recur on another day. A slot can remain empty when no candidate passes the requirements or generation is pending. A missing slot is not an instruction to skip eating.</p>
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
      </> },
      { id: 'meal-library-use', title: 'Browsing and use', content: <>
        <p>Browsing a recipe does not add it to your plan. Planning and swaps check your current profile, source availability, serving data, and the selected slot. A goal or calorie mismatch can change eligibility without changing the identity of the dish.</p>
      </> },
      { id: 'meal-library-flags', title: 'Flags and approvals', content: <>
        <p>A flagged base meal is withheld together with its serving variants and associated approvals until reviewed. A case approval can also be flagged or become due for recheck without changing the published base recipe.</p>
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
      </> },
      { id: 'tracking-other', title: 'Water, weight, and changes', content: <>
        <p>Record water and weight separately. Weight and adherence summaries are not diagnoses. If you change a restriction or another planning input, review the current plan again; a saved meal can need revalidation even when its name is unchanged.</p>
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
      </> },
      { id: 'outside-meals-library', title: 'Proposing a reusable recipe', content: <>
        <p>An outside log records your consumption. With separate consent, a reusable recipe proposal may enter meal verification. Neither the log nor the proposal automatically becomes a verified base recipe or a health-context case approval.</p>
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
      </> },
      { id: 'meal-swaps-limits', title: 'Availability', content: <>
        <p>Choices may be limited by serving evidence, flags, review state, and your profile. If a meal has been logged or shopping has begun, whole-plan replacement may be unavailable; inspect the controls shown for that cycle.</p>
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
      </> },
      { id: 'groceries-export', title: 'PDF export', content: <>
        <p>Where offered, the PDF reflects the recorded list at that point in time. It is a shopping aid, not a guarantee that every listed quantity covers a prepared recipe.</p>
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
      </> },
      { id: 'professional-review-decisions', title: 'Decisions and rechecks', content: <>
        <p>Nutritionists claim review work and record reasons. Higher risk cases may need an independent second decision. Flags, due reviews, disputes, changed recipes, or changed user profiles can block reuse. Administrators verify nutritionist applications and can submit new recipes for meal verification.</p>
      </> },
    ],
  },
  {
    id: 'data-sources', title: 'Nutrition and recipe data', shortTitle: 'Nutrition and recipe data',
    group: 'Review and evidence', icon: BrainCircuit, tone: 'cyan',
    summary: 'Recipe provenance, food-level composition references, AI estimates, and reviewer decisions have different evidence scopes.',
    sections: [
      { id: 'data-sources-reference', title: 'Published recipes and composition', content: <>
        <p>Panlasang Pinoy supplies source recipes and attributed images or links where available. The DOST-FNRI Philippine Food Composition Tables provide food-level nutrient references. Other configured composition records may supplement a missing match. These sources do not establish laboratory-measured nutrients for every whole recipe or a confirmed edible weight for every ingredient.</p>
        <p>See the <Link href="/sources" className={inlineLink}>source register</Link> and the <a href="https://i.fnri.dost.gov.ph/fct/library" className={inlineLink} target="_blank" rel="noopener noreferrer">official PhilFCT resource</a>.</p>
      </> },
      { id: 'data-sources-estimates', title: 'AI estimates and labels', content: <>
        <p>Gemini can draft meal candidates and assist with some estimates. Generated values are checked against structured rules and may still need professional review. The app labels source recipes, estimates, and nutritionist decisions differently.</p>
      </> },
    ],
  },
  {
    id: 'clinical-guidelines', title: 'Clinical Guidelines', shortTitle: 'Clinical Guidelines',
    group: 'Review and evidence', icon: HeartPulse, tone: 'amber', aliases: ['clinical-safety'],
    summary: 'Accurate declarations and current review evidence are central to restriction-aware planning.',
    sections: [
      { id: 'clinical-guidelines-profile', title: 'Keep the profile accurate', content: <>
        <p>Enter diagnosed conditions, allergies, medications or relevant risk context truthfully and update them when they change. A vague entry may need correction. Some conditions require reviewed documents; a nutritionist may also request evidence for a specific declared area. Do not upload another person&apos;s record, and cover unrelated identifiers before submitting a supporting file.</p>
      </> },
      { id: 'clinical-guidelines-gates', title: 'Review gates', content: <>
        <p>Restricted profiles wait for a current profile decision and a meal-specific case decision. A second independent reviewer can be required. Ingredient conflicts, missing evidence, flags, expired approvals, and changed profiles can block use. Nutritionists assess recorded evidence; they do not diagnose through this app.</p>
      </> },
      { id: 'clinical-guidelines-urgent', title: 'Urgent concerns', content: <>
        <p>If you have a severe reaction, symptoms, or an urgent medical concern, seek in-person or emergency care. Do not rely on KAINARA to identify or manage an emergency.</p>
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
      </> },
      { id: 'medical-disclaimers-checks', title: 'Check the actual food', content: <>
        <p>Nutrition data may be estimated, incomplete, or based on a different serving than what you eat. Check ingredients, labels, portions, and preparation, particularly for allergies and conditions. Discuss individual restrictions and medication-related diet changes with your own qualified healthcare professional.</p>
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
      </> },
      { id: 'terms-of-service-limits', title: 'Service limits', content: <>
        <p>Plans, recipes, estimates, source links, and third-party services can be incomplete, unavailable, or changed. A slot may remain unfilled while evidence or generation capacity is unavailable. Review suggestions before eating. You remain responsible for food selection, purchase, storage, and preparation. Professional review applies only to the recorded recipe, serving, and health context.</p>
      </> },
      { id: 'terms-of-service-content', title: 'Your content and changes', content: <>
        <p>You retain rights to information and images you provide while allowing KAINARA to process them for requested features and permitted review workflows. An outside recipe enters the reusable catalogue only through separate consent and verification. The operator may update the service and terms; material consent changes should be presented for acceptance before continued use.</p>
      </> },
      { id: 'terms-of-service-account', title: 'Account controls', content: <>
        <p>You can export supported account data and request self-service deletion from Security & privacy after reauthentication. Deletion may leave independent non-patient recipe records and limited audit evidence needed for integrity. These terms do not remove rights granted by applicable Philippine law.</p>
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
      </> },
      { id: 'privacy-policy-purpose', title: 'Why it is used', content: <>
        <p>Records support authentication, calculated guidance, meal preparation and tracking, restriction checks, professional review, account controls, and service integrity. Where an AI feature is used, relevant meal parameters or text may be sent to the configured AI provider. Recipe and composition sources may be accessed for links or matching.</p>
      </> },
      { id: 'privacy-policy-access', title: 'Who can access it', content: <>
        <p>Authorized nutritionists inspect assigned or claimed review information. Original clinical-document access is claim-controlled and logged. Administrators access information needed for their role. Hosting, email, storage, and AI providers may process data necessary to deliver those services under their arrangements. The public recipe catalogue does not list your clinical profile.</p>
      </> },
      { id: 'privacy-policy-choices', title: 'Storage and choices', content: <>
        <p>Clinical-document bytes are encrypted in storage by the application, and account APIs require authentication. No security measure removes all risk. You may update your profile, withdraw a document, export supported records, or delete your account after reauthentication. A raw clinical file can be downloaded separately while you own it. Backup and audit retention depends on the deployed operator&apos;s schedule; this capstone does not specify a universal deletion period. See the <a href="https://privacy.gov.ph/data-subject-rights/" className={inlineLink} target="_blank" rel="noopener noreferrer">National Privacy Commission&apos;s data-subject rights guide</a>.</p>
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
      </> },
      { id: 'data-protection-notice-operator', title: 'Before public deployment', content: <>
        <p>The operator should publish verified privacy contact details, a retention schedule, provider disclosures, and any required jurisdiction-specific notices. This capstone interface is not proof of regulatory compliance or independent clinical validation. The <a href="https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/" className={inlineLink} target="_blank" rel="noopener noreferrer">National Privacy Commission rules</a> are the official reference for Philippine data-protection requirements.</p>
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
      </> },
      { id: 'account-settings-data', title: 'Export and deletion', content: <>
        <p>The <Link href="/export" className={inlineLink}>Export</Link> page provides supported saved records. Self-service account deletion is available after reauthentication. Read the Privacy Policy for the scope and limits of export and deletion.</p>
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
      </> },
      { id: 'faqs-repeat', title: 'Why did a dish repeat?', content: <>
        <p>The planner tries distinct eligible dishes first. It can rotate an eligible recipe when the suitable pool is too small to fill the cycle. The starter and next weekly cycle are separate selections.</p>
      </> },
      { id: 'faqs-gap', title: 'Why is a day missing a meal?', content: <>
        <p>No candidate passed the current requirements for that slot, or generation is still pending. Check the plan status and available retry action. An empty slot is not an instruction to skip eating.</p>
      </> },
      { id: 'faqs-profile', title: 'Why does my health profile need review?', content: <>
        <p>A nutritionist first confirms recorded restrictions, possibly after requesting clearer information or a document. Each restricted meal then needs its own case decision.</p>
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
      </> },
      { id: 'help-medical', title: 'Medical concerns', content: <>
        <p>For medical questions, contact your own qualified healthcare professional. Operator contact details must be verified before the service is offered publicly.</p>
      </> },
    ],
  },
];
