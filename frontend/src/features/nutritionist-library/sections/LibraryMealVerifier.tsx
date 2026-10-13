'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import MealReviewAttribution from '@/components/user/MealReviewAttribution';
import { NutritionistCredentialCard } from '@/components/user/NutritionistCredentialCard';
import type { PublicVerifier } from '@/types';
import type { LibraryMeal } from '../useNutritionistLibrary';

export default function LibraryMealVerifier({ meal }: { meal: LibraryMeal }) {
  const [open, setOpen] = useState(false);
  const recorded = meal.verifiedByNutritionist;
  const verifier: PublicVerifier | null = recorded && meal.baseVerification === 'VERIFIED' && meal.status === 'APPROVED' ? {
    reviewScope: 'RECIPE', name: recorded.user.name, image: recorded.user.image,
    officialHeadshot: recorded.officialHeadshot, prcLicenseNumber: recorded.prcLicenseNumber,
    prcLicenseExpiry: recorded.prcLicenseExpiry, specialization: recorded.specialization,
    yearsOfExperience: recorded.yearsOfExperience, university: recorded.university, bio: recorded.bio,
  } : null;
  return <>
    <MealReviewAttribution verifier={verifier} onViewReviewer={() => setOpen(true)} />
    {!verifier && meal.baseVerificationBasis === 'PANLASANG_PINOY' && <p className="text-sm leading-6 text-brand-muted">The base meal is recognized from its published Panlasang Pinoy source. This does not record an individual RND approval.</p>}
    {verifier && <Modal isOpen={open} onClose={() => setOpen(false)} title="Meal verifier" size="xl"><NutritionistCredentialCard verifier={verifier} /></Modal>}
  </>;
}
