import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { membershipEnabled, type MembershipTierName } from '@/domain/membership.policy';
import { ASSISTANT_COOLDOWN_MS, assistantLimits, assistantWindows, type AssistantInput } from '@/domain/member-assistant.policy';
import { MembershipService } from './membership.service';

export class MemberAssistantUsageService {
  static async nextRequestAt(userId: string, now = new Date(), tx: Prisma.TransactionClient = prisma) {
    const latest = await tx.assistantRequest.findFirst({ where: { userId,
      createdAt: { gt: new Date(+now - ASSISTANT_COOLDOWN_MS) } },
      orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    return latest ? new Date(+latest.createdAt + ASSISTANT_COOLDOWN_MS) : null;
  }

  /** Owned receipt recovery only. Never reserves credits, writes a receipt or invokes a provider. */
  static async recover(userId: string, requestKey: string, now = new Date()) {
    const row = await prisma.assistantRequest.findUnique({ where: { userId_requestKey: { userId, requestKey } },
      select: { state: true, response: true, leaseUntil: true, createdAt: true, completedAt: true } });
    if (!row) return { status: 'NOT_FOUND' as const };
    if (+now - +row.createdAt >= 8 * 86400000) return { status: 'EXPIRED' as const };
    if (row.state === 'SUCCEEDED') return { status: 'SUCCEEDED' as const, reply: row.response, completedAt: (row.completedAt ?? row.createdAt).toISOString() };
    if (row.state === 'PENDING' && row.leaseUntil > now) return { status: 'RUNNING' as const };
    return { status: row.state === 'FAILED' ? 'FAILED' as const : 'EXPIRED' as const };
  }

  static async allowance(userId: string, now = new Date(), tx: Prisma.TransactionClient = prisma) {
    const membership = membershipEnabled() ? await MembershipService.state(userId, now, tx) : null;
    // A trial that has not started must not silently acquire Health credits.
    const tier: MembershipTierName = membership && membership.level !== 'TRIAL_PENDING'
      ? membership.tier === 'HEALTH' ? 'HEALTH' : membership.tier === 'LIFESTYLE' ? 'LIFESTYLE' : 'FREE' : 'FREE';
    const windows = assistantWindows(now);
    const cap = assistantLimits(tier).weekly;
    const [used, nextRequestAt] = await Promise.all([tx.assistantRequest.count({ where: {
      userId, createdAt: { gte: windows.weekStart, lt: windows.weekEnd },
      OR: [{ state: 'SUCCEEDED' }, { state: 'PENDING', leaseUntil: { gt: now } }],
    } }), this.nextRequestAt(userId, now, tx)]);
    return { tier, cap, used, remaining: Math.max(0, cap - used), resetsAt: windows.weekEnd.toISOString(),
      nextAiRequestAt: nextRequestAt?.toISOString() ?? null };
  }

  static async reserve(userId: string, input: AssistantInput) {
    // Consent is deliberately omitted from identity: prepare and confirm share a request key.
    const payloadHash = createHash('sha256').update(JSON.stringify({
      message: input.message, context: input.context, action: input.action ?? null,
    })).digest('hex');
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741024, hashtext(${userId}))`;
      const now = new Date();
      // Small, bounded receipts are retained for one full weekly window plus retry margin.
      await tx.assistantRequest.deleteMany({ where: { userId, createdAt: { lt: new Date(+now - 8 * 86400000) } } });
      const prior = await tx.assistantRequest.findUnique({ where: { userId_requestKey: { userId, requestKey: input.requestKey } } });
      if (prior) {
        if (prior.payloadHash !== payloadHash) throw new AppError('Start a new request for a changed message.', 409, 'ASSISTANT_KEY_REUSED');
        if (prior.state === 'SUCCEEDED') return { replay: prior.response, id: prior.id };
        if (prior.state === 'PENDING' && prior.leaseUntil > now) throw new AppError('Your request is still running. Please wait.', 409, 'ASSISTANT_IN_PROGRESS');
        // Replaying a failed/expired request must not start another provider attempt.
        throw new AppError('This request did not finish. Send it again as a new request.', 409, 'ASSISTANT_RETRY_NEW_KEY');
      }
      const active = await tx.assistantRequest.findFirst({ where: { userId, state: 'PENDING', leaseUntil: { gt: now } } });
      if (active) throw new AppError('Wait for your current AI request to finish.', 409, 'ASSISTANT_IN_PROGRESS');
      const retryAt = await this.nextRequestAt(userId, now, tx);
      if (retryAt) throw Object.assign(new AppError('AI requests have a one-minute cooldown. Free system help is still available.', 429, 'ASSISTANT_TOO_FAST'), { retryAt });
      const allowance = await this.allowance(userId, now, tx);
      if (!allowance.remaining) throw new AppError('Your AI credits are used for this week. Direct actions are still available.', 429, 'ASSISTANT_CREDITS_EXHAUSTED');
      const row = await tx.assistantRequest.create({ data: {
        userId, requestKey: input.requestKey, payloadHash, state: 'PENDING', createdAt: now,
        leaseUntil: new Date(+now + 90000),
      } });
      return { id: row.id, replay: null };
    });
  }

  static async prepare(userId: string, input: AssistantInput) {
    const prior = await prisma.assistantRequest.findUnique({ where: { userId_requestKey: { userId, requestKey: input.requestKey } } });
    if (!prior) return { requestKey: input.requestKey, replay: null };
    const payloadHash = createHash('sha256').update(JSON.stringify({
      message: input.message, context: input.context, action: input.action ?? null,
    })).digest('hex');
    if (payloadHash !== prior.payloadHash) throw new AppError('Start a new request for a changed message.', 409, 'ASSISTANT_KEY_REUSED');
    if (prior.state === 'SUCCEEDED') return { requestKey: input.requestKey, replay: prior.response };
    if (prior.state === 'PENDING' && prior.leaseUntil > new Date()) throw new AppError('Your request is still running. Please retry shortly to recover the reply.', 409, 'ASSISTANT_IN_PROGRESS');
    return { requestKey: randomUUID(), replay: null };
  }

  static async purgeExpired(now = new Date()) {
    return prisma.assistantRequest.deleteMany({ where: { createdAt: { lt: new Date(+now - 8 * 86400000) } } });
  }

  static async complete(id: string, response: Prisma.InputJsonValue) {
    const result = await prisma.assistantRequest.updateMany({
      where: { id, state: 'PENDING', leaseUntil: { gt: new Date() } },
      data: { state: 'SUCCEEDED', response, completedAt: new Date() },
    });
    if (result.count !== 1) throw new AppError('The request expired. No credit was spent.', 409, 'ASSISTANT_EXPIRED');
  }

  static async fail(id: string) {
    await prisma.assistantRequest.updateMany({ where: { id, state: 'PENDING' }, data: { state: 'FAILED', completedAt: new Date() } });
  }
}
