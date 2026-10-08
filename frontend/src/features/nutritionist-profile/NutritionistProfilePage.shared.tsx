export interface NProfile {
  id: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  acceptingReviews?: boolean;
  verifiedExpertise?: string[];
  verifiedExperienceYears?: number | null;
  expertiseEvidence?: string | null;
  yearsOfExperience?: number;
  university?: string;
  bio?: string;
  officialHeadshot?: string | null;
  isVerified: boolean;
  totalVerified: number;
  verifiedAt?: string | null;
}
export const SPECIALIZATION_SUGGESTIONS = [
  'Clinical & Community Nutrition',
  'Diabetes Management (T2D)',
  'Renal & Kidney Dietetics',
  'Hypertension & Cardiovascular',
  'Sports & Metabolic Health',
  'Pediatric & Maternal Nutrition',
];
