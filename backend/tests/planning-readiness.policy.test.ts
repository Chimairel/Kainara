import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { determinePlanningReadiness } from '../src/domain/planning-readiness.policy';

test('missing required clinical context blocks a plan request even after report acknowledgment', () => {
  const readiness = determinePlanningReadiness({
    conditions: ['KIDNEY_DISEASE'],
    profileReviewApproved: false,
    restrictionsRequireReview: false,
    requirements: [
      {
        area: ClinicalEvidenceArea.KIDNEY_DISEASE,
        condition: HealthConditionType.KIDNEY_DISEASE,
        state: 'DOCUMENT_REVIEW_REQUIRED',
        required: true,
        reasonCode: 'MISSING_DOCUMENT',
        message: 'Document review required.',
        readyDocumentIds: [],
      },
    ],
  });
  assert.equal(readiness.status, 'BLOCKED_CLINICAL_CONTEXT');
  assert.equal(readiness.canRequestPlan, false);
  assert.equal(readiness.actionPath, '/profile/clinical-evidence');
});

test('custom restriction waits for profile review before candidate sourcing', () => {
  const readiness = determinePlanningReadiness({
    conditions: [],
    restrictionsRequireReview: true,
    requirements: [],
    profileReviewApproved: false,
  });
  assert.equal(readiness.status, 'BLOCKED_PROFILE_REVIEW');
  assert.equal(readiness.canRequestPlan, false);
  assert.match(readiness.message, /before meal candidates/);
});

test('restricted profile with completed review may source pending case candidates', () => {
  const readiness = determinePlanningReadiness({
    conditions: ['HYPERTENSION'],
    restrictionsRequireReview: false,
    requirements: [],
    profileReviewApproved: true,
  });
  assert.equal(readiness.status, 'REQUEST_ALLOWED_REVIEW_EXPECTED');
  assert.equal(readiness.canRequestPlan, true);
});

test('unrestricted profile may request a plan without implying new candidates are approved', () => {
  const readiness = determinePlanningReadiness({
    conditions: [],
    restrictionsRequireReview: false,
    requirements: [],
    profileReviewApproved: true,
  });
  assert.equal(readiness.status, 'REQUEST_ALLOWED');
  assert.equal(readiness.canRequestPlan, true);
  assert.match(readiness.message, /new candidates wait for nutritionist review/);
});
