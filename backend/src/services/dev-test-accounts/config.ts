import { createHash } from 'node:crypto';
import { AllergenType, HealthConditionType } from '@prisma/client';
import { z } from 'zod';
import { testMemberProfileSchema } from './member-profile';

const slug = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const testEmailNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, 'Use letters, numbers, dots, underscores or hyphens without @.')
  .refine((value) => !value.includes('..'), 'Email names cannot contain consecutive dots.');
const conditions = z.array(z.nativeEnum(HealthConditionType)).min(1).max(6).default(['NONE']);
const allergens = z.array(z.nativeEnum(AllergenType)).min(1).max(6).default(['NONE']);
const member = z
  .object({
    conditions,
    allergens,
    profile: testMemberProfileSchema.optional(),
  })
  .strict();
const rnd = z
  .object({
    expertise: z.array(z.nativeEnum(HealthConditionType)).max(5).default([]),
    experienceYears: z.number().int().min(0).max(60).default(0),
    status: z.enum(['ACTIVE', 'EXPIRED', 'UNVERIFIED', 'SUSPENDED']).default('ACTIVE'),
  })
  .strict();
export const accountSchema = z
  .object({
    alias: slug,
    role: z.enum(['USER', 'RND', 'ADMIN']),
    name: z.string().trim().min(1).max(100),
    emailName: testEmailNameSchema.optional(),
    member: member.optional(),
    rnd: rnd.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.member?.conditions.includes('PREGNANT') && value.member.profile?.biologicalSex === 'MALE')
      ctx.addIssue({
        code: 'custom',
        path: ['member', 'profile', 'biologicalSex'],
        message: 'Pregnancy requires a female profile.',
      });
    if ((value.member && value.role !== 'USER') || (value.rnd && value.role !== 'RND'))
      ctx.addIssue({ code: 'custom', message: 'Member/RND settings must match the account role.' });
    for (const codes of [value.member?.conditions, value.member?.allergens]) {
      if (codes && (new Set(codes).size !== codes.length || (codes.length > 1 && codes.includes('NONE'))))
        ctx.addIssue({ code: 'custom', message: 'Use unique declarations; NONE cannot accompany another entry.' });
    }
    if (
      value.rnd?.expertise.includes('NONE') ||
      new Set(value.rnd?.expertise).size !== (value.rnd?.expertise.length ?? 0)
    )
      ctx.addIssue({ code: 'custom', message: 'Expertise must be unique conditions and cannot include NONE.' });
  });
export const accountSpecSchema = z
  .array(accountSchema)
  .min(1)
  .max(30)
  .superRefine((values, ctx) => {
    if (new Set(values.map((value) => value.alias)).size !== values.length)
      ctx.addIssue({ code: 'custom', message: 'Account aliases must be unique.' });
    const emailNames = values.flatMap((value) => (value.emailName ? [value.emailName] : []));
    if (new Set(emailNames).size !== emailNames.length)
      ctx.addIssue({ code: 'custom', message: 'Custom email names must be unique.' });
    if (values.some((value) => value.role === 'RND') && !values.some((value) => value.role === 'ADMIN'))
      ctx.addIssue({ code: 'custom', message: 'Include a synthetic ADMIN for RND credential provenance.' });
  });
export type AccountSpec = z.infer<typeof accountSchema>;

export const defaultAccountSpecs: AccountSpec[] = accountSpecSchema.parse([
  { alias: 'admin', role: 'ADMIN', name: 'Test Admin' },
  ...[
    ['healthy', 'NONE'],
    ['heart', 'HEART_CONDITION'],
    ['diabetes', 'DIABETES'],
    ['kidney', 'KIDNEY_DISEASE'],
  ].map(([alias, condition]) => ({
    alias: `member-${alias}`,
    role: 'USER',
    name: `Test Member ${alias}`,
    member: { conditions: [condition] },
  })),
  ...[
    ['heart-junior', ['HEART_CONDITION'], 3],
    ['heart-senior', ['HEART_CONDITION'], 15],
    ['diabetes', ['DIABETES'], 8],
    ['kidney', ['KIDNEY_DISEASE'], 12],
    ['general', [], 25],
  ].map(([alias, expertise, experienceYears]) => ({
    alias: `rnd-${alias}`,
    role: 'RND',
    name: `Test RND ${alias}`,
    rnd: { expertise, experienceYears },
  })),
]);

export function fixtureIdentity(set: string, spec: AccountSpec) {
  slug.parse(set);
  const emailName = spec.emailName ? testEmailNameSchema.parse(spec.emailName) : undefined;
  const email = `${emailName ?? `qa-${set}-${spec.alias}`}@example.test`;
  return {
    id: emailName
      ? `devfixture_email_${createHash('sha256').update(email).digest('hex').slice(0, 32)}`
      : `devfixture_${set}_${spec.alias}`,
    email,
    name: `[TEST ${set}] ${spec.name}`,
    role: spec.role === 'RND' ? ('NUTRITIONIST' as const) : spec.role,
  };
}

export function databaseTarget(raw: string, env: NodeJS.ProcessEnv) {
  if (!['development', 'test'].includes(env.NODE_ENV ?? ''))
    throw new Error('NODE_ENV must explicitly be development or test.');
  for (const key of ['VERCEL_ENV', 'RAILWAY_ENVIRONMENT_NAME', 'APP_ENV', 'DEPLOYMENT_ENV']) {
    if (env[key] && !['development', 'test', 'local'].includes(env[key]!.toLowerCase()))
      throw new Error(`${key} does not identify a development/test runtime.`);
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL target required.');
  const hostname = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || /(^|[-_.])(prod|production|demo|staging)([-_.]|$)/i.test(`${hostname}.${database}`))
    throw new Error('Production, demo and staging targets are refused.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const label = `${hostname}:${url.port || '5432'}/${database}`;
  return { local, label, token: `devdb-${createHash('sha256').update(label).digest('hex').slice(0, 16)}` };
}

export function assertWriteTarget(target: ReturnType<typeof databaseTarget>, args: string[]) {
  const index = args.indexOf('--confirm-target');
  if (index < 0 || args[index + 1] !== target.token)
    throw new Error('Apply requires the exact --confirm-target token printed by the dry run.');
  if (!target.local && !args.includes('--allow-shared-development'))
    throw new Error('Remote writes require explicit --allow-shared-development authorization.');
}
