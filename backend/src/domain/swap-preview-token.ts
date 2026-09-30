import { createHmac, timingSafeEqual } from 'node:crypto';

export const SWAP_PREVIEW_TTL_MS = 10 * 60 * 1000;

type SwapPreviewTokenPayload = { requestKey: string; snapshotHash: string; expiresAt: number };

function swapPreviewSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Swap previews are unavailable because the server signing secret is missing.');
  return secret;
}

export function signSwapPreview(payload: SwapPreviewTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', swapPreviewSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySwapPreview(token: string): SwapPreviewTokenPayload {
  const [encoded, supplied] = token.split('.');
  if (!encoded || !supplied) throw new Error('Swap preview is invalid. Request a fresh preview.');
  const expected = createHmac('sha256', swapPreviewSecret()).update(encoded).digest();
  const suppliedBuffer = Buffer.from(supplied, 'base64url');
  if (expected.length !== suppliedBuffer.length || !timingSafeEqual(expected, suppliedBuffer)) {
    throw new Error('Swap preview is invalid. Request a fresh preview.');
  }
  let payload: SwapPreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SwapPreviewTokenPayload;
  } catch {
    throw new Error('Swap preview is invalid. Request a fresh preview.');
  }
  if (!payload.requestKey || !payload.snapshotHash || payload.expiresAt <= Date.now()) {
    throw new Error('Swap preview expired. Request a fresh preview.');
  }
  return payload;
}
