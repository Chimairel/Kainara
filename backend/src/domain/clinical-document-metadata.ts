import type { ClinicalDocumentStatus, ClinicalEvidenceArea } from '@prisma/client';

export function publicClinicalDocument<
  T extends {
    id: string;
    area: ClinicalEvidenceArea;
    documentType: string;
    status: ClinicalDocumentStatus;
    revision: number;
    originalFileName: string;
    mimeType: string;
    byteSize: number;
    issuedAt: Date | null;
    issuerName: string | null;
    validUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(document: T) {
  return {
    id: document.id,
    area: document.area,
    documentType: document.documentType,
    status: document.status,
    revision: document.revision,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    issuedAt: document.issuedAt,
    issuerName: document.issuerName,
    validUntil: document.validUntil,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
