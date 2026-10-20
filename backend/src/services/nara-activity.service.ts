import { z } from 'zod';
import prisma from '@/lib/prisma';
import { assistantEnabled } from '@/domain/member-assistant.policy';
import { assistantAiQuestion } from '@/domain/member-assistant-information';
import { AppError } from '@/errors/AppError';

export const NARA_ACTIVITY_DAYS = 30;
export const naraActivityInput = z
  .object({ requestKey: z.uuid(), message: z.string().trim().min(1).max(1000) })
  .strict();
export const naraActivityQuery = z
  .object({
    search: z.string().trim().max(120).optional(),
    cursor: z.string().min(1).max(100).optional(),
  })
  .strict();

export class NaraActivityService {
  static async record(userId: string, input: z.infer<typeof naraActivityInput>) {
    if (!assistantEnabled()) throw new AppError('Nara is not available.', 503, 'ASSISTANT_DISABLED');
    const parsed = naraActivityInput.parse(input);
    // A confirmation, replay or retry keeps the same submitted-message identity.
    await prisma.assistantMessageLog.createMany({
      data: [{ userId, ...parsed, mode: assistantAiQuestion(parsed.message) === null ? 'STANDARD' : 'AI_REQUEST' }],
      skipDuplicates: true,
    });
  }

  static async list(actorUserId: string, input: z.infer<typeof naraActivityQuery>, now = new Date()) {
    const query = naraActivityQuery.parse(input);
    const cutoff = new Date(+now - NARA_ACTIVITY_DAYS * 86400000);
    const rows = await prisma.assistantMessageLog.findMany({
      where: {
        createdAt: { gte: cutoff },
        ...(query.search ? { message: { contains: query.search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 26,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        message: true,
        mode: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    await prisma.auditEvent.create({
      data: {
        actorUserId,
        action: 'NARA_ACTIVITY_VIEWED',
        entityType: 'AssistantMessageLog',
        metadata: { returned: Math.min(rows.length, 25), filtered: Boolean(query.search) },
      },
    });
    return {
      items: rows.slice(0, 25),
      nextCursor: rows.length > 25 ? rows[24].id : null,
      retentionDays: NARA_ACTIVITY_DAYS,
    };
  }

  static async purgeExpired(now = new Date()) {
    return prisma.assistantMessageLog.deleteMany({
      where: { createdAt: { lt: new Date(+now - NARA_ACTIVITY_DAYS * 86400000) } },
    });
  }
}
