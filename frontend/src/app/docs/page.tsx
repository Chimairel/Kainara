import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import PublicHeader from '@/components/shared/PublicHeader';

export const metadata: Metadata = {
  title: 'How KAINARA works · Guidelines, Terms & Privacy',
  description: 'KAINARA product guide, clinical limitations, terms of service, and privacy policy.',
};

const sections = [
  ['what-is-kainara', 'What KAINARA is'],
  ['getting-started', 'Getting started'],
  ['meal-planning', 'Plans and shopping cycles'],
  ['meal-library', 'Meal Library'],
  ['tracking', 'Daily tracking'],
  ['outside-meals', 'Outside meals'],
  ['meal-swaps', 'Meal swaps'],
  ['groceries', 'Grocery lists'],
  ['professional-review', 'Nutritionist and admin review'],
  ['data-sources', 'Nutrition and recipe data'],
  ['clinical-guidelines', 'Clinical Guidelines'],
  ['medical-disclaimers', 'Medical Disclaimers'],
  ['terms-of-service', 'Terms of Service'],
  ['privacy-policy', 'Privacy Policy'],
  ['data-protection-notice', 'Data Protection Notice'],
  ['account-settings', 'Account controls'],
  ['faqs', 'Common questions'],
  ['help', 'Help'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-28 border-t border-brand-border/70 pt-12">
    <h2 className="font-display text-2xl font-black text-brand-text sm:text-3xl">{title}</h2>
    <div className="mt-5 space-y-4 text-sm leading-7 text-brand-muted">{children}</div>
  </section>;
}

export default function DocsPage() {
  return <div className="min-h-screen bg-brand-bg text-brand-text">
    <PublicHeader />
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:px-8">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">Product guide and notices</p>
        <h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">Understand KAINARA</h1>
        <p className="mt-4 text-sm leading-7 text-brand-muted">How the app prepares meals, where professional review applies, what its limits are, and how your information is handled. Updated September 27, 2026. The legal notices below describe this capstone implementation and should be reviewed by the operator before public deployment.</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Documentation sections" className="self-start rounded-2xl border border-brand-border bg-brand-surface p-3 lg:sticky lg:top-24">
          {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-2 text-xs font-semibold text-brand-muted hover:bg-brand-bgAlt hover:text-brand-green">{label}</a>)}
        </nav>
        <article className="min-w-0 space-y-12">
          <Section id="what-is-kainara" title="What KAINARA is">
            <p>KAINARA is a Filipino-focused meal planning and nutrition tracking app. It combines a local recipe catalogue, food-composition references, calculated energy targets, optional Gemini-assisted drafting, and nutritionist review for cases that need it. It offers educational guidance and planning tools, not diagnosis or treatment.</p>
            <p>There are three roles. Users set a profile, view plans, log food, and manage their data. Registered Nutritionist-Dietitians review clinical profiles, documents, meal cases, and new recipe submissions. Administrators manage accounts, nutritionist applications, and source data.</p>
          </Section>

          <Section id="getting-started" title="Getting started">
            <ol className="list-decimal space-y-2 pl-5"><li>Register, verify your email, and enter body measurements, activity, goal, and food preferences.</li><li>Declare conditions, allergies, and food restrictions accurately. Supporting clinical documents are optional to upload during onboarding, though some cases require reviewed evidence before planning.</li><li>Select a grocery shopping day, review the summary, and accept the current consent notices.</li><li>Read and acknowledge your <Link href="/profile/nutrition-report" className="text-brand-green underline">Nutrition Guidance</Link>. It explains calculated targets and restrictions without requiring AI to write the report.</li></ol>
            <p>Restricted profiles wait for a nutritionist to confirm the recorded planning context. The nutritionist can request a document or correction. This confirmation is separate from approval of a particular meal. A user with no declared condition, allergy, or restriction can use eligible base recipes without a case review.</p>
          </Section>

          <Section id="meal-planning" title="Plans and shopping cycles">
            <p>The app estimates a daily energy target from the profile and allocates it across breakfast, lunch, and dinner. The shopping day anchors a seven-day cycle; a short starter plan can bridge the days before the next cycle. The date shown on each slot is the day that meal is scheduled, not the day it was generated.</p>
            <p>The planner tries recorded, eligible servings first, then other eligible published recipes. When a suitable slot cannot be filled, it stays empty or awaits a separate generation attempt. AI capacity, incomplete ingredients, a calorie range, and review gates can all leave a gap. A saved candidate is not automatically actionable for a restricted user: the meal case may still need one or two independent nutritionist decisions.</p>
            <p>The app prefers variety. When the eligible catalogue is too small for an entire week, the same verified recipe may recur on different days. A repeated recipe is a visible limitation of current catalogue coverage, not a new clinical approval.</p>
          </Section>

          <Section id="meal-library" title="Meal Library">
            <p>The Library has three distinct kinds of entries. <strong className="text-brand-text">Verified base recipes</strong> are published Panlasang Pinoy recipes or other recipes whose identity was checked. That label says the dish is a real recipe; it does not certify its nutrition or suitability for every user. <strong className="text-brand-text">Reusable recipes</strong> have the recorded serving and safety evidence needed by the relevant query. <strong className="text-brand-text">Meals in your plan</strong> are your scheduled portions and may appear even if separate reusable certification is still pending.</p>
            <p>Browsing a recipe does not add it to your plan. Planning and swaps check current restrictions, source availability, serving data, and the selected slot. A goal or calorie mismatch can change planning eligibility without making the underlying dish medically unsafe. A flagged base recipe is withheld together with its serving variants and approvals until reviewed.</p>
          </Section>

          <Section id="tracking" title="Daily tracking">
            <span id="daily-tracking" className="block scroll-mt-28" />
            <p>On the dashboard, mark a scheduled meal eaten or skipped. Record water and weight separately. Logs describe what you recorded; a scheduled meal alone is not proof that it was eaten. Weight and adherence summaries depend on the entries available and are not diagnoses.</p>
            <p>If you change a restriction or other planning input, review the current plan again. A saved meal can need revalidation even when its recipe name is unchanged.</p>
          </Section>

          <Section id="outside-meals" title="Outside meals">
            <p>You can log food eaten outside your plan. Enter the dish, ingredients, and portion as accurately as possible. Nutrition may be estimated or incomplete, and an allergy or condition warning is not a substitute for checking the real food and packaging.</p>
            <p>An outside log records your consumption. With separate consent, a reusable recipe proposal may enter meal verification. Neither the log nor the proposal automatically becomes a verified base recipe or a case approval.</p>
          </Section>

          <Section id="meal-swaps" title="Meal swaps">
            <p>Preview an eligible replacement for a scheduled meal before confirming a swap. The app checks current profile restrictions and the destination slot, and warns when the calorie difference is substantial. A swap changes that plan slot and updates its grocery data; it does not approve the replacement for every other user.</p>
            <p>Available choices may be limited by serving evidence, active flags, review state, and your profile. If a meal has already been logged or shopping has begun, whole-plan replacement may be unavailable; inspect the controls shown for that cycle.</p>
          </Section>

          <Section id="groceries" title="Grocery lists">
            <p>The grocery page groups ingredients from the saved plan and lets you track what you have purchased. Quantities, units, and food availability can be incomplete, so check the linked recipes and actual household portions before shopping. A changed meal or plan can make an older list stale.</p>
            <p>Where offered, the PDF export reflects the recorded list at that point in time. It is a shopping aid, not a guarantee that every listed quantity covers a prepared recipe.</p>
          </Section>

          <Section id="professional-review" title="Nutritionist and admin review">
            <p><strong className="text-brand-text">Meal verification</strong> checks a new dish as a base recipe without a patient profile. <strong className="text-brand-text">Profile review</strong> checks declared restrictions and any submitted documents before restricted planning. <strong className="text-brand-text">Case approval</strong> checks a particular meal and serving against a recorded health context. These decisions are separate and none should be read as a universal safety guarantee.</p>
            <p>Nutritionists claim review work, record reasons, and may need an independent second decision for a higher risk case. A flag pauses the affected meal or approval; due reviews and disputes can also block reuse. Administrators verify nutritionist applications and may submit complete new recipes for meal verification. A changed recipe or user safety profile can invalidate an earlier decision.</p>
          </Section>

          <Section id="data-sources" title="Nutrition and recipe data">
            <p>Panlasang Pinoy supplies source recipes and attributed images or links where available. The DOST-FNRI Philippine Food Composition Tables provide food-level nutrient references. Where configured, other composition records may supplement a missing match. These sources do not establish that every whole recipe has laboratory-measured calories or that every ingredient has a confirmed edible weight.</p>
            <p>Gemini can draft meal candidates and assist with some estimates. Generated values are checked against structured rules and may still need professional review. Estimates, source recipes, and nutritionist decisions are labeled differently in the app. See the <Link href="/sources" className="text-brand-green underline">source register</Link> and the <a href="https://i.fnri.dost.gov.ph/fct/library" className="text-brand-green underline" target="_blank" rel="noopener noreferrer">official PhilFCT resource</a>.</p>
          </Section>

          <Section id="clinical-guidelines" title="Clinical Guidelines">
            <span id="clinical-safety" className="block scroll-mt-28" />
            <p>Enter diagnosed conditions, allergies, medications or relevant risk context truthfully, and update them when they change. A vague entry may need correction. Some conditions require reviewed documents; a nutritionist may also request a document for a specific declared area. Do not upload another person’s record. Cover unrelated identifiers before submitting a supporting file.</p>
            <p>For restricted profiles, the system waits for a current profile decision and a meal-specific case decision before making that meal actionable. A second independent reviewer can be required. Ingredient conflicts, missing evidence, flags, expired approvals, or changed profiles can block use. Nutritionists assess the recorded evidence; they do not diagnose a condition through this app.</p>
            <p>If you have a severe reaction, symptoms, or an urgent medical concern, seek in-person or emergency care. Do not rely on KAINARA to identify or manage an emergency.</p>
          </Section>

          <Section id="medical-disclaimers" title="Medical Disclaimers">
            <p>KAINARA provides educational nutrition guidance and planning support. It is not a medical device, clinician, emergency service, diagnosis, prescription, or treatment plan. An AI result, a published recipe, a nutritionist review, and a case approval each have different scopes. None guarantees that a meal will be free of allergens, cross-contact, preparation errors, or adverse effects.</p>
            <p>Nutrition data can be estimated, incomplete, or based on a different serving than the food you actually eat. Check ingredients, labels, portions, and preparation methods, particularly for allergies and conditions. Discuss individual restrictions and medication-related diet changes with your own qualified healthcare professional.</p>
          </Section>

          <Section id="terms-of-service" title="Terms of Service">
            <p><strong className="text-brand-text">Use and eligibility.</strong> By creating an account and accepting the displayed version, you may use KAINARA for personal meal planning and tracking. Provide accurate account and health information, keep credentials private, and do not submit another person’s medical records or harmful or unlawful content. The app may restrict or suspend access when information is unsafe or an account is misused.</p>
            <p><strong className="text-brand-text">Service limits.</strong> Plans, recipes, estimates, source links, and third-party services can be incomplete, unavailable, or changed. A slot may remain unfilled while evidence or AI capacity is unavailable. Review each suggestion before eating; you remain responsible for food selection, purchase, storage, and preparation. Professional review in the app is limited to the recorded recipe, serving, and health context.</p>
            <p><strong className="text-brand-text">Your content and changes.</strong> You retain rights to information and images you provide, while allowing KAINARA to process them to operate the requested features and permitted review workflows. An outside recipe enters the reusable catalogue only through its separate consent and verification path. The operator may update the service and these terms; material consent changes should be presented for acceptance before continued use.</p>
            <p><strong className="text-brand-text">Account controls.</strong> You can export account data and request self-service deletion from Security & privacy after reauthentication. Deletion may leave independently stored, non-patient recipe records and limited audit evidence where required for integrity. These terms do not remove rights granted by applicable Philippine law.</p>
          </Section>

          <Section id="privacy-policy" title="Privacy Policy">
            <p><strong className="text-brand-text">Data collected.</strong> The app stores registration and login details; profile, goals, conditions, allergies, and preferences; optional clinical documents and review outcomes; meal plans, logs, grocery and progress records; consent events; and operational audit records. Health data is sensitive personal information under the Philippine <a href="https://officialgazette.gov.ph/2012/08/15/republic-act-no-10173/" target="_blank" rel="noopener noreferrer" className="text-brand-green underline">Data Privacy Act of 2012</a>.</p>
            <p><strong className="text-brand-text">Why it is used.</strong> The app uses these records to authenticate you, calculate guidance, prepare and track meals, check declared restrictions, enable professional review, support account controls, and investigate service integrity. Where an AI feature is used, the relevant meal parameters or text may be sent to the configured AI provider. Recipe and composition sources may be accessed for links or data matching.</p>
            <p><strong className="text-brand-text">Who can access it.</strong> Authorized nutritionists can inspect assigned or claimed review information; access to original clinical-document files is claim-controlled and logged. Administrators access operational and account-management information needed for their role. Hosting, email, storage, and AI providers may process data needed to deliver those services under their arrangements. The app does not publicly list your clinical profile in the recipe catalogue.</p>
            <p><strong className="text-brand-text">Storage and choices.</strong> Document bytes are encrypted in storage by the application, and the account uses authenticated API access. No security measure eliminates all risk. You may update your profile, withdraw a document, export the account data represented in the export feature, or delete your account after reauthentication. A raw clinical file can be downloaded separately while you own it. Retention of backups and audit evidence depends on the deployed operator’s schedule; this capstone does not specify a universal deletion period. Consult the <a href="https://privacy.gov.ph/data-subject-rights/" target="_blank" rel="noopener noreferrer" className="text-brand-green underline">National Privacy Commission’s data-subject rights guide</a>.</p>
          </Section>

          <Section id="data-protection-notice" title="Data Protection Notice">
            <p>Onboarding asks for separate acknowledgments of the clinical disclaimer, health-data processing, and Terms and Privacy notices. Uploading a clinical record requires an additional explicit consent checkbox. Documents are optional to submit at onboarding, although an unreviewed required document can keep a restricted profile from planning. Withdrawing a document can invalidate meal decisions that depended on it.</p>
            <p>Before public deployment, the operator should publish verified privacy contact details, a retention schedule, provider/subprocessor disclosures, and any required jurisdiction-specific notices. The current capstone interface should not be interpreted as proof of regulatory compliance or independent clinical validation. The <a href="https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/" target="_blank" rel="noopener noreferrer" className="text-brand-green underline">National Privacy Commission rules</a> are the official reference for Philippine data-protection requirements.</p>
          </Section>

          <Section id="account-settings" title="Account controls">
            <p>Use <Link href="/profile" className="text-brand-green underline">Profile</Link> to review and update health details, goals, nutrition guidance, clinical documents, and security settings. Changes to conditions or allergies may require a fresh profile review and new meal case decisions.</p>
            <p>The <Link href="/export" className="text-brand-green underline">Export</Link> page provides supported saved records. Self-service account deletion is available after reauthentication. Check the Privacy Policy for the scope and limits of export and deletion.</p>
          </Section>

          <Section id="faqs" title="Common questions">
            <dl className="space-y-5">
              <div><dt className="font-bold text-brand-text">Why can I browse more recipes than appear in my plan?</dt><dd>Base verification means a real published or reviewed dish. Planning also needs usable serving evidence, a matching meal slot and energy range, and your current restrictions to permit it.</dd></div>
              <div><dt className="font-bold text-brand-text">Why did a dish repeat?</dt><dd>The planner tries distinct eligible dishes first. It can rotate an eligible recipe when the suitable pool is too small to fill the whole cycle. A starter and the next weekly cycle are separate selections.</dd></div>
              <div><dt className="font-bold text-brand-text">Why is a day missing a meal?</dt><dd>No candidate passed the current requirements for that slot, or generation is still pending. Check the plan status and available retry action. An empty slot is not an instruction to skip eating.</dd></div>
              <div><dt className="font-bold text-brand-text">Why does my health profile need review before planning?</dt><dd>A nutritionist first confirms the recorded restrictions, possibly after requesting clearer information or a document. Each restricted meal then needs its own case decision.</dd></div>
            </dl>
          </Section>

          <Section id="help" title="Help">
            <p>If a plan day is missing a meal, check its generation status. A missing slot is not an instruction to skip eating.</p>
            <p>For medical questions, contact your own healthcare professional. Operator contact details must be verified before the service is offered publicly.</p>
          </Section>
        </article>
      </div>
    </main>
  </div>;
}
