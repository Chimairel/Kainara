import bcrypt from 'bcryptjs';
import { Prisma, type PrismaClient } from '@prisma/client';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../../domain/onboarding.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../../domain/deterministic-nutrition-report.policy';
import { calculatePlanningMacroTargets } from '../../domain/meal-macro-target.policy';
import { fixtureIdentity, type AccountSpec } from './config';
import { buildTestMemberProfile } from './member-profile';

export async function inspectAccounts(db: Pick<Prisma.TransactionClient, 'user'>, set: string, specs: AccountSpec[]) {
  const identities = specs.map((spec) => fixtureIdentity(set, spec));
  const existing = await db.user.findMany({
    where: {
      OR: [{ email: { in: identities.map((item) => item.email) } }, { id: { in: identities.map((item) => item.id) } }],
    },
    select: { id: true, email: true, role: true },
  });
  return identities.map((identity) => {
    const found = existing.find((entry) => entry.email === identity.email || entry.id === identity.id);
    if (found && (found.email !== identity.email || found.id !== identity.id || found.role !== identity.role))
      throw new Error(`Account collision: ${identity.email}. Existing identities will not be changed.`);
    return { ...identity, exists: Boolean(found) };
  });
}

export async function createAccounts(
  db: PrismaClient,
  set: string,
  specs: AccountSpec[],
  password: string,
  actorId?: string
) {
  if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Test password must be at least 16 characters and at most 72 UTF-8 bytes.');
  const passwordHash = await bcrypt.hash(password, 12);
  return db.$transaction(
    async (tx) => {
      // Serialize repeated creation of the same fixture set; database uniqueness handles other collisions.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dev-test-accounts:${set}`}))`;
      const plan = await inspectAccounts(tx, set, specs);
      const now = new Date();
      const adminId = actorId ?? plan.find((item) => item.role === 'ADMIN')?.id;
      const actor = actorId
        ? await tx.user.findUnique({
            where: { id: actorId },
            select: { name: true, role: true, isSuspended: true, emailVerified: true },
          })
        : null;
      if (actorId && (!actor || actor.role !== 'ADMIN' || actor.isSuspended || !actor.emailVerified))
        throw new Error('An active administrator is required to create test accounts.');
      const ordered = [...specs].sort((a, b) => Number(b.role === 'ADMIN') - Number(a.role === 'ADMIN'));
      for (const spec of ordered) {
        const identity = fixtureIdentity(set, spec);
        if (plan.find((item) => item.id === identity.id)!.exists) continue;
        await tx.user.create({
          data: {
            ...identity,
            passwordHash,
            passwordLoginEnabled: true,
            emailVerified: true,
            onboardingDone: true,
            tosAccepted: true,
            tosAcceptedAt: now,
            healthDataConsentedAt: now,
            acceptedTermsVersion: CURRENT_TERMS_VERSION,
            acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
            isSuspended: spec.rnd?.status === 'SUSPENDED',
          },
        });
        if (spec.role === 'RND') {
          const rnd = spec.rnd ?? { expertise: [], experienceYears: 0, status: 'ACTIVE' };
          await tx.nutritionistProfile.create({
            data: {
              userId: identity.id,
              prcLicenseNumber: `TEST-${set}-${spec.alias}`,
              prcLicenseExpiry: new Date(now.getTime() + (rnd.status === 'EXPIRED' ? -1 : 365) * 86_400_000),
              isVerified: rnd.status !== 'UNVERIFIED',
              verifiedAt: rnd.status === 'UNVERIFIED' ? null : now,
              verifiedByAdminId: adminId,
              yearsOfExperience: rnd.experienceYears,
              specialization: `Synthetic test expertise: ${rnd.expertise.join(', ') || 'General'}`,
              bio: 'SYNTHETIC DEVELOPMENT ACCOUNT. Credentials are test fixtures, not a licensed clinician.',
              verifiedExpertise: rnd.expertise,
              verifiedExperienceYears: rnd.experienceYears,
              expertiseEvidence: 'Synthetic developer fixture; not a credential verification.',
              expertiseVerifiedAt: now,
              expertiseVerifiedById: adminId,
            },
          });
        }
        if (spec.role === 'USER') {
          const conditions = spec.member?.conditions ?? ['NONE'];
          const allergens = spec.member?.allergens ?? ['NONE'];
          const profile = buildTestMemberProfile(spec.member?.profile, conditions.includes('PREGNANT'));
          await tx.userProfile.create({
            data: { ...profile, userId: identity.id, planningReportVersion: 1, firstReportAcknowledgedAt: now },
          });
          await tx.healthCondition.createMany({
            data: conditions.map((condition) => ({ userId: identity.id, condition })),
          });
          await tx.allergy.createMany({ data: allergens.map((allergen) => ({ userId: identity.id, allergen })) });
          await tx.safetyProfileEntry.createMany({
            data: [
              ...conditions.map((canonicalCode) => ({ domain: 'CONDITION' as const, canonicalCode })),
              ...allergens.map((canonicalCode) => ({ domain: 'ALLERGY' as const, canonicalCode })),
            ].map((entry) => ({
              ...entry,
              userId: identity.id,
              displayName: entry.canonicalCode,
              originalText: entry.canonicalCode,
              normalizedText: entry.canonicalCode.toLowerCase(),
              provenance: 'PREDEFINED' as const,
              supportState: 'SUPPORTED' as const,
              policyReference: 'SYNTHETIC_DEV_ACCOUNT',
            })),
          });
          await tx.mealReminderSettings.create({
            data: {
              userId: identity.id,
              breakfastTime: '07:00',
              lunchTime: '12:00',
              dinnerTime: '19:00',
              timeZone: 'Asia/Manila',
              remindersEnabled: false,
            },
          });
          const content = {
            generalSummary:
              'SYNTHETIC DEVELOPMENT PROFILE. Prepared for software tests; not clinical guidance or approval.',
            foodsToAvoid: [],
            foodsToLimit: [],
            foodsRecommended: [],
            drinksGuidance: [],
            basedOnConditions: conditions,
            basedOnAllergies: allergens,
          };
          await tx.nutritionReport.create({
            data: { ...content, userId: identity.id, acknowledgedAt: now, profileRevision: 0, version: 1 },
          });
          await tx.nutritionReportVersion.create({
            data: {
              userId: identity.id,
              version: 1,
              profileRevision: 0,
              acknowledgedAt: now,
              policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
              content,
              profileSnapshot: {
                profile,
                conditions,
                allergens,
                otherConditions: [],
                otherAllergies: [],
                planningTargets: calculatePlanningMacroTargets({
                  ...profile,
                  restricted: conditions.some((c) => c !== 'NONE'),
                }),
              } as Prisma.InputJsonObject,
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            action: 'SYNTHETIC_DEV_ACCOUNT_CREATED',
            actorUserId: actorId,
            actorRole: actor?.role,
            actorName: actor?.name,
            entityType: 'User',
            entityId: identity.id,
            metadata: {
              fixtureSet: set,
              role: identity.role,
              synthetic: true,
              createdBy: actorId ? 'Admin test account tool' : 'dev-test-accounts CLI',
              emailVerificationSkipped: true,
              onboardingSkipped: true,
              rndApplicationSkipped: spec.role === 'RND',
            },
          },
        });
      }
      return plan;
    },
    { maxWait: 10_000, timeout: 60_000 }
  );
}
