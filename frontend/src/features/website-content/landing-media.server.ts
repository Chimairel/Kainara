import { z } from 'zod';
import type { LandingMedia } from './types';

const deliveryUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password;
  });
const responseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      kind: z.enum(['image', 'video']),
      url: deliveryUrl,
      posterUrl: deliveryUrl.nullable(),
      altText: z.string().max(240),
    })
    .nullable(),
});

/** Read only public media; never forward a member's cookies or authorization. */
export async function getPublishedLandingMedia(): Promise<LandingMedia | null> {
  const internal = process.env.INTERNAL_API_URL?.replace(/\/$/, '');
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const apiBase = internal
    ? `${internal}/api`
    : configured?.match(/^https?:\/\//)
      ? configured
      : 'http://127.0.0.1:5000/api';
  try {
    const response = await fetch(`${apiBase}/public/landing-media`, {
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const result = responseSchema.safeParse(await response.json());
    return result.success ? result.data.data : null;
  } catch {
    return null;
  }
}
