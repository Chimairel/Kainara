/** Reviewed navigation help, kept with the app code; no provider, embeddings or database writes. */
export type AssistantInformation = { text: string; links: Array<{ label: string; href: string }> };
type HelpTopic = AssistantInformation & { id: string; subject: RegExp; purpose?: RegExp };

const edit = /\b(change|update|edit|correct|record|log|enter|add|save|set|baguhin|palitan|iupdate|ilagay|usbon|iusab)\b/;
const navigate = /\b(how|where|open|view|see|show|find|check|use|access|paano|saan|unsaon|asa|tanawon|tan aw|makita)\b/;
const topics: HelpTopic[] = [
  { id: 'body', subject: /\b(target weight|goal weight|goals?|height|activity level|birthdate|birthday|biological sex)\b/, purpose: edit,
    text: 'You can update your measurements, activity level and target weight in Health & goals, under Body & goals. Review your entries and save them there. I have not changed your profile.',
    links: [{ label: 'Health & goals', href: '/profile/health' }] },
  { id: 'weight', subject: /\b(weight|timbang)\b/, purpose: edit,
    text: 'To record your latest weight, open Progress and select “Log today’s weight”. Enter your weight in kilograms and save it there. Your weight history is also on that page.',
    links: [{ label: 'Progress', href: '/progress' }] },
  { id: 'restrictions', subject: /\b(allerg(?:y|ies|ens?)|conditions?|restrictions?|intolerances?)\b/, purpose: edit,
    text: 'Open Health & goals and select Conditions & allergies to review or update your saved health information. Save your changes on that page; this chat does not change them.',
    links: [{ label: 'Health & goals', href: '/profile/health' }] },
  { id: 'password', subject: /\b(password|security|privacy|delete (?:my )?account)\b/,
    text: 'Open Security & privacy to manage your password and account controls. Complete any changes on that page. Never send your password or verification codes in chat.',
    links: [{ label: 'Security & privacy', href: '/profile/security' }] },
  { id: 'identity', subject: /\b(avatar|profile (?:picture|photo)|name|email|personal details)\b/, purpose: edit,
    text: 'Open Personal details to review your account information. Use the Account section for available identity settings or the Avatar section to change your picture.',
    links: [{ label: 'Personal details', href: '/profile/personal' }] },
  { id: 'planning', subject: /\b(diet(?:ary)?(?: preference)?|rice|shopping (?:day|schedule)|food preferences?|meal reminders?)\b/, purpose: edit,
    text: 'Open Food & planning to review your dietary preferences, rice preferences, shopping schedule and meal reminder settings. Save any changes there.',
    links: [{ label: 'Food & planning', href: '/profile/planning' }] },
  { id: 'outside', subject: /\b(outside (?:food|meals?)|food log|log (?:a |my |an )?(?:food|meals?|snack)|record (?:a |my |an )?meal)\b/,
    text: 'To record food outside your plan, open Meals and select “Log food or snack”. Enter the food and portion, review its nutrition, then confirm in the form. A nutrition estimate may use AI through that existing flow. I have not logged anything from this chat.',
    links: [{ label: 'Meals', href: '/meals' }] },
  { id: 'water', subject: /\b(water|hydration|tubig)\b/, purpose: edit,
    text: 'Open your Dashboard and use the water controls in Your daily intake to record or adjust your water intake for the selected day. I have not added water from this chat.',
    links: [{ label: 'Dashboard', href: '/dashboard' }] },
  { id: 'theme', subject: /\b(dark mode|light mode|theme|appearance)\b/,
    text: 'Use the sun or moon button in the page header to switch between light and dark mode. It stays available above Nara’s desktop chat panel.',
    links: [] },
  { id: 'swap', subject: /\b(swaps?|swapping|replace|replacement)\b.*\b(meals?|food)\b|\b(meals?|food)\b.*\b(swaps?|swapping|replace|replacement)\b/,
    text: 'Open your Meal plan, select a meal and use its swap option when available. Compare the replacement before confirming. Eligibility and your current swap allowance still apply; this chat does not replace meals.',
    links: [{ label: 'Meal plan', href: '/meals' }] },
  { id: 'tracking', subject: /\b(mark.*(?:eaten|done|skipped)|skip (?:a |my )?meal|log (?:a |my )?planned meal)\b/,
    text: 'Open your Meal plan and select the scheduled meal. Use the available eaten or skip action there. Your recorded food contributes to your daily intake; asking me about it does not mark it as eaten.',
    links: [{ label: 'Meal plan', href: '/meals' }] },
  { id: 'history', subject: /\b(meal history|food history|past meals|previous meals|logged meals|history)\b/,
    text: 'Open Meal history to see previously recorded meals and outside-food entries. Select an entry to inspect the information available for it.',
    links: [{ label: 'Meal history', href: '/meals?tab=history' }] },
  { id: 'groceries', subject: /\b(grocer(?:y|ies)|shopping list)\b/,
    text: 'Open Groceries to view your meal-plan shopping list and manage its checklist. The available export controls are on that page.',
    links: [{ label: 'Groceries', href: '/grocery' }] },
  { id: 'library', subject: /\b(meal library|recipe library|browse meals|browse recipes)\b/,
    text: 'Open the Meal library to browse recipes and use the search and filters. Viewing a recipe does not add it to your plan or approve it for your profile.',
    links: [{ label: 'Meal library', href: '/meals?tab=library' }] },
  { id: 'guidance', subject: /\b(nutrition (?:guidance|report)|saved guidance)\b/,
    text: 'Open Nutrition guidance to read your saved planning estimates, nutrient references and their sources. Use the report page to review its current status.',
    links: [{ label: 'Nutrition guidance', href: '/profile/nutrition-report' }] },
  { id: 'membership', subject: /\b(membership|subscription|upgrade|lifestyle|health plan|free plan)\b/,
    text: 'Open Membership to compare the available plans and see your current access. The page shows the current benefits and available membership actions.',
    links: [{ label: 'Membership', href: '/membership' }] },
  { id: 'export', subject: /\b(export|download)\b.*\b(data|records|nutrition|summary|pdf)\b/,
    text: 'Open Export to see the data and nutrition-summary downloads available for your account.',
    links: [{ label: 'Export', href: '/export' }] },
  { id: 'notifications', subject: /\b(notifications?|bell|alerts?)\b/,
    text: 'Select the notification bell in the page header to read your updates. For meal reminder settings, open Food & planning.',
    links: [{ label: 'Food & planning', href: '/profile/planning' }] },
  { id: 'plan', subject: /\b(meal plan|weekly plan|planned meals|scheduled meals)\b/,
    text: 'Open your Meal plan to view scheduled meals by date. Select a meal to inspect its details and the actions currently available for it.',
    links: [{ label: 'Meal plan', href: '/meals' }] },
];

const corrections: Record<string, string> = { wieght: 'weight', weigth: 'weight', grocceries: 'groceries', nutriton: 'nutrition', memebership: 'membership', passowrd: 'password' };
export function normalizeAssistantQuestion(message: string) {
  return message.normalize('NFKC').toLowerCase().replace(/[’']/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .split(/\s+/u).map(word => corrections[word] ?? word).join(' ');
}

/** Shared by the server fallback and the generated browser guide. */
export function assistantDirectAction(message: string): 'GREETING' | 'TODAY' | 'GUIDANCE' | 'VIEW_PLAN' | 'CREDITS' | null {
  const text = normalizeAssistantQuestion(message);
  if (/^(hi|hello|hey|thanks|thank you|salamat|maayong (adlaw|buntag)|good (morning|afternoon|evening))$/u.test(text)) return 'GREETING';
  if (['help', 'what can you do'].includes(text)) return 'GREETING';
  if (['credits', 'my credits', 'ai credits'].includes(text) || /\bcredits?\b/.test(text) && /\b(how|what|when|balance|remaining|reset|used|renew|weekly)\b/.test(text)) return 'CREDITS';
  if (['todays nutrition', 'daily summary', 'nutrition today'].includes(text)) return 'TODAY';
  if (['view my plan', 'view meal plan', 'my meal plan'].includes(text)) return 'VIEW_PLAN';
  if (['my guidance', 'show my guidance', 'explain my guidance'].includes(text)) return 'GUIDANCE';
  return null;
}

/** No member facts or balance are inferred here. Dynamic shortcuts return null. */
export function assistantStaticReply(message: string, action?: string): AssistantInformation | null {
  const direct = action ?? assistantDirectAction(message);
  if (direct === 'TODAY' || direct === 'GUIDANCE') return null;
  if (direct === 'CREDITS') return {
    text: 'One successful AI-assisted request uses one credit. I ask before calling AI. App instructions, greetings and free shortcuts do not spend credits. Credits reset on Monday at 12:00 AM in the Philippines; unused credits do not roll over. The balance below is the last checked balance. The server checks your current allowance before any AI request.',
    links: [{ label: 'View membership', href: '/membership' }],
  };
  if (direct === 'VIEW_PLAN') return {
    text: 'Your current and upcoming meals are in your Meal plan.', links: [{ label: 'Meal plan', href: '/meals' }],
  };
  if (direct === 'FIND_MEAL') return {
    text: 'Tell me the meal, ingredients, or numeric limits you want. For example: “Chicken dinner with at least 25 g protein.” I’ll ask before using an AI credit to interpret your request.',
    links: [{ label: 'Browse meals without AI', href: '/meals?tab=library' }],
  };
  if (direct === 'GREETING') return {
    text: 'Hi, I’m Nara. You can ask me how to use KAINARA—for example, “How do I update my weight?” or “Where is my meal history?” App instructions are free. I can also show today’s recorded nutrition, read saved guidance and help find meals. Explore Docs & Help for more instructions.',
    links: [{ label: 'Docs & Help', href: '/docs' }],
  };
  return assistantInformationReply(message);
}

const choices: AssistantInformation = {
  text: 'Which part of KAINARA do you mean? I can explain weight tracking in Progress, your Meal plan, Membership, profile settings or other app features. You can also browse Docs & Help. These instructions are free.',
  links: [{ label: 'Progress', href: '/progress' }, { label: 'Meal plan', href: '/meals' },
    { label: 'Membership', href: '/membership' }, { label: 'Docs & Help', href: '/docs' }],
};

/** Only explicit supported food-search/explanation requests proceed to AI consent. */
function needsAi(text: string) {
  const food = /\b(meals?|recipes?|food|ingredients?|breakfast|lunch|dinner|snack|chicken|pork|beef|fish|shrimp|tofu|rice|vegetarian|vegan|protein|carbs?|fat|ulam|pagkain|manok|baboy)\b/.test(text);
  if (/\b(find|search|suggest|recommend|looking for|look for|pangita|hanap|maghanap)\b/.test(text) && food) return true;
  if (/\b(protein|carbs?|carbohydrates?|calories|kcal|fat)\b/.test(text) && /\d/.test(text)) return true;
  if (/\b(breakfast|lunch|dinner|chicken|pork|beef|fish|ulam|manok|baboy)\b/.test(text)) return true;
  return /\b(explain|understand|interpret|meaning)\b/.test(text) && /\b(my|mine|saved)\b/.test(text) && /\b(guidance|report|nutrition)\b/.test(text);
}

export function assistantInformationReply(message: string): AssistantInformation | null {
  const text = normalizeAssistantQuestion(message);
  if (/\b(?:about|purpose|features)\b|^(?:what is|whats|what does|what can|tell me about|explain|unsa|ano)\b|^how does .+ work\b/.test(text)
    && /\b(?:system|app|kainara|nara)\b/.test(text)
    && /\b(?:about|purpose|do|does|is|works?|use|features|unsa|ano)\b/.test(text)) return {
    text: 'KAINARA helps you plan meals, record food and water, track progress, manage groceries and read saved nutrition guidance. RNDs review meals and provide feedback through the system. I’m Nara: I can explain these features, link you to their pages and show supported saved information. App help is free; I ask before using AI for supported requests. Start with your Meal plan or explore Docs & Help.',
    links: [{ label: 'Meal plan', href: '/meals' }, { label: 'Docs & Help', href: '/docs' }],
  };
  if (/\b(plan)\b/.test(text) && edit.test(text) && !/\b(meal|weekly|membership|subscription|health|lifestyle|free)\b/.test(text)) return {
    text: 'Do you mean your Meal plan or your Membership? Choose the page you want to change. I have not changed either.',
    links: [{ label: 'Meal plan', href: '/meals' }, { label: 'Membership', href: '/membership' }],
  };
  const matches = topics.filter(topic => topic.subject.test(text)
    && (topic.purpose ? topic.purpose.test(text) || /\b(where|saan|asa)\b/.test(text) : navigate.test(text) || edit.test(text) || text.split(' ').length <= 3));
  if (matches.length > 1 && !(matches.length === 2 && matches[0].id === 'body' && matches[1].id === 'weight')) return choices;
  if (matches.length) return { text: matches[0].text, links: matches[0].links };
  if (/\bprofile\b/.test(text) && (edit.test(text) || navigate.test(text))) return {
    text: 'Open your Profile to choose Personal details, Health & goals, Food & planning, Nutrition guidance or Security & privacy. Select the section you want to review; this chat does not edit it.',
    links: [{ label: 'Profile', href: '/profile' }],
  };
  // An uncertain app question gets free clarification, never a speculative provider call.
  if (/\b(system|app|kainara|nara|settings?|profile|account|credits?)\b/.test(text)) return choices;
  return needsAi(text) ? null : choices;
}
