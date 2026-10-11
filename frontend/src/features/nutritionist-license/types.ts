export interface CredentialStatus {
  eligible: boolean;
  reason: string | null;
  expiryDate: string | null;
  licenseNumber: string | null;
  canSubmitUpdate: boolean;
}
export interface LicenseUpdate {
  id: string;
  purpose: 'RENEWAL' | 'CORRECTION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  previousLicenseNumber: string;
  previousLicenseExpiry: string;
  proposedLicenseNumber: string;
  proposedLicenseExpiry: string;
  submissionReason: string;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  reviewerName: string | null;
  decisionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  nutritionistProfile?: { user: { name: string; email: string } };
}
export interface LicenseUpdatesPage {
  rows: LicenseUpdate[];
  pending: number;
  total: number;
  page: number;
  totalPages: number;
}
export function licenseDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const date = new Date(value.length === 10 ? `${value}T12:00:00+08:00` : value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
}
