import { z } from 'zod';
import type { ChatEntry, AssistantInput } from '@/features/member-assistant/types';
import { ASSISTANT_SESSION_PREFIX } from './assistant-session-reset';
export { ASSISTANT_SESSION_PREFIX, clearAssistantSessions } from './assistant-session-reset';

export const ASSISTANT_SESSION_TTL = 24 * 60 * 60_000;
const internal = z.string().max(200).refine(value => /^\/(?!\/)/u.test(value));
const link = z.object({ label: z.string().max(160), href: internal }).strict();
const reply = z.object({
  text: z.string().max(8000), source: z.enum(['SYSTEM', 'AI']), creditsUsed: z.number().int().min(0).max(1),
  links: z.array(link).max(8).optional(),
  facts: z.array(z.object({ label: z.string().max(120), value: z.string().max(1000) }).strict()).max(24).optional(),
  references: z.array(z.object({ label: z.string().max(400), href: z.url().max(1000).refine(value => value.startsWith('https://')) }).strict()).max(8).optional(),
  meals: z.array(z.object({ id: z.string().max(128), name: z.string().max(300),
    calories: z.number().finite().nonnegative(), proteinG: z.number().finite().nonnegative(), carbsG: z.number().finite().nonnegative(), fatG: z.number().finite().nonnegative(),
    ingredients: z.array(z.string().max(300)).max(100),
  }).strict()).max(5).optional(),
}).strict();
const pending = z.object({ requestKey: z.uuid(), message: z.string().min(1).max(1000), allowAi: z.literal(false),
  action: z.enum(['TODAY', 'GUIDANCE', 'FIND_MEAL', 'VIEW_PLAN', 'CURRENT_MEALS', 'GROCERIES']).optional(),
  context: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(500) }).strict()).max(6),
}).strict();
const schema = z.object({ version: z.literal(1), owner: z.string().min(1).max(200), createdAt: z.number().finite(),
  open: z.boolean(), draft: z.string().max(1000), recoveryKey: z.uuid().nullable(), pending: pending.nullable(),
  messages: z.array(z.object({ id: z.string().max(150), role: z.enum(['user', 'assistant']), text: z.string().max(8000),
    createdAt: z.number().finite().optional(), reply: reply.optional(),
  }).strict()).max(40),
}).strict();
export type AssistantSession = { version: 1; owner: string; createdAt: number; open: boolean; draft: string;
  messages: ChatEntry[]; recoveryKey: string | null; pending: AssistantInput | null };
const key = (owner: string) => `${ASSISTANT_SESSION_PREFIX}${encodeURIComponent(owner)}`;

export function readAssistantSession(owner: string, now = Date.now()): AssistantSession | null {
  try {
    // One authenticated owner per tab. Switching accounts cannot retain the previous owner's private chat.
    for (const item of Object.keys(sessionStorage)) if (item.startsWith(ASSISTANT_SESSION_PREFIX) && item !== key(owner)) sessionStorage.removeItem(item);
    const raw = sessionStorage.getItem(key(owner));
    if (!raw) return null;
    const result = raw.length <= 80_000 ? schema.safeParse(JSON.parse(raw)) : null;
    if (!result?.success || result.data.owner !== owner || result.data.createdAt > now || now - result.data.createdAt >= ASSISTANT_SESSION_TTL) {
      sessionStorage.removeItem(key(owner)); return null;
    }
    return result.data;
  } catch { try { sessionStorage.removeItem(key(owner)); } catch { /* Unavailable storage. */ } return null; }
}

export function saveAssistantSession(value: AssistantSession, now = Date.now()) {
  try {
    if (now - value.createdAt >= ASSISTANT_SESSION_TTL) { sessionStorage.removeItem(key(value.owner)); return; }
    if (!value.messages.length && !value.draft && !value.recoveryKey && !value.pending) { sessionStorage.removeItem(key(value.owner)); return; }
    const bounded = { ...value, messages: value.messages.slice(-40).map(item => ({
      id: item.id, role: item.role, text: item.text, createdAt: item.createdAt, reply: item.reply,
    })), pending: value.pending ? { ...value.pending, allowAi: false as const } : null };
    // Bound both message count and serialized size; never persist credentials, allowance or automatic consent.
    while (JSON.stringify(bounded).length > 80_000 && bounded.messages.length) bounded.messages.shift();
    if (schema.safeParse(bounded).success) sessionStorage.setItem(key(value.owner), JSON.stringify(bounded));
    else sessionStorage.removeItem(key(value.owner));
  } catch { /* Quota/private mode must not prevent chat. */ }
}
