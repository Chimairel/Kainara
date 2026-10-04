import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { uploadLandingMedia, removeLandingMedia } from '@/lib/cloudinary';
import { AppError } from '@/errors/AppError';
import {
  LANDING_CONTENT_ID,
  LANDING_IMAGE_BYTES,
  LANDING_VIDEO_BYTES,
  defaultLandingDraft,
  landingConfigSchema,
  landingPosterUrl,
  landingMimeTypes,
  validateLandingUpload,
  type LandingConfig,
} from '@/domain/landing-media.policy';

const parse = (value: unknown): LandingConfig | null => (value == null ? null : landingConfigSchema.parse(value));
const displayConfig = (value: unknown) => {
  const config = parse(value);
  return config ? { ...config, posterUrl: landingPosterUrl(config) } : null;
};
const json = (value: LandingConfig) => value as unknown as Prisma.InputJsonObject;
const workspace = (row: { revision: number; draft: unknown; published: unknown; publishedAt: Date | null } | null) => ({
  revision: row?.revision ?? 0,
  draft: displayConfig(row?.draft),
  published: displayConfig(row?.published),
  publishedAt: row?.publishedAt ?? null,
});

export class WebsiteContentService {
  static async getAdmin() {
    const row = await prisma.websiteContent.findUnique({ where: { id: LANDING_CONTENT_ID } });
    return workspace(row);
  }

  static async getPublic() {
    const row = await prisma.websiteContent.findUnique({
      where: { id: LANDING_CONTENT_ID },
      select: { published: true },
    });
    const config = parse(row?.published);
    if (!config?.asset) return null;
    // Public visitors receive delivery URLs only, never draft content or storage metadata.
    return {
      kind: config.asset.kind,
      url: config.asset.url,
      posterUrl: landingPosterUrl(config),
      altText: config.altText,
    };
  }

  private static async mutate(
    adminUserId: string,
    revision: number,
    action: string,
    update: (row: { draft: unknown; published: unknown }) => Prisma.WebsiteContentUpdateInput
  ) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(741020)`;
        const row = await tx.websiteContent.upsert({
          where: { id: LANDING_CONTENT_ID },
          create: { id: LANDING_CONTENT_ID },
          update: {},
        });
        if (row.revision !== revision)
          throw new AppError(
            'Website content changed in another session. Reload it before saving.',
            409,
            'WEBSITE_CONTENT_CONFLICT'
          );
        const updated = await tx.websiteContent.update({
          where: { id: LANDING_CONTENT_ID },
          data: { ...update(row), revision: { increment: 1 } },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            action,
            entityType: 'WebsiteContent',
            entityId: LANDING_CONTENT_ID,
            metadata: { revision: revision + 1 },
          },
        });
        return workspace(updated);
      },
      { maxWait: 10_000, timeout: 30_000 }
    );
  }

  static async upload(
    adminUserId: string,
    revision: number,
    slot: 'asset' | 'poster',
    file: { mimetype: string; size: number; buffer: Buffer }
  ) {
    const kind = file.mimetype.startsWith('video/') ? 'video' : 'image';
    if (
      !landingMimeTypes.includes(file.mimetype) ||
      (slot === 'poster' && kind !== 'image') ||
      file.size > (kind === 'image' ? LANDING_IMAGE_BYTES : LANDING_VIDEO_BYTES)
    )
      throw new AppError(
        'Choose an image up to 5 MB or a video up to 20 MB. The poster must be an image.',
        400,
        'INVALID_LANDING_UPLOAD'
      );
    const uploaded = await uploadLandingMedia(file.buffer, kind);
    let committed = false;
    try {
      const asset = validateLandingUpload(uploaded, kind);
      const result = await this.mutate(adminUserId, revision, 'WEBSITE_MEDIA_DRAFT_UPDATED', (row) => {
        const draft = parse(row.draft) ?? parse(row.published) ?? defaultLandingDraft();
        return { draft: json({ ...draft, [slot]: asset }) };
      });
      committed = true;
      return result;
    } finally {
      if (!committed) await removeLandingMedia(uploaded.public_id, kind).catch(() => undefined);
    }
  }

  static async saveText(adminUserId: string, revision: number, altText: string) {
    return this.mutate(adminUserId, revision, 'WEBSITE_MEDIA_DRAFT_UPDATED', (row) => {
      const draft = parse(row.draft) ?? parse(row.published) ?? defaultLandingDraft();
      return { draft: json(landingConfigSchema.parse({ ...draft, altText })) };
    });
  }

  static async publish(adminUserId: string, revision: number) {
    return this.mutate(adminUserId, revision, 'WEBSITE_MEDIA_PUBLISHED', (row) => {
      const draft = parse(row.draft);
      if (!draft?.asset)
        throw new AppError('Upload an image or video before publishing.', 400, 'WEBSITE_MEDIA_MISSING');
      return { published: json(draft), publishedAt: new Date() };
    });
  }

  static async reset(adminUserId: string, revision: number) {
    return this.mutate(adminUserId, revision, 'WEBSITE_MEDIA_RESET', () => ({
      draft: Prisma.DbNull,
      published: Prisma.DbNull,
      publishedAt: null,
    }));
  }
}
