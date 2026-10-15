export type AssistantAllowance = { tier: 'FREE' | 'LIFESTYLE' | 'HEALTH'; cap: number; used: number; remaining: number; resetsAt: string; nextAiRequestAt?: string | null };
export type AssistantAction = 'TODAY' | 'GUIDANCE' | 'FIND_MEAL' | 'VIEW_PLAN';
export type AssistantInput = {
  requestKey: string; message: string; action?: AssistantAction; allowAi: boolean;
  context: Array<{ role: 'user' | 'assistant'; content: string }>;
};
export type AssistantReply = {
  text: string; source: 'SYSTEM' | 'AI'; creditsUsed: number;
  facts?: Array<{ label: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
  references?: Array<{ label: string; href: string }>;
  meals?: Array<{ id: string; name: string; calories: number; proteinG: number; carbsG: number; fatG: number; ingredients: string[] }>;
};
export type ChatEntry = { id: string; role: 'user' | 'assistant'; text: string; createdAt?: number; restored?: boolean; reply?: AssistantReply };
export type AssistantResult = { allowance: AssistantAllowance } & (
  { confirmationRequired: true; cost: number; requestKey: string } | { confirmationRequired: false; reply: AssistantReply }
);
