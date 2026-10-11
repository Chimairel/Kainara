import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { createHash } from 'node:crypto';
import { encryptClinicalDocument, decryptClinicalDocument } from '@/lib/clinical-document-crypto';
import {
  assertLicenseProposal,
  credentialAccessState,
  licenseExpiryAtEndOfDay,
  validateLicenseDocument,
  type LicenseUpdateInput,
} from '@/domain/nutritionist-license.policy';

const profileSelect = {
  id: true,
  userId: true,
  isVerified: true,
  prcLicenseNumber: true,
  prcLicenseExpiry: true,
  user: {
    select: {
      name: true,
      role: true,
      isSuspended: true,
      emailVerified: true,
      nutritionistApplicationInvite: { select: { status: true } },
    },
  },
} as const;
const recordSelect = {
  id: true,
  nutritionistProfileId: true,
  purpose: true,
  status: true,
  previousLicenseNumber: true,
  previousLicenseExpiry: true,
  proposedLicenseNumber: true,
  proposedLicenseExpiry: true,
  submissionReason: true,
  originalFileName: true,
  mimeType: true,
  byteSize: true,
  reviewerName: true,
  decisionReason: true,
  reviewedAt: true,
  createdAt: true,
} as const;
type Profile = Prisma.NutritionistProfileGetPayload<{ select: typeof profileSelect }>;
function assertRegistered(profile: Profile | null) {
  if (
    !profile ||
    profile.user.role !== 'NUTRITIONIST' ||
    profile.user.isSuspended ||
    !credentialAccessState(
      profile,
      profile.user.emailVerified,
      profile.user.nutritionistApplicationInvite?.status ?? null
    ).canSubmitUpdate
  )
    throw new AppError(
      'An activated, verified RND account is required. Contact an administrator about account access.',
      403,
      'LICENSE_OWNER_INELIGIBLE'
    );
  return profile;
}
async function lockProfile(tx: Prisma.TransactionClient, profileId: string) {
  // Account then professional record: suspension/role changes cannot race approval.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = (SELECT "userId" FROM "NutritionistProfile" WHERE "id" = ${profileId}) FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "NutritionistProfile" WHERE "id" = ${profileId} FOR UPDATE`;
  return tx.nutritionistProfile.findUnique({ where: { id: profileId }, select: profileSelect });
}
function conflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    throw new AppError(
      'Another update is pending, or the license number conflicts with an existing record. Reload and check the details.',
      409,
      'LICENSE_UPDATE_CONFLICT'
    );
  throw error;
}

export class NutritionistLicenseService {
  static async status(userId: string) {
    const profile = await prisma.nutritionistProfile.findUnique({ where: { userId }, select: profileSelect });
    const state = credentialAccessState(
      profile,
      profile?.user.emailVerified ?? false,
      profile?.user.nutritionistApplicationInvite?.status ?? null
    );
    return { ...state, licenseNumber: profile?.prcLicenseNumber ?? null };
  }

  static async submit(
    userId: string,
    input: LicenseUpdateInput,
    file: { buffer: Buffer; mimetype: string; originalname: string }
  ) {
    const metadata = validateLicenseDocument(file);
    const encrypted = encryptClinicalDocument(file.buffer);
    try {
      return await prisma.$transaction(async (tx) => {
        const identity = await tx.nutritionistProfile.findUnique({ where: { userId }, select: { id: true } });
        if (!identity) throw new AppError('No registered RND profile was found.', 403, 'LICENSE_OWNER_INELIGIBLE');
        const profile = assertRegistered(await lockProfile(tx, identity.id));
        assertLicenseProposal(input, profile.prcLicenseNumber, profile.prcLicenseExpiry);
        if (
          await tx.nutritionistLicenseUpdate.findFirst({
            where: { nutritionistProfileId: profile.id, status: 'PENDING' },
            select: { id: true },
          })
        )
          throw new AppError(
            'A license update is already awaiting administrator review.',
            409,
            'LICENSE_UPDATE_PENDING'
          );
        const record = await tx.nutritionistLicenseUpdate.create({
          data: {
            nutritionistProfileId: profile.id,
            purpose: input.purpose,
            previousLicenseNumber: profile.prcLicenseNumber,
            previousLicenseExpiry: profile.prcLicenseExpiry,
            proposedLicenseNumber: input.licenseNumber,
            proposedLicenseExpiry: licenseExpiryAtEndOfDay(input.expiryDate),
            submissionReason: input.reason,
            ...metadata,
            ...encrypted,
          },
          select: recordSelect,
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: userId,
            actorRole: 'NUTRITIONIST',
            actorName: profile.user.name,
            action: 'NUTRITIONIST_LICENSE_UPDATE_SUBMITTED',
            entityType: 'NutritionistLicenseUpdate',
            entityId: record.id,
            metadata: {
              purpose: input.purpose,
              previousExpiry: profile.prcLicenseExpiry.toISOString(),
              proposedExpiry: record.proposedLicenseExpiry.toISOString(),
            },
          },
        });
        return record;
      });
    } catch (error) {
      return conflict(error);
    }
  }

  static async list(
    userId: string,
    role: 'ADMIN' | 'NUTRITIONIST',
    page = 1,
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined = undefined
  ) {
    const where: Prisma.NutritionistLicenseUpdateWhereInput = {
      ...(role === 'ADMIN' ? {} : { nutritionistProfile: { userId } }),
      ...(status ? { status } : {}),
    };
    const [rows, total, pending] = await Promise.all([
      prisma.nutritionistLicenseUpdate.findMany({
        where,
        select: { ...recordSelect, nutritionistProfile: { select: { user: { select: { name: true, email: true } } } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 20,
        take: 20,
      }),
      prisma.nutritionistLicenseUpdate.count({ where }),
      prisma.nutritionistLicenseUpdate.count({
        where: { ...(role === 'ADMIN' ? {} : { nutritionistProfile: { userId } }), status: 'PENDING' },
      }),
    ]);
    return { rows, total, pending, page, totalPages: Math.ceil(total / 20) };
  }

  static async decide(adminId: string, id: string, decision: 'APPROVED' | 'REJECTED', reason: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${adminId} FOR UPDATE`;
        const actor = await tx.user.findUnique({
          where: { id: adminId },
          select: { role: true, name: true, isSuspended: true, emailVerified: true },
        });
        if (actor?.role !== 'ADMIN' || actor.isSuspended || !actor.emailVerified)
          throw new AppError('Administrator verification is required.', 403, 'LICENSE_ADMIN_REQUIRED');
        const record = await tx.nutritionistLicenseUpdate.findUnique({ where: { id }, select: recordSelect });
        if (!record) throw new AppError('License update not found.', 404, 'LICENSE_UPDATE_NOT_FOUND');
        const profile = await lockProfile(tx, record.nutritionistProfileId);
        if (record.status !== 'PENDING')
          throw new AppError(
            'This update has already been decided. Reload its history.',
            409,
            'LICENSE_UPDATE_ALREADY_DECIDED'
          );
        if (decision === 'APPROVED') {
          const evidenceRead = await tx.auditEvent.findFirst({
            where: {
              actorUserId: adminId,
              entityId: id,
              entityType: 'NutritionistLicenseUpdate',
              action: 'NUTRITIONIST_LICENSE_DOCUMENT_ACCESSED',
            },
            select: { id: true },
          });
          if (!evidenceRead)
            throw new AppError(
              'Download and check the submitted license document before approving.',
              422,
              'LICENSE_EVIDENCE_REVIEW_REQUIRED'
            );
          const owner = assertRegistered(profile);
          if (owner.userId === adminId)
            throw new AppError('An administrator cannot approve their own license.', 403, 'LICENSE_SELF_REVIEW');
          if (
            owner.prcLicenseNumber !== record.previousLicenseNumber ||
            owner.prcLicenseExpiry.getTime() !== record.previousLicenseExpiry.getTime()
          )
            throw new AppError(
              'The recorded credential changed after submission. Reject this request and ask for a new one.',
              409,
              'LICENSE_CONTEXT_CHANGED'
            );
          assertLicenseProposal(
            {
              purpose: record.purpose,
              licenseNumber: record.proposedLicenseNumber,
              expiryDate: record.proposedLicenseExpiry.toISOString().slice(0, 10),
              reason: record.submissionReason,
              consentAccepted: true,
            },
            owner.prcLicenseNumber,
            owner.prcLicenseExpiry
          );
          await tx.nutritionistProfile.update({
            where: { id: owner.id },
            data: {
              prcLicenseNumber: record.proposedLicenseNumber,
              prcLicenseExpiry: record.proposedLicenseExpiry,
              verifiedAt: new Date(),
              verifiedByAdminId: adminId,
            },
          });
        }
        const reviewedAt = new Date();
        const changed = await tx.nutritionistLicenseUpdate.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: decision,
            decisionReason: reason,
            reviewedAt,
            reviewerName: actor.name,
            reviewedByUserId: adminId,
          },
        });
        if (!changed.count)
          throw new AppError(
            'Another administrator has already decided this update.',
            409,
            'LICENSE_UPDATE_ALREADY_DECIDED'
          );
        await tx.auditEvent.create({
          data: {
            actorUserId: adminId,
            actorRole: 'ADMIN',
            actorName: actor.name,
            action: `NUTRITIONIST_LICENSE_UPDATE_${decision}`,
            entityType: 'NutritionistLicenseUpdate',
            entityId: id,
            metadata: {
              purpose: record.purpose,
              decision,
              reason,
              previousLicenseNumber: record.previousLicenseNumber,
              previousExpiry: record.previousLicenseExpiry.toISOString(),
              proposedLicenseNumber: record.proposedLicenseNumber,
              proposedExpiry: record.proposedLicenseExpiry.toISOString(),
            },
          },
        });
        if (profile)
          await tx.notification.create({
            data: {
              userId: profile.userId,
              title: `License update ${decision.toLowerCase()}`,
              message: 'Open your RND profile to view the administrator decision and current credential status.',
              type: 'NUTRITIONIST_APPLICATION',
            },
          });
        return { ...record, status: decision, decisionReason: reason, reviewerName: actor.name, reviewedAt };
      });
    } catch (error) {
      return conflict(error);
    }
  }

  static async document(userId: string, role: 'ADMIN' | 'NUTRITIONIST', id: string) {
    const identity = await prisma.nutritionistLicenseUpdate.findFirst({
      where: { id, ...(role === 'ADMIN' ? {} : { nutritionistProfile: { userId } }) },
      select: { id: true },
    });
    if (!identity) throw new AppError('License document not found.', 404, 'LICENSE_UPDATE_NOT_FOUND');
    return prisma.$transaction(async (tx) => {
      const document = await tx.nutritionistLicenseUpdate.findUniqueOrThrow({
        where: { id: identity.id },
        select: {
          encryptedPayload: true,
          encryptionIv: true,
          encryptionAuthTag: true,
          originalFileName: true,
          mimeType: true,
          sha256: true,
        },
      });
      const buffer = decryptClinicalDocument(document);
      if (createHash('sha256').update(buffer).digest('hex') !== document.sha256)
        throw new AppError('The document could not be verified.', 503, 'LICENSE_DOCUMENT_UNAVAILABLE');
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          actorRole: role,
          action: 'NUTRITIONIST_LICENSE_DOCUMENT_ACCESSED',
          entityType: 'NutritionistLicenseUpdate',
          entityId: id,
        },
      });
      return { buffer, fileName: document.originalFileName, mimeType: document.mimeType };
    });
  }
}
