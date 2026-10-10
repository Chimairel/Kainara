import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import prisma from '../src/lib/prisma';
import { AppError } from '../src/errors/AppError';
import { ReviewRoutingService } from '../src/services/review-routing.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { encryptClinicalDocument } from '../src/lib/clinical-document-crypto';

// Prisma delegates expose methods through a proxy, so MockTracker.method cannot inspect them.
function mockDelegate<T extends object, K extends keyof T>(
  t: TestContext,
  delegate: T,
  key: K,
  implementation: (...args: unknown[]) => Promise<unknown>
) {
  const original = delegate[key];
  const mock = t.mock.fn(implementation);
  delegate[key] = mock as T[K];
  t.after(() => {
    delegate[key] = original;
  });
  return mock;
}

test('missing meal claim denies file access before querying or auditing a document', async (t) => {
  t.mock.method(ReviewRoutingService, 'assertMeal', async () => {});
  mockDelegate(t, prisma.mealPlan, 'findFirst', async () => null);
  const document = mockDelegate(t, prisma.clinicalDocument, 'findFirst', async () => null);
  const audit = mockDelegate(t, prisma.auditEvent, 'create', async () => ({}));
  await assert.rejects(
    ClinicalEvidenceService.fileForClaimedMealReview('rnd', 'actor', 'meal', 'document'),
    (error: unknown) => error instanceof AppError && error.errorCode === 'MEAL_REVIEW_CLAIM_REQUIRED'
  );
  assert.equal(document.mock.callCount(), 0);
  assert.equal(audit.mock.callCount(), 0);
});

test('a document outside current readiness evidence is denied before audit/decryption', async (t) => {
  t.mock.method(ReviewRoutingService, 'assertMeal', async () => {});
  mockDelegate(t, prisma.mealPlan, 'findFirst', async () => ({ userId: 'member' }));
  mockDelegate(t, prisma.clinicalDocument, 'findFirst', async () => ({ id: 'document' }));
  t.mock.method(ClinicalEvidenceService, 'requirementsForUser', async () => []);
  const audit = mockDelegate(t, prisma.auditEvent, 'create', async () => ({}));
  await assert.rejects(
    ClinicalEvidenceService.fileForClaimedMealReview('rnd', 'actor', 'meal', 'document'),
    (error: unknown) => error instanceof AppError && error.errorCode === 'CLINICAL_DOCUMENT_NOT_IN_SCOPE'
  );
  assert.equal(audit.mock.callCount(), 0);
});

test('owner access remains member-scoped and records access before returning authenticated decrypted bytes', async (t) => {
  const previousKey = process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY;
  process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  t.after(() => {
    if (previousKey === undefined) delete process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY;
    else process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY = previousKey;
  });
  const content = Buffer.from('%PDF-1.7\nsynthetic file access fixture');
  const document = {
    id: 'document',
    ...encryptClinicalDocument(content),
    mimeType: 'application/pdf',
    originalFileName: 'synthetic.pdf',
  };
  const query = mockDelegate(t, prisma.clinicalDocument, 'findFirst', async () => document);
  const audit = mockDelegate(t, prisma.auditEvent, 'create', async () => ({}));
  const result = await ClinicalEvidenceService.fileForUser('member', 'document');
  assert.deepEqual(query.mock.calls[0].arguments[0], { where: { id: 'document', userId: 'member' } });
  assert.deepEqual(audit.mock.calls[0].arguments[0], {
    data: {
      actorUserId: 'member',
      action: 'CLINICAL_DOCUMENT_ACCESSED',
      entityType: 'ClinicalDocument',
      entityId: 'document',
      metadata: { access: 'OWNER' },
    },
  });
  assert.deepEqual(result, { buffer: content, mime: 'application/pdf', fileName: 'synthetic.pdf' });
});
