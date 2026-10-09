import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalDocumentStatus, ClinicalEvidenceArea } from '@prisma/client';
import { publicClinicalDocument } from '../src/domain/clinical-document-metadata';

test('document metadata excludes encrypted content, patient relations and internal review claims', () => {
  const document = {
    id: 'synthetic-document',
    area: ClinicalEvidenceArea.DIABETES,
    documentType: 'LAB_RESULT',
    status: ClinicalDocumentStatus.UPLOADED,
    revision: 2,
    originalFileName: 'synthetic.pdf',
    mimeType: 'application/pdf',
    byteSize: 128,
    issuedAt: null,
    issuerName: null,
    validUntil: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    updatedAt: new Date('2026-10-10T01:00:00Z'),
    userId: 'private-member',
    user: { name: 'Private member' },
    encryptedPayload: Buffer.from('private content'),
    encryptionIv: Buffer.from('private iv'),
    encryptionAuthTag: Buffer.from('private tag'),
    sha256: 'internal-document-hash',
    claimedByNutritionistId: 'private-reviewer',
    claimedAt: new Date(),
    facts: [{ valueText: 'Private clinical fact' }],
    reviews: [{ rationale: 'Private clinical review' }],
  };
  const metadata = publicClinicalDocument(document);
  for (const field of [
    'userId',
    'user',
    'encryptedPayload',
    'encryptionIv',
    'encryptionAuthTag',
    'sha256',
    'claimedByNutritionistId',
    'claimedAt',
    'facts',
    'reviews',
  ])
    assert.equal(
      Object.prototype.hasOwnProperty.call(metadata, field),
      false,
      `${field} must not escape the metadata projection`
    );
  assert.equal(metadata.revision, 2);
  assert.equal(metadata.status, ClinicalDocumentStatus.UPLOADED);
  assert.equal(metadata.issuedAt, null);
  assert.equal(metadata.issuerName, null);
  assert.equal(metadata.validUntil, null);
  assert.equal(metadata.createdAt, document.createdAt);
  assert.equal(metadata.updatedAt, document.updatedAt);
  assert.equal(document.encryptedPayload.toString(), 'private content');
});
