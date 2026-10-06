import type { ReactNode } from 'react';
import { BadgeCheck, ClipboardCheck, FileCheck2, UserRound, Video } from 'lucide-react';

import type { NutritionistApplicationForm } from '@/validation/nutritionist-application.schemas';

export const steps = [
  { label: 'Identity', icon: UserRound },
  { label: 'Credentials', icon: BadgeCheck },
  { label: 'Experience', icon: FileCheck2 },
  { label: 'Availability', icon: Video },
  { label: 'Review', icon: ClipboardCheck },
];
export const stepDescriptions = [
  {
    title: 'Your professional identity',
    subtitle: 'Provide your legal name and contact details as registered with the Professional Regulation Commission.',
  },
  {
    title: 'PRC credentials and licensure',
    subtitle:
      'Enter your license information. KAINARA checks for duplicates; an administrator verifies your credentials.',
  },
  {
    title: 'Practice experience & background',
    subtitle: 'Share your clinical background, alma mater, and years in dietetic practice.',
  },
  {
    title: 'Verification call availability (Philippine time)',
    subtitle: 'Select at least two schedules for an identity verification call with a KAINARA administrator.',
  },
  {
    title: 'Review your application',
    subtitle: 'Verify your submitted credentials before final transmission to the clinical review desk.',
  },
];
export const quickSpecializations = [
  'Clinical Nutrition',
  'Renal Nutrition',
  'Diabetes Care & Education',
  'Pediatric Nutrition',
  'Public Health & Community',
  'Sports Nutrition',
  'Bariatric & Weight Management',
];
export const quickUniversities = [
  'UP Los Baños (UPLB)',
  'University of Santo Tomas (UST)',
  'UP Diliman',
  'Philippine Women’s University',
  'University of San Carlos (USC)',
  'Manila Central University (MCU)',
];
export type Props = {
  emailVerification?: ReactNode;
  licenseHint?: string;
  error: string | null;
  errors: Record<string, string>;
  form: NutritionistApplicationForm;
  isLoading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onFieldChange: (field: keyof NutritionistApplicationForm, value: string | boolean) => void;
  onSubmit: () => void;
  step: number;
};
export type FieldProps = Pick<Props, 'errors' | 'form' | 'onFieldChange'>;
