import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import {
  NARA_ANSWER_LIMIT,
  NARA_ANSWER_PREFIX,
  naraAnswerSchema,
  naraAnswerKeys,
  matchNaraAnswer,
  naraQuestionAllowed,
  type NaraAnswer,
} from '@/domain/nara-answer.policy';
import type { AssistantReply } from './member-assistant.service';
import { normalizeAssistantQuestion } from '@/domain/member-assistant-information';

const parse = (value: unknown) => {
  const content =
    value && typeof value === 'object' && !Array.isArray(value) ? ({ ...value } as Record<string, unknown>) : value;
  if (content && typeof content === 'object') delete (content as Record<string, unknown>).lookupKeys;
  const result = naraAnswerSchema.safeParse(content);
  return result.success ? result.data : null;
};
const json = (value: NaraAnswer) => value as unknown as Prisma.InputJsonObject;
const workspace = (row: {
  id: string;
  revision: number;
  draft: unknown;
  published: unknown;
  publishedAt: Date | null;
  updatedAt: Date;
}) => ({
  ...row,
  draft: parse(row.draft),
  published: parse(row.published),
});

/** Reuse the existing revisioned content store; never share the landing-media key. */
export class NaraAnswerService {
  static async list() {
    return (
      await prisma.websiteContent.findMany({
        where: { id: { startsWith: NARA_ANSWER_PREFIX } },
        orderBy: { updatedAt: 'desc' },
        take: NARA_ANSWER_LIMIT,
      })
    ).map(workspace);
  }

  static async questions() {
    // Project only the routing index; never transfer all answer bodies on status reads.
    const rows = await prisma.$queryRaw<Array<{ keys: unknown }>>`
      SELECT published -> 'lookupKeys' AS keys FROM "WebsiteContent"
      WHERE id LIKE ${NARA_ANSWER_PREFIX + '%'} AND published IS NOT NULL LIMIT ${NARA_ANSWER_LIMIT}`;
    return rows.flatMap((row) =>
      Array.isArray(row.keys)
        ? row.keys.filter((key): key is string => typeof key === 'string' && key.length <= 240)
        : []
    );
  }

  static async reply(message: string): Promise<AssistantReply | null> {
    if (!naraQuestionAllowed(message, 'APP_HELP') && !naraQuestionAllowed(message, 'NUTRITION')) return null;
    const rows = await prisma.websiteContent.findMany({
      where: {
        id: { startsWith: NARA_ANSWER_PREFIX },
        published: { path: ['lookupKeys'], array_contains: [normalizeAssistantQuestion(message)] },
      },
      select: { published: true },
      take: 2,
    });
    const matches = rows.flatMap((row) => {
      const parsed = parse(row.published);
      return parsed && matchNaraAnswer(message, [parsed]) ? [parsed] : [];
    });
    const answer = matches.length === 1 ? matches[0] : null;
    return answer ? { text: answer.answer, links: [], source: 'SYSTEM' as const, creditsUsed: 0 } : null;
  }

  static async create(actorUserId: string, input: NaraAnswer) {
    const draft = naraAnswerSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741031)`;
      if ((await tx.websiteContent.count({ where: { id: { startsWith: NARA_ANSWER_PREFIX } } })) >= NARA_ANSWER_LIMIT)
        throw new AppError(
          'Up to 100 Nara answers can be stored. Delete an unused answer first.',
          409,
          'NARA_ANSWER_LIMIT'
        );
      const row = await tx.websiteContent.create({
        data: { id: NARA_ANSWER_PREFIX + randomUUID(), revision: 1, draft: json(draft) },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId,
          action: 'NARA_ANSWER_CREATED',
          entityType: 'WebsiteContent',
          entityId: row.id,
          metadata: { revision: row.revision },
        },
      });
      return workspace(row);
    });
  }

  static async update(
    actorUserId: string,
    id: string,
    revision: number,
    action: 'save' | 'publish' | 'unpublish' | 'delete',
    input?: NaraAnswer
  ) {
    if (!id.startsWith(NARA_ANSWER_PREFIX)) throw new AppError('Nara answer not found.', 404, 'NARA_ANSWER_NOT_FOUND');
    const draft = input ? naraAnswerSchema.parse(input) : null;
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741031)`;
      const row = await tx.websiteContent.findUnique({ where: { id } });
      if (!row) throw new AppError('Nara answer not found.', 404, 'NARA_ANSWER_NOT_FOUND');
      if (row.revision !== revision)
        throw new AppError(
          'This answer changed in another session. Reload before saving.',
          409,
          'NARA_ANSWER_CONFLICT'
        );
      let data: Prisma.WebsiteContentUpdateInput = { revision: { increment: 1 } };
      if (action === 'save') {
        if (!draft) throw new AppError('Enter a question and answer.', 400, 'NARA_ANSWER_REQUIRED');
        data.draft = json(draft);
      }
      if (action === 'publish') {
        const candidate = naraAnswerSchema.parse(row.draft);
        const keys = new Set(naraAnswerKeys(candidate));
        const others = await tx.websiteContent.findMany({
          where: { id: { startsWith: NARA_ANSWER_PREFIX, not: id } },
          select: { published: true },
          take: NARA_ANSWER_LIMIT,
        });
        if (
          others.some((other) => {
            const answer = parse(other.published);
            return answer && naraAnswerKeys(answer).some((key) => keys.has(key));
          })
        )
          throw new AppError(
            'A published answer already uses this question or alternative phrasing. Edit it before publishing.',
            409,
            'NARA_ANSWER_DUPLICATE'
          );
        data = {
          ...data,
          published: { ...json(candidate), lookupKeys: naraAnswerKeys(candidate) },
          publishedAt: new Date(),
        };
      }
      if (action === 'unpublish') data = { ...data, published: Prisma.DbNull, publishedAt: null };
      const updated = action === 'delete' ? null : await tx.websiteContent.update({ where: { id }, data });
      if (action === 'delete') await tx.websiteContent.delete({ where: { id } });
      await tx.auditEvent.create({
        data: {
          actorUserId,
          action: `NARA_ANSWER_${action.toUpperCase()}`,
          entityType: 'WebsiteContent',
          entityId: id,
          metadata: { revision: revision + 1 },
        },
      });
      return updated ? workspace(updated) : null;
    });
  }
}
