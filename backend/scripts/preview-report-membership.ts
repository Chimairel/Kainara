import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/membership_acceptance') {
    throw new Error('Preview requires the isolated local membership_acceptance database.');
  }
  process.env.NODE_ENV = 'development';
  process.env.MEMBERSHIP_ENABLED = 'true';
  process.env.JWT_SECRET = 'isolated-membership-preview-access-key';
  process.env.JWT_REFRESH_SECRET = 'isolated-membership-preview-refresh-key';
  process.env.FRONTEND_URL = 'http://localhost:3108';
  process.env.CORS_ORIGINS = 'http://localhost:3108';
  // Explicit local opt-in; load only test payment settings, never the shared database or return URLs.
  if (process.env.PAYMONGO_INTEGRATION_ENABLED === 'true' && process.env.PAYMONGO_PREVIEW_KEYS_FILE) {
    const payment = parse(readFileSync(process.env.PAYMONGO_PREVIEW_KEYS_FILE));
    for (const key of ['PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET', 'PAYMONGO_ENVIRONMENT']) {
      process.env[key] = payment[key];
    }
  }
  const { default: prisma } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { NutritionReportService } = await import('../src/services/nutrition-report.service');
  const { UpcomingPlanPreparationService } = await import('../src/services/upcoming-plan-preparation.service');
  const { calculateDailyTarget } = await import('../src/lib/calculations');
  // Profile/report/membership preview; PayMongo calls require the explicit test opt-in above.
  UpcomingPlanPreparationService.triggerNonBlocking = () => {};
  const now = new Date();
  const past = new Date(now.getTime() - 30 * 86_400_000);
  const passwordHash = await bcrypt.hash('Development123!', 12);
  for (const tier of ['FREE', 'LIFESTYLE', 'HEALTH'] as const) {
    const id = `membership-preview-${tier.toLowerCase()}`;
    const email = `${tier.toLowerCase()}@preview.invalid`;
    if (await prisma.user.findUnique({ where: { id } })) {
      for (const domain of ['CONDITION', 'ALLERGY'] as const) {
        if (!(await prisma.safetyProfileEntry.count({ where: { userId: id, domain } })))
          await prisma.safetyProfileEntry.create({
            data: {
              userId: id,
              domain,
              canonicalCode: 'NONE',
              displayName: 'None reported',
              originalText: 'None',
              normalizedText: 'none',
              provenance: 'PREDEFINED',
              supportState: 'SUPPORTED',
              policyReference: 'isolated-preview-none',
            },
          });
      }
      continue;
    }
    const dailyCalorieTarget = calculateDailyTarget({
      age: 26,
      biologicalSex: 'MALE',
      heightCm: 170,
      weightKg: 65,
      goal: 'MAINTAIN',
      activityLevel: 'SEDENTARY',
    }).dailyCalorieTarget;
    await prisma.user.create({
      data: {
        id,
        email,
        name: `${tier} preview`,
        role: 'USER',
        passwordHash,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        tosAcceptedAt: now,
        acceptedTermsVersion: '2026-09-27',
        acceptedPrivacyVersion: '2026-09-27',
        healthDataConsentedAt: now,
        userProfile: {
          create: {
            age: 26,
            biologicalSex: 'MALE',
            heightCm: 170,
            weightKg: 65,
            targetWeightKg: 65,
            goal: 'MAINTAIN',
            activityLevel: 'SEDENTARY',
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'FLEXIBLE',
            foodCulture: 'Filipino',
            shoppingDayOfWeek: 6,
            shoppingDayGroup: 'WEEKEND',
            dailyCalorieTarget,
          },
        },
      },
    });
    await prisma.safetyProfileEntry.createMany({
      data: ['CONDITION', 'ALLERGY'].map((domain) => ({
        userId: id,
        domain: domain as 'CONDITION' | 'ALLERGY',
        canonicalCode: 'NONE',
        displayName: 'None reported',
        originalText: 'None',
        normalizedText: 'none',
        provenance: 'PREDEFINED' as const,
        supportState: 'SUPPORTED' as const,
        policyReference: 'isolated-preview-none',
      })),
    });
    await prisma.membershipAccount.create({ data: { userId: id, createdAt: past, trialStartedAt: past } });
    if (tier !== 'FREE')
      await prisma.membershipGrant.create({
        data: {
          userId: id,
          tier,
          source: 'ADMIN_ADJUSTMENT',
          evidenceReference: `isolated-preview:${randomUUID()}`,
          verifiedAt: now,
          effectiveFrom: now,
          effectiveUntil: new Date(now.getTime() + 30 * 86_400_000),
        },
      });
    const report = await NutritionReportService.generateReport(id);
    await NutritionReportService.acknowledgeReport(id, report.version);
    await prisma.userProfile.update({ where: { userId: id }, data: { firstReportAcknowledgedAt: past } });
  }
  const server = app.listen(5018, '127.0.0.1', () => {
    console.log('Isolated membership preview API: http://127.0.0.1:5018');
    console.log('Accounts: free@preview.invalid, lifestyle@preview.invalid, health@preview.invalid');
    console.log('Fixture password: Development123!');
    console.log(
      `Synthetic accounts only. AI and email are disabled. PayMongo test checkout: ${process.env.PAYMONGO_INTEGRATION_ENABLED === 'true' ? 'opted in' : 'disabled'}.`
    );
  });
  const stop = () => {
    server.close(() => {
      void prisma.$disconnect();
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
