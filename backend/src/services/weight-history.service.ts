import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isSupportedWeightKg } from '@/policies/weight-entry.policy';

type HistoryClient = Pick<Prisma.TransactionClient, 'weightLog' | 'nutritionReportVersion'>;
export const onboardingWeightId = (userId: string) => `onboarding-weight:${userId}`;

/** The locked onboarding transaction records one immutable starting observation. */
export async function recordOnboardingWeight(client: HistoryClient, userId: string, weightKg: number) {
  if (!isSupportedWeightKg(weightKg)) throw new Error('Weight must be between 30 and 300 kg.');
  return client.weightLog.upsert({
    where: { id: onboardingWeightId(userId) },
    update: {},
    create: { id: onboardingWeightId(userId), userId, weightKg, note: 'Starting weight from onboarding' },
  });
}

/** Old accounts can display their earliest saved report observation without rewriting history. */
export async function getWeightHistory(userId: string, client: HistoryClient = prisma) {
  const logs = await client.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' } });
  if (logs.some((log) => log.id === onboardingWeightId(userId))) {
    return logs.map((log) => ({ ...log, source: log.id === onboardingWeightId(userId) ? 'ONBOARDING' : 'LOG' }));
  }
  const report = await client.nutritionReportVersion.findFirst({
    where: { userId },
    orderBy: { version: 'asc' },
    select: { id: true, generatedAt: true, profileSnapshot: true },
  });
  const snapshot = report?.profileSnapshot as { profile?: { weightKg?: unknown } } | null;
  const weightKg = snapshot?.profile?.weightKg;
  if (
    !report ||
    typeof weightKg !== 'number' ||
    !isSupportedWeightKg(weightKg) ||
    (logs[0] && logs[0].loggedAt <= report.generatedAt)
  ) {
    return logs.map((log) => ({ ...log, source: 'LOG' }));
  }
  return [
    {
      id: `initial-report-weight:${report.id}`,
      userId,
      weightKg,
      loggedAt: report.generatedAt,
      note: 'Starting weight from your first saved nutrition report',
      source: 'INITIAL_REPORT',
    },
    ...logs.map((log) => ({ ...log, source: 'LOG' })),
  ];
}
