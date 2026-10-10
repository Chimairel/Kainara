import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { decryptClinicalDocument } from '@/lib/clinical-document-crypto';
import { ClinicalDocumentStatus } from '@prisma/client';
import type { healthDetailsRequirements } from '@/domain/health-details.policy';
import { ReviewRoutingService } from './review-routing.service';

export const CLINICAL_DOCUMENT_CLAIM_TTL_MS = 30 * 60 * 1000;
const CLAIM_TTL_MS = CLINICAL_DOCUMENT_CLAIM_TTL_MS;

export async function fileForUser(userId: string, documentId: string) {
  const document = await prisma.clinicalDocument.findFirst({ where: { id: documentId, userId } });
  if (!document) throw new AppError('Clinical document not found.', 404, 'CLINICAL_DOCUMENT_NOT_FOUND');
  await prisma.auditEvent.create({
    data: {
      actorUserId: userId,
      action: 'CLINICAL_DOCUMENT_ACCESSED',
      entityType: 'ClinicalDocument',
      entityId: document.id,
      metadata: { access: 'OWNER' },
    },
  });
  return { buffer: decryptClinicalDocument(document), mime: document.mimeType, fileName: document.originalFileName };
}

export async function fileForClaimedReview(nutritionistProfileId: string, actorUserId: string, documentId: string) {
  await ReviewRoutingService.assertDocument(nutritionistProfileId, documentId);
  const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
  const document = await prisma.clinicalDocument.findFirst({
    where: {
      id: documentId,
      claimedByNutritionistId: nutritionistProfileId,
      claimedAt: { gte: cutoff },
      status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] },
    },
  });
  if (!document)
    throw new AppError('Open and claim this document before accessing it.', 409, 'CLINICAL_DOCUMENT_CLAIM_REQUIRED');
  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action: 'CLINICAL_DOCUMENT_ACCESSED',
      entityType: 'ClinicalDocument',
      entityId: document.id,
      metadata: { access: 'RND_REVIEW' },
    },
  });
  return { buffer: decryptClinicalDocument(document), mime: document.mimeType, fileName: document.originalFileName };
}

export async function fileForClaimedProfileWork(
  nutritionistProfileId: string,
  actorUserId: string,
  userId: string,
  documentId: string
) {
  await ReviewRoutingService.assertDocument(nutritionistProfileId, documentId);
  const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
  const document = await prisma.clinicalDocument.findFirst({
    where: {
      id: documentId,
      userId,
      claimedByNutritionistId: nutritionistProfileId,
      claimedAt: { gte: cutoff },
      status: { not: ClinicalDocumentStatus.WITHDRAWN },
    },
  });
  if (!document)
    throw new AppError('Open and claim this document before accessing it.', 409, 'CLINICAL_DOCUMENT_CLAIM_REQUIRED');
  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action: 'CLINICAL_DOCUMENT_ACCESSED',
      entityType: 'ClinicalDocument',
      entityId: document.id,
      metadata: { access: 'RND_PROFILE_WORK' },
    },
  });
  return { buffer: decryptClinicalDocument(document), mime: document.mimeType, fileName: document.originalFileName };
}

export async function fileForClaimedMealReview(
  nutritionistProfileId: string,
  actorUserId: string,
  mealPlanId: string,
  documentId: string,
  requirementsForUser: (userId: string) => Promise<ReturnType<typeof healthDetailsRequirements>>
) {
  await ReviewRoutingService.assertMeal(nutritionistProfileId, mealPlanId);
  const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
  const meal = await prisma.mealPlan.findFirst({
    where: {
      id: mealPlanId,
      claimedByNutritionistId: nutritionistProfileId,
      claimedAt: { gte: cutoff },
      status: 'PENDING_REVIEW',
    },
    select: { userId: true },
  });
  if (!meal) throw new AppError('A current meal-review claim is required.', 409, 'MEAL_REVIEW_CLAIM_REQUIRED');
  const document = await prisma.clinicalDocument.findFirst({
    where: {
      id: documentId,
      userId: meal.userId,
      status: ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW,
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
  });
  if (!document) throw new AppError('Current supporting document not found.', 404, 'CLINICAL_DOCUMENT_NOT_FOUND');
  const requirements = await requirementsForUser(meal.userId);
  if (!requirements.some((item) => item.readyDocumentIds.includes(document.id)))
    throw new AppError(
      'This document is not part of the current meal-review evidence.',
      403,
      'CLINICAL_DOCUMENT_NOT_IN_SCOPE'
    );
  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action: 'CLINICAL_DOCUMENT_ACCESSED',
      entityType: 'ClinicalDocument',
      entityId: document.id,
      metadata: { access: 'MEAL_REVIEW', mealPlanId },
    },
  });
  return { buffer: decryptClinicalDocument(document), mime: document.mimeType, fileName: document.originalFileName };
}
