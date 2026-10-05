import Link from 'next/link';
import { FileText, Lock, ShieldAlert, User, HelpCircle } from 'lucide-react';
import type { DocsChapter } from './DocsChapters';

const inlineLink =
  'font-semibold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover';

export const policyChapters: DocsChapter[] = [
  {
    id: 'terms-of-service',
    title: 'Terms of Service',
    shortTitle: 'Terms of Service',
    group: 'Policies and help',
    icon: FileText,
    tone: 'accent',
    summary: 'These terms explain personal use, service limits, your content and account controls.',
    sections: [
      {
        id: 'terms-of-service-use',
        title: 'Use and eligibility',
        content: (
          <>
            <p>
              By creating an account and accepting the displayed version, you may use KAINARA for personal meal planning
              and tracking. Provide accurate account and health information, keep credentials private, and do not submit
              another person&apos;s medical records or harmful or unlawful content. Access may be restricted or
              suspended when information is unsafe or an account is misused.
            </p>
            <p>
              Your profile is used to select and review meals, so corrections should be made when important facts
              change. Do not use another person&apos;s account or present another person&apos;s health information as
              your own. The service may require a new acknowledgment when a material version of these notices is
              introduced.
            </p>
          </>
        ),
      },
      {
        id: 'terms-of-service-limits',
        title: 'Service limits',
        content: (
          <>
            <p>
              Plans, recipes, estimates, source links, and third-party services can be incomplete, unavailable, or
              changed. A slot may remain unfilled while evidence or generation capacity is unavailable. Review
              suggestions before eating. You remain responsible for food selection, purchase, storage, and preparation.
              Professional review applies only to the recorded recipe, serving, and health context.
            </p>
            <p>
              Availability of a recipe in the catalogue does not promise that it can fill a given plan slot. Data gaps,
              a restricted profile, an active flag, or a pending case decision may prevent use. The app may also be
              unable to produce a complete cycle when no candidate meets the current requirements. Check the status of
              each meal rather than assuming that a displayed title is an approval.
            </p>
          </>
        ),
      },
      {
        id: 'terms-of-service-content',
        title: 'Your content and changes',
        content: (
          <>
            <p>
              You retain rights to information and images you provide while allowing KAINARA to process them for
              requested features and permitted review workflows. An outside recipe enters the reusable catalogue only
              through separate consent and verification. The operator may update the service and terms; material consent
              changes should be presented for acceptance before continued use.
            </p>
            <p>
              Information you enter can be used to build a plan, maintain your records, and enable authorized review of
              a restricted profile or meal case. A private outside-meal log is not automatically a public recipe
              submission. Where you choose to propose a reusable dish, that proposal follows the separate verification
              process described in this guide.
            </p>
          </>
        ),
      },
      {
        id: 'terms-of-service-account',
        title: 'Account controls',
        content: (
          <>
            <p>
              You can export supported account data and delete your account from Security & privacy while signed in.
              Deletion requires typed confirmation and your current password if you have one. Deletion may leave
              independent non-patient recipe records and limited audit evidence needed for integrity. These terms do not
              remove rights granted by applicable Philippine law.
            </p>
            <p>
              Use your profile and account settings to correct details that affect planning. If you withdraw a clinical
              document, decisions that relied on that document may no longer be usable. Exported records reflect the
              fields supported by the current export feature; consult the Privacy Policy for the kinds of information
              processed and the limits of these controls.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy Policy',
    group: 'Policies and help',
    icon: Lock,
    tone: 'green',
    summary: 'What KAINARA records, why it is used, who can access it, and the controls available to you.',
    sections: [
      {
        id: 'privacy-policy-collected',
        title: 'Data collected',
        content: (
          <>
            <p>
              The app stores registration and login details; profile, goals, conditions, allergies, and preferences;
              optional clinical documents and review outcomes; plans, logs, grocery and progress records; consent
              events; and operational audit records. Health data is sensitive personal information under the Philippine{' '}
              <a
                href="https://officialgazette.gov.ph/2012/08/15/republic-act-no-10173/"
                className={inlineLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Data Privacy Act of 2012
              </a>
              .
            </p>
            <p>
              These records arise as you register, complete onboarding, use the planner, log activity, submit a
              document, or receive a professional decision. An optional document may contain more information than the
              app needs; provide only a relevant file and conceal unrelated identifiers where possible. The app also
              records the version of the notices you accepted.
            </p>
          </>
        ),
      },
      {
        id: 'privacy-policy-purpose',
        title: 'Why it is used',
        content: (
          <>
            <p>
              Records support authentication, calculated guidance, meal preparation and tracking, restriction checks,
              professional review, account controls, and service integrity. Where an AI feature is used, relevant meal
              parameters or text may be sent to the configured AI provider. Recipe and composition sources may be
              accessed for links or matching.
            </p>
            <p>
              For example, measurements and activity support the energy estimate, while conditions and allergies narrow
              meal choices and inform a case review. Saved plan and log records let you see the difference between
              proposed and recorded meals. Review and audit records help explain why a particular profile, recipe, or
              approval changed status.
            </p>
            <p>
              AI-assisted features may need part of a meal request to generate or estimate a candidate. AI requests use
              the configured provider and relevant request content. Review what you submit and avoid including unrelated
              personal identifiers in meal descriptions.
            </p>
          </>
        ),
      },
      {
        id: 'privacy-policy-access',
        title: 'Who can access it',
        content: (
          <>
            <p>
              Authorized nutritionists inspect assigned or claimed review information. Original clinical-document access
              is claim-controlled and logged. Administrators access information needed for their role. Hosting, email,
              storage, and AI providers may process data necessary to deliver those services under their arrangements.
              The public recipe catalogue does not list your clinical profile.
            </p>
            <p>
              A nutritionist reviewing a profile or meal case needs the relevant recorded context to make that decision.
              The original document is treated more narrowly than its status or confirmed facts: access requires the
              appropriate review claim and leaves an access event. Other members browsing a meal cannot see the patient
              context behind a private case review.
            </p>
          </>
        ),
      },
      {
        id: 'privacy-policy-choices',
        title: 'Storage and choices',
        content: (
          <>
            <p>
              Clinical-document bytes are encrypted in storage by the application, and account APIs require
              authentication. No security measure removes all risk. You may update your profile, withdraw a document,
              export supported records, or delete your account while signed in after confirming the deletion. A raw
              clinical file can be downloaded separately while you own it. Backup and audit retention follows the
              service operator&apos;s retention arrangements; these notices do not specify a universal deletion period.
              See the{' '}
              <a
                href="https://privacy.gov.ph/data-subject-rights/"
                className={inlineLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                National Privacy Commission&apos;s data-subject rights guide
              </a>
              .
            </p>
            <p>
              Changing a restriction or withdrawing evidence can pause planning or invalidate an approval tied to the
              earlier version. Account export and deletion are available through the supported controls, but an exported
              bundle may not include the bytes of a clinical file; use the separate file download where available.
              Questions about access, correction, or removal should go to the operator contact published for the
              deployed service.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'data-protection-notice',
    title: 'Data Protection Notice',
    shortTitle: 'Data Protection Notice',
    group: 'Policies and help',
    icon: ShieldAlert,
    tone: 'cyan',
    summary: 'Separate health-data and document consents support the app’s review and planning workflows.',
    sections: [
      {
        id: 'data-protection-notice-consent',
        title: 'Consent and documents',
        content: (
          <>
            <p>
              Onboarding asks for separate acknowledgments of the clinical disclaimer, health-data processing, and Terms
              and Privacy notices. A clinical-record upload requires another explicit consent checkbox. Documents are
              optional during onboarding, but unreviewed required evidence can keep a restricted profile from planning.
              Withdrawing a document can invalidate decisions that depended on it.
            </p>
            <p>
              The upload choice and the planning requirement are different. You may skip the optional upload step, yet a
              particular declared condition can still require reviewed evidence before its profile is confirmed. A
              nutritionist can also request clarification or a document after inspecting a vague or higher-risk entry.
              The app should explain what is outstanding instead of treating a submitted file as automatically
              sufficient.
            </p>
            <p>
              Before uploading, check that the file belongs to you and is relevant to the declared condition. The review
              can confirm usable nutrition context from the record; it cannot authenticate the document or replace a
              diagnosis by your own healthcare professional.
            </p>
          </>
        ),
      },
      {
        id: 'data-protection-notice-operator',
        title: 'Privacy questions and service changes',
        content: (
          <>
            <p>
              Use the account controls to inspect, export or remove supported records. For questions about data handling
              and retention beyond those controls, consult the service operator’s published privacy contact information.
              The{' '}
              <a
                href="https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/"
                className={inlineLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                National Privacy Commission rules
              </a>{' '}
              are the official reference for Philippine data-protection requirements.
            </p>
            <p>
              These notices describe KAINARA’s account, planning and review workflows. Review updated notices when the
              service’s data handling changes; material consent changes are presented for acceptance where required.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'account-settings',
    title: 'Account controls',
    shortTitle: 'Account controls',
    group: 'Policies and help',
    icon: User,
    tone: 'green',
    summary: 'Keep your details current and use the account tools to inspect, export, or remove supported records.',
    sections: [
      {
        id: 'account-settings-profile',
        title: 'Profile and security',
        content: (
          <>
            <p>
              Use{' '}
              <Link href="/profile" className={inlineLink}>
                Profile
              </Link>{' '}
              to review and update health details, goals, nutrition guidance, clinical documents, and security settings.
              Changes to conditions or allergies may require a fresh profile review and new meal case decisions.
            </p>
            <p>
              Profile updates are part of the safety workflow, not just cosmetic changes. If an allergy or condition
              changes, a prior case approval may describe the wrong context and be withheld. Check your planning status
              and future meals after saving a significant change. Nutrition Guidance can also reflect a newer version of
              your inputs.
            </p>
          </>
        ),
      },
      {
        id: 'account-settings-data',
        title: 'Export and deletion',
        content: (
          <>
            <p>
              The{' '}
              <Link href="/export" className={inlineLink}>
                Export
              </Link>{' '}
              page provides supported saved records. Self-service account deletion requires a signed-in session, typed
              confirmation, and your current password if you have one. Read the Privacy Policy for the scope and limits
              of export and deletion.
            </p>
            <p>
              Review an export before relying on it as a complete personal archive; some file bytes, such as an original
              clinical upload, may require a separate download. Deleting a member account removes its patient-owned
              plans and pending meal case-review records. The approval queue updates on its next refresh. Independent
              shared recipes remain, and another member’s pending case for the same recipe remains available for review.
              Limited integrity evidence may have a different lifecycle. Backup and audit retention can have a separate
              lifecycle from active account records.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'faqs',
    title: 'Common questions',
    shortTitle: 'Common questions',
    group: 'Policies and help',
    icon: HelpCircle,
    tone: 'cyan',
    summary: 'Answers to the questions that most often come up when browsing recipes or reading a plan.',
    sections: [
      {
        id: 'faqs-catalogue',
        title: 'Why can I browse more recipes than appear in my plan?',
        content: (
          <>
            <p>
              Base verification means a real published or reviewed dish. Planning also needs usable serving evidence, a
              matching meal slot and energy range, and your current restrictions to permit it.
            </p>
            <p>
              Browsing is intentionally broader than scheduling. It helps you discover dishes even when the system
              cannot yet calculate a usable portion for your target or a recipe is unsuitable for your recorded context.
              A catalogue count therefore should not be read as the number of meals ready to fill every breakfast,
              lunch, and dinner.
            </p>
          </>
        ),
      },
      {
        id: 'faqs-repeat',
        title: 'Why did a dish repeat?',
        content: (
          <>
            <p>
              The planner tries distinct eligible dishes first. It can rotate an eligible recipe when the suitable pool
              is too small to fill the cycle. The starter and next weekly cycle are separate selections.
            </p>
            <p>
              Repetition can be more likely in a narrow meal type or energy range. The planner keeps the eligibility
              checks in place while trying to fill the cycle, so it may reuse an accepted dish instead of substituting
              one that lacks data or conflicts with a restriction.
            </p>
          </>
        ),
      },
      {
        id: 'faqs-gap',
        title: 'Why is a day missing a meal?',
        content: (
          <>
            <p>
              No candidate passed the current requirements for that slot, or generation is still pending. Check the plan
              status and available retry action. An empty slot is not an instruction to skip eating.
            </p>
            <p>
              A gap can result from limited catalogue coverage, incomplete ingredient or serving data, the target range,
              active flags, or a pending review. The plan screen should indicate whether work is still queued. If no
              eligible candidate can be found, the app should leave the slot unfilled rather than present an unsupported
              meal as ready.
            </p>
          </>
        ),
      },
      {
        id: 'faqs-profile',
        title: 'Why does my health profile need review?',
        content: (
          <>
            <p>
              A nutritionist first confirms recorded restrictions, possibly after requesting clearer information or a
              document. Each restricted meal then needs its own case decision.
            </p>
            <p>
              The first decision makes the planning context usable; it does not endorse any particular recipe. This is
              why the profile queue and case approval queue can both appear in the workflow. If your restriction details
              change, the system may need to revisit the profile and affected meals.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'help',
    title: 'Help',
    shortTitle: 'Help',
    group: 'Policies and help',
    icon: HelpCircle,
    tone: 'accent',
    summary: 'Find the right next step for a plan, account, or medical question.',
    sections: [
      {
        id: 'help-plan',
        title: 'Plan and account questions',
        content: (
          <>
            <p>
              If a plan day is missing a meal, check its generation status; it is not an instruction to skip eating. Use
              the Profile and Export pages for supported account controls.
            </p>
            <p>
              For a repeated meal, first check whether it belongs to a starter window or the next weekly cycle. For a
              restricted profile, look for pending profile or case review messages before expecting a candidate to
              become actionable. If you changed a condition or allergy, review the new planning status and any requests
              for clarification.
            </p>
            <p>
              The account pages let you correct profile details, inspect nutrition guidance, manage clinical documents,
              and export supported data. A problem with a source recipe or estimate should be evaluated against the
              actual dish and its listed evidence, not only its title.
            </p>
          </>
        ),
      },
      {
        id: 'help-google',
        title: 'Google sign-in and app browsers',
        content: (
          <>
            <p>
              Choose Continue with Google on either account page. Your first sign-in creates a regular account and takes
              you to onboarding; returning users sign in to their existing account. Google accounts do not need a
              separate KAINARA password. Profile setup, terms and professional approval still apply where required. If
              an existing email account cannot be linked automatically, sign in using its original method.
            </p>
            <p>
              If no Google window opens, check that pop-ups and redirects are allowed for this website, then try again.
              A “Popup may be blocked” note offers help when the page stays focused; it does not confirm that the
              browser blocked Google. If a Google window is already open, continue there.
            </p>
            <p>
              Google sign-in may not work inside Messenger, Facebook or Instagram. Use that app’s menu to open KAINARA
              in Chrome or Safari, or copy the link into your browser. Email sign-in remains available.
            </p>
          </>
        ),
      },
      {
        id: 'help-install',
        title: 'Install KAINARA on your phone',
        content: (
          <>
            <p>
              A small install card appears in supported phone browsers. Tap Install when offered. Otherwise use your
              browser’s Install app or Add to Home Screen option. On iPhone, open the site in Safari, use Share, then
              Add to Home Screen.
            </p>
            <p>
              Close the card with × or swipe it sideways. It can appear again after a refresh if installation has not
              been detected. It stays hidden inside the installed app. Where the browser cannot check installation,
              Already installed remembers your confirmation on that browser; clearing site storage resets it.
            </p>
            <p>
              Opening website links in the installed app depends on your browser and link-opening preferences.
              Refreshing a browser tab does not guarantee an app launch. An internet connection is required to use your
              account.
            </p>
          </>
        ),
      },
      {
        id: 'help-medical',
        title: 'Medical concerns',
        content: (
          <>
            <p>For medical questions, contact your own qualified healthcare professional.</p>
            <p>
              Do not use the Docs, an AI response, or a meal status as emergency advice. If you suspect a severe
              reaction or another urgent problem, seek appropriate local emergency care. For a nonurgent conflict
              between a meal suggestion and your prescribed diet, follow your clinician&apos;s instructions and update
              or clarify your recorded restrictions.
            </p>
          </>
        ),
      },
    ],
  },
];
