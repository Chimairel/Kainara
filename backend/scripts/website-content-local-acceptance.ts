import assert from 'node:assert/strict';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import prisma from '../src/lib/prisma';
import { WebsiteContentService as Content } from '../src/services/website-content.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL || 'missing:');
  if (target.hostname !== '127.0.0.1' || target.port !== '55473' || target.pathname !== '/landing_media_tests')
    throw new Error('This acceptance script only uses the disposable landing_media_tests database at 127.0.0.1:55473.');
  process.env.CLOUDINARY_URL = 'cloudinary://fixture-key:fixture-secret@fixture';
  const admin = await prisma.user.create({
    data: {
      name: 'Synthetic Website Admin',
      email: 'website-acceptance@example.invalid',
      passwordHash: 'no-real-login',
      passwordLoginEnabled: false,
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  const originalUpload = cloudinary.uploader.upload_stream;
  const originalDestroy = cloudinary.uploader.destroy;
  let result = {
    public_id: 'nutrimind/landing/fixture-image',
    resource_type: 'image',
    format: 'png',
    secure_url: 'https://res.cloudinary.com/fixture/image/upload/v1/nutrimind/landing/fixture-image.png',
    width: 1280,
    height: 720,
    bytes: 1000,
  } as UploadApiResponse;
  // Provider traffic is intercepted; persistence, advisory locking and audits use real PostgreSQL.
  cloudinary.uploader.upload_stream = ((
    _options: unknown,
    callback: (error: null, value: UploadApiResponse) => void
  ) => ({ end: () => callback(null, result) })) as unknown as typeof originalUpload;
  cloudinary.uploader.destroy = (async () => ({ result: 'ok' })) as typeof originalDestroy;
  try {
    assert.equal(await Content.getPublic(), null);
    const file = { mimetype: 'image/png', size: 1000, buffer: Buffer.from('fixture-only') };
    const draft = await Content.upload(admin.id, 0, 'asset', file);
    assert.equal(draft.revision, 1);
    assert.equal(await Content.getPublic(), null);
    await Content.publish(admin.id, 1);
    assert.equal((await Content.getPublic())?.kind, 'image');
    const beforeConflict = await Content.getAdmin();
    await assert.rejects(() => Content.reset(admin.id, 1), /another session/);
    assert.deepEqual(await Content.getAdmin(), beforeConflict);
    result = {
      ...result,
      public_id: 'nutrimind/landing/fixture-video',
      resource_type: 'video',
      format: 'mp4',
      duration: 10,
      secure_url: 'https://res.cloudinary.com/fixture/video/upload/v1/nutrimind/landing/fixture-video.mp4',
    };
    await Content.upload(admin.id, 2, 'asset', { ...file, mimetype: 'video/mp4' });
    assert.equal((await Content.getPublic())?.kind, 'image');
    await Content.publish(admin.id, 3);
    assert.equal((await Content.getPublic())?.kind, 'video');
    await Content.reset(admin.id, 4);
    assert.equal(await Content.getPublic(), null);
    assert.equal((await Content.getAdmin()).draft, null);
    const audits = await prisma.auditEvent.count({ where: { actorUserId: admin.id, entityType: 'WebsiteContent' } });
    assert.equal(audits, 5);
    console.log(
      JSON.stringify({
        result: 'passed',
        database: 'disposable-local',
        provider: 'intercepted',
        persistedAuditEvents: audits,
        finalRevision: 5,
      })
    );
  } finally {
    cloudinary.uploader.upload_stream = originalUpload;
    cloudinary.uploader.destroy = originalDestroy;
    await prisma.websiteContent.deleteMany({ where: { id: 'landing-hero' } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: admin.id, entityType: 'WebsiteContent' } });
    await prisma.user.delete({ where: { id: admin.id } });
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
