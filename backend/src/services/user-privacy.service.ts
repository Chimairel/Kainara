import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

type AccountDeletionCredential = {
  password?: string;
};

export class UserPrivacyService {
  static async exportAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        tosAccepted: true,
        tosAcceptedAt: true,
        acceptedTermsVersion: true,
        acceptedPrivacyVersion: true,
        healthDataConsentedAt: true,
        onboardingDone: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        userProfile: true,
        healthConditions: true,
        allergies: true,
        safetyProfileEntries: true,
        nutritionReport: true,
        nutritionReportVersions: true,
        mealPlans: { include: { ingredients: true } },
        mealLogs: true,
        weightLogs: true,
        waterLogs: true,
        dailyNutritionLogs: true,
        groceryLists: { include: { groceryItems: true } },
        notifications: true,
        mealReminderSettings: true,
        webPushSubscriptions: { select: { id: true, createdAt: true } },
        weeklyCheckins: true,
        healthProfileRevisions: true,
        clinicalContextResponses: true,
        clinicalFacts: true,
        clinicalDocuments: {
          select: {
            id: true,
            area: true,
            documentType: true,
            status: true,
            revision: true,
            originalFileName: true,
            mimeType: true,
            byteSize: true,
            sha256: true,
            issuedAt: true,
            issuerName: true,
            consentVersion: true,
            validUntil: true,
            supersedesDocumentId: true,
            withdrawnAt: true,
            createdAt: true,
            updatedAt: true,
            reviews: true,
          },
        },
      },
    });
    if (!user) throw new Error('Account not found.');

    return {
      format: 'KAINARA Account Export',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: user,
    };
  }

  static async deleteAccount(userId: string, credential: AccountDeletionCredential) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        passwordLoginEnabled: true,
        accounts: { where: { provider: 'google' }, select: { providerAccountId: true } },
      },
    });
    if (!user || user.role !== 'USER') throw new Error('Only patient accounts can use self-service deletion.');

    let reauthenticationMethod: 'PASSWORD' | 'AUTHENTICATED_SESSION';
    if (user.passwordLoginEnabled) {
      if (!credential.password || !(await bcrypt.compare(credential.password, user.passwordHash))) {
        throw new Error('Current password is incorrect.');
      }
      reauthenticationMethod = 'PASSWORD';
    } else if (user.accounts.length > 0) {
      // The authenticated route requires the typed deletion confirmation.
      // Google-only accounts have no usable password or second sign-in step.
      reauthenticationMethod = 'AUTHENTICATED_SESSION';
    } else {
      throw new Error('Account sign-in method could not be verified.');
    }

    const [mealPlans, scopedClearances] = await Promise.all([
      prisma.mealPlan.findMany({ where: { userId }, select: { id: true } }),
      prisma.mealConditionClearance.findMany({ where: { userScopeId: userId }, select: { id: true } }),
    ]);
    const mealPlanIds = mealPlans.map(({ id }) => id);
    const clearanceIds = scopedClearances.map(({ id }) => id);

    // The review graph intentionally uses RESTRICT during ordinary operations.
    // Use a batch transaction here instead of an interactive transaction: the
    // development database is remote, and the default five-second interactive
    // transaction lease can expire between these dependent statements. Prisma
    // sends this ordered batch as one atomic database transaction.
    await prisma.$transaction([
      prisma.mealPlanClinicalEvidence.deleteMany({ where: { mealPlanId: { in: mealPlanIds } } }),
      prisma.clearanceClinicalEvidence.deleteMany({ where: { clearanceId: { in: clearanceIds } } }),
      prisma.mealPlanClearanceUsage.deleteMany({ where: { clearanceId: { in: clearanceIds } } }),
      prisma.mealConditionClearanceDecision.deleteMany({ where: { clearanceId: { in: clearanceIds } } }),
      prisma.mealConditionClearance.deleteMany({ where: { id: { in: clearanceIds } } }),
      prisma.mealPlanReviewDecision.deleteMany({ where: { mealPlanId: { in: mealPlanIds } } }),
      prisma.auditEvent.create({
        data: {
          actorUserId: userId,
          action: 'USER_SELF_DELETION',
          entityType: 'User',
          entityId: userId,
          metadata: { initiatedBy: 'SELF_SERVICE', reauthenticationMethod },
        },
      }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
  }
}
