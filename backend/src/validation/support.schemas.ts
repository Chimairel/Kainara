import { z } from 'zod';

export const supportRequestSchema = z.object({
  requestKey: z.string().uuid().optional(),
  replyEmail: z.string().trim().email('Enter a valid reply email.').max(254).optional(),
  category: z.enum(['ACCOUNT', 'MEALS', 'GROCERIES', 'NOTIFICATIONS', 'OTHER']),
  message: z.string().trim().min(20, 'Add at least 20 characters so we can understand the problem.')
    .max(4000, 'Keep your message within 4,000 characters.'),
}).strict();
export type SupportRequest = z.infer<typeof supportRequestSchema>;

export const supportReplySchema = z.object({
  requestKey: z.string().uuid(),
  message: z.string().trim().min(1, 'Write a reply before sending.').max(4000),
}).strict();
export const supportListSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();
export const supportIdSchema = z.string().uuid();
