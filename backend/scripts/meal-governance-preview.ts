/** Owner-inspectable local preview of the completed governance acceptance fixture. */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55485');
  assert.equal(target.pathname, '/kainara_meal_governance');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await prisma.user.count(), 19, 'First run the fresh governance acceptance fixture.');
  assert.equal(await prisma.mealReviewLineage.count({ where: { state: 'QUARANTINED', incidentCount: 2 } }), 1);
  if (process.argv.includes('--prepare')) {
    const password = process.env.MEAL_GOVERNANCE_PREVIEW_PASSWORD ?? '';
    assert.ok(password.length >= 12, 'Supply a password for this isolated preview only.');
    const passwordHash = await bcrypt.hash(password, 12);
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    users.sort((a, b) => Number(a.name.split(' ').at(-1)) - Number(b.name.split(' ').at(-1)));
    const aliases = {
      ADMIN: ['admin', 'admin-batch-owner'],
      NUTRITIONIST: [
        'rnd-author',
        'rnd-flagger',
        'rnd-heart-senior',
        'rnd-heart-junior',
        'rnd-kidney',
        'rnd-general',
        'rnd-experience',
        'rnd-diabetes',
        'rnd-suspended',
        'rnd-expired',
      ],
      USER: [
        'member-legacy',
        'member-unrelated',
        'member-heart',
        'member-heart-pending',
        'member-healthy',
        'member-diabetes',
        'member-pregnancy',
      ],
    };
    const indices = { ADMIN: 0, NUTRITIONIST: 0, USER: 0 };
    for (const user of users) {
      assert.ok(user.name.startsWith('Synthetic '), 'This script only prepares synthetic acceptance accounts.');
      const alias = aliases[user.role][indices[user.role]++];
      assert.ok(alias);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: `${alias}@example.test`,
          passwordHash,
          passwordLoginEnabled: true,
          tosAcceptedAt: new Date(),
          healthDataConsentedAt: new Date(),
          acceptedTermsVersion: CURRENT_TERMS_VERSION,
          acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        },
      });
      if (user.role === 'USER') {
        if (!(await prisma.userProfile.findUnique({ where: { userId: user.id } }))) continue;
        await prisma.userProfile.update({
          where: { userId: user.id },
          data: {
            targetWeightKg: 65,
            ricePreference: 'FLEXIBLE',
            foodCulture: 'Filipino',
            shoppingDayGroup: 'WEEKEND',
            shoppingDayOfWeek: 6,
          },
        });
        if (!(await prisma.allergy.count({ where: { userId: user.id } })))
          await prisma.allergy.create({ data: { userId: user.id, allergen: 'NONE' } });
        await prisma.mealReminderSettings.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            breakfastTime: '07:00',
            lunchTime: '12:00',
            dinnerTime: '19:00',
            timeZone: 'Asia/Manila',
            remindersEnabled: false,
          },
          update: {},
        });
      }
      console.log(`Prepared ${alias}@example.test (${user.role})`);
    }
    await prisma.$disconnect();
    return;
  }
  assert.equal(process.env.FRONTEND_URL, 'http://127.0.0.1:3103');
  app.listen(5103, '127.0.0.1', () => console.log('Synthetic meal-review preview API: loopback port 5103.'));
}

main().catch(async () => {
  console.error('Meal-review preview refused to start. Verify the guarded local fixture and preview configuration.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
