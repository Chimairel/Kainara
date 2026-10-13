import { z } from 'zod';

export const supportRequestSchema = z.object({
  category: z.enum(['ACCOUNT', 'MEALS', 'GROCERIES', 'NOTIFICATIONS', 'OTHER']),
  message: z.string().trim().min(20, 'Add at least 20 characters so we can understand the problem.')
    .max(4000, 'Keep your message within 4,000 characters.'),
}).strict();
export type SupportRequest = z.infer<typeof supportRequestSchema>;
