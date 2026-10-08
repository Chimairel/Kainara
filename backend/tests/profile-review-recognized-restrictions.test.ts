import { ReviewRoutingService } from '../src/services/review-routing.service';
import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { AppError } from '../src/errors/AppError';

test('recognized manual-review restrictions reach health-form validation, while unmapped declarations remain blocked', async (t) => {
  // These claim/evidence fixtures exercise the existing path with routing disabled.
  // The new routing HTTP acceptance tests cover enabled authorization separately.
  t.mock.method(ReviewRoutingService, 'config', async () => ({ id: 'global', enabled: false, enabledAt: null }));
  const originalUser = prisma.user.findUnique;
  const originalReviewer = prisma.nutritionistProfile.findUnique;
  const originalReady = ClinicalEvidenceService.assertReadyForMealPlanning;
  let supportState = 'RECOGNIZED_UNSUPPORTED';
  let readinessCalls = 0;
  prisma.user.findUnique = (async () => ({
    id: 'fixture',
    role: 'USER',
    userProfile: { revision: 1, safetyRevision: 1 },
    healthConditions: [{ condition: 'HEART_CONDITION' }],
    allergies: [],
    clinicalContextResponses: [],
    safetyProfileEntries: [
      { domain: 'CONDITION', canonicalCode: 'HEART_CONDITION', supportState },
      { domain: 'ALLERGY', canonicalCode: 'NONE', supportState: 'SUPPORTED' },
    ],
  })) as unknown as typeof originalUser;
  prisma.nutritionistProfile.findUnique = (async () => ({
    id: 'reviewer',
    isVerified: true,
    prcLicenseExpiry: new Date('2030-01-01'),
    user: { role: 'NUTRITIONIST', isSuspended: false },
  })) as unknown as typeof originalReviewer;
  ClinicalEvidenceService.assertReadyForMealPlanning = async () => {
    readinessCalls++;
    throw new AppError('Unfinished forms still block confirmation.', 422, 'CLINICAL_EVIDENCE_REQUIRED');
  };
  try {
    await assert.rejects(
      () => ClinicalProfileReviewService.decide('reviewer', 'fixture', 'APPROVED', 'Reviewed details.'),
      (error: unknown) => error instanceof AppError && error.errorCode === 'CLINICAL_EVIDENCE_REQUIRED'
    );
    assert.equal(readinessCalls, 1);
    for (const unresolved of ['NEEDS_CLARIFICATION', 'PENDING_REVIEW', 'INVALID', 'UNKNOWN']) {
      supportState = unresolved;
      await assert.rejects(
        () => ClinicalProfileReviewService.decide('reviewer', 'fixture', 'APPROVED', 'Reviewed details.'),
        (error: unknown) => error instanceof AppError && error.errorCode === 'PROFILE_CLARIFICATION_REQUIRED'
      );
    }
    assert.equal(readinessCalls, 1);
  } finally {
    prisma.user.findUnique = originalUser;
    prisma.nutritionistProfile.findUnique = originalReviewer;
    ClinicalEvidenceService.assertReadyForMealPlanning = originalReady;
    await prisma.$disconnect();
  }
});
