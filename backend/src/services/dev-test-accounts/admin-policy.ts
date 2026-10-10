import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AllergenType, HealthConditionType } from '@prisma/client';
import { z } from 'zod';
import { accountSchema, databaseTarget, type AccountSpec } from './config';
import { testMemberProfileSchema } from './member-profile';

export const testAccountRequestSchema = z
  .object({
    set: z.string().regex(/^[a-z][a-z0-9-]{0,23}$/, 'Use a lowercase group name, up to 24 characters.'),
    role: z.enum(['USER', 'RND', 'ADMIN']),
    name: z.string().trim().min(1).max(70),
    count: z.number().int().min(1).max(10),
    conditions: z.array(z.nativeEnum(HealthConditionType)).min(1).max(6),
    allergens: z.array(z.nativeEnum(AllergenType)).min(1).max(6),
    rndStatus: z.enum(['ACTIVE', 'EXPIRED', 'UNVERIFIED', 'SUSPENDED']),
    profile: testMemberProfileSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const parsed = accountSchema.safeParse({
      alias: 'check',
      name: value.name,
      role: value.role,
      ...(value.role === 'USER'
        ? { member: { conditions: value.conditions, allergens: value.allergens, profile: value.profile } }
        : {}),
    });
    if (!parsed.success)
      ctx.addIssue({ code: 'custom', message: parsed.error.issues[0]?.message ?? 'Invalid member settings.' });
    if (value.role !== 'USER' && (value.conditions.join() !== 'NONE' || value.allergens.join() !== 'NONE'))
      ctx.addIssue({ code: 'custom', message: 'Health declarations apply only to members.' });
    if (value.role !== 'USER' && value.profile !== undefined)
      ctx.addIssue({ code: 'custom', message: 'Planning profile settings apply only to members.' });
  });
export type TestAccountRequest = z.infer<typeof testAccountRequestSchema>;
// The strict request schema is parsed separately from creation-only fields.
export function parseCreationRequest(raw: Record<string, unknown>) {
  const { previewToken, confirmedTarget, ...request } = raw;
  const confirmation = z
    .object({ previewToken: z.string().min(1).max(200), confirmedTarget: z.literal(true) })
    .parse({ previewToken, confirmedTarget });
  return { request: testAccountRequestSchema.parse(request), ...confirmation };
}

export function adminTestAccountTarget(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'development' || (env.NUTRIMIND_DEPLOYMENT_MODE ?? 'public') !== 'public')
    throw new Error('Test account creation is available only in development.');
  return databaseTarget(env.DATABASE_URL ?? '', env);
}
export function accountSpecs(request: TestAccountRequest): AccountSpec[] {
  return Array.from({ length: request.count }, (_, index) =>
    accountSchema.parse({
      alias: `${request.role.toLowerCase()}-${index + 1}`,
      role: request.role,
      name: `${request.name} ${index + 1}`,
      ...(request.role === 'USER'
        ? {
            member: {
              conditions: request.conditions,
              allergens: request.allergens,
              ...(request.profile ? { profile: request.profile } : {}),
            },
          }
        : {}),
      ...(request.role === 'RND' ? { rnd: { status: request.rndStatus } } : {}),
    })
  );
}
function signature(expires: number, actorId: string, target: string, request: TestAccountRequest, secret: string) {
  if (!secret) throw new Error('Preview signing is unavailable.');
  const digest = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return createHmac('sha256', `dev-account-preview:${secret}`)
    .update(JSON.stringify([expires, actorId, target, digest]))
    .digest('base64url');
}
export function signAccountPreview(
  actorId: string,
  target: string,
  request: TestAccountRequest,
  secret: string,
  now = Date.now()
) {
  const expires = now + 10 * 60_000;
  return `${expires}.${signature(expires, actorId, target, request, secret)}`;
}
export function verifyAccountPreview(
  token: string,
  actorId: string,
  target: string,
  request: TestAccountRequest,
  secret: string,
  now = Date.now()
) {
  const [rawExpires, provided, extra] = token.split('.');
  const expires = Number(rawExpires);
  if (
    extra ||
    !Number.isSafeInteger(expires) ||
    expires <= now ||
    expires > now + 10 * 60_000 ||
    !/^[A-Za-z0-9_-]{43}$/.test(provided ?? '')
  )
    throw new Error('Preview expired or changed. Preview these accounts again.');
  const expected = signature(expires, actorId, target, request, secret);
  if (provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
    throw new Error('Preview expired or changed. Preview these accounts again.');
}
