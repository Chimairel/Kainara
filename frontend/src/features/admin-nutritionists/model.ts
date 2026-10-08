import { getManilaDateKey } from '@/lib/manila-date';

export type ApplicationStatus =
  'SUBMITTED' | 'UNDER_REVIEW' | 'CALL_REQUIRED' | 'CALL_SCHEDULED' | 'APPROVED' | 'REJECTED' | 'ACTIVATED';

export interface NutritionistApplication {
  id: string;
  referenceCode: string;
  status: ApplicationStatus;
  fullName: string;
  email: string;
  phoneNumber: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization: string;
  yearsOfExperience: number;
  university: string;
  professionalBio: string;
  officialHeadshot?: string | null;
  photoRecentAttestedAt?: string | null;
  callVerifiedAt?: string | null;
  availableCallSlots: string[];
  callEmailSentAt?: string | null;
  scheduledCallAt?: string;
  meetingUrl?: string;
  decisionReason?: string;
  invitationSentAt?: string;
  activatedAt?: string;
  createdAt: string;
}

export interface NutritionistRow {
  id: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  verifiedExpertise?: string[];
  verifiedExperienceYears?: number | null;
  expertiseEvidence?: string | null;
  isVerified: boolean;
  totalVerified: number;
  verifiedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
    isSuspended?: boolean;
    suspensionReason?: string | null;
  };
}

export type ScheduleDraft = { scheduledCallAt: string; meetingUrl: string };
export type ApplicationActionResponse = {
  data?: { data?: { invitationEmailSent?: boolean; callEmailSent?: boolean } };
};

export const statusLabel: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  CALL_REQUIRED: 'Call required',
  CALL_SCHEDULED: 'Call scheduled',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVATED: 'Activated',
};

export function toLocalInput(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 16);
}

export function professionalAccessLabel(professional: NutritionistRow, now = new Date()): string {
  if (professional.user.role && professional.user.role !== 'NUTRITIONIST') return 'RND role not active';
  if (professional.user.isSuspended) return 'Access revoked';
  if (!professional.isVerified) return 'Verification pending';
  const expiry = new Date(professional.prcLicenseExpiry);
  if (!Number.isFinite(expiry.getTime())) return 'License date unavailable';
  return getManilaDateKey(expiry) < getManilaDateKey(now)
    ? 'License expired — review access unavailable'
    : 'Access active';
}
