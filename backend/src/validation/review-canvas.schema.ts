import { z } from 'zod';

const coordinate = z.number().finite().min(-100000).max(100000);
export const reviewCanvasLayoutSchema = z.object({
  version: z.literal(1),
  sheets: z.array(z.object({ title: z.string().max(200), x: coordinate, y: coordinate }).strict()).max(50),
  view: z.object({ x: coordinate, y: coordinate, scale: z.number().finite().min(0.1).max(2) }).strict(),
  selected: z.number().int().min(0).max(49),
  mode: z.enum(['hand', 'select']),
}).strict();
export type SavedCanvasLayout = z.infer<typeof reviewCanvasLayoutSchema>;
