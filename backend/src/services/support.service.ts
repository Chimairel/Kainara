import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { escapeEmailHtml, renderKainaraEmailLayout } from '@/lib/email-template';
import { sendTransactionalEmail } from '@/lib/email-transport';
import { supportRequestSchema, supportReplySchema, supportListSchema, supportIdSchema, type SupportRequest } from '@/validation/support.schemas';

const categories = { ACCOUNT: 'Account help', MEALS: 'Meals and planning', GROCERIES: 'Groceries', NOTIFICATIONS: 'Notifications', OTHER: 'Other question or feedback' };
export const SUPPORT_EMAIL = 'chimairelp@gmail.com';
const field = (label: string, value: string) => `<p><strong>${label}:</strong> ${escapeEmailHtml(value)}</p>`;
const messageHtml = (message: string) => `<p style="white-space:pre-wrap;overflow-wrap:anywhere;">${escapeEmailHtml(message).replace(/\n/g, '<br/>')}</p>`;
const duplicate = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
async function adminAccount(id: string) {
  const admin = await prisma.user.findUnique({ where: { id }, select: { role: true, isSuspended: true } });
  if (!admin || admin.role !== 'ADMIN' || admin.isSuspended) throw new AppError('Administrator access required.', 403, 'FORBIDDEN');
}
const receipt = (record: { id: string; deliveryStatus: string }) => ({ reference: record.id, status: 'RECORDED' as const, deliveryStatus: record.deliveryStatus });

/** Available before onboarding/review. Request storage never depends on email delivery. */
export async function sendSupportRequest(userId: string, input: SupportRequest) {
  const request = supportRequestSchema.parse(input);
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, emailVerified: true } });
  if (!account) throw new AppError('Sign in again before contacting support.', 401, 'AUTHENTICATION_REQUIRED');
  if (!account.emailVerified) throw new AppError('Verify your email before contacting support.', 403, 'EMAIL_VERIFICATION_REQUIRED');
  const requestKey = request.requestKey ?? randomUUID();
  const where = { userId_requestKey: { userId, requestKey } };
  const existing = await prisma.supportRequest.findUnique({ where });
  if (existing) {
    if (existing.message !== request.message || existing.category !== request.category || existing.replyEmail !== (request.replyEmail ?? account.email)) throw new AppError('This request reference already belongs to another message.', 409, 'SUPPORT_KEY_CONFLICT');
    return receipt(existing);
  } // Never resend after an ambiguous provider response.
  let record;
  try {
    record = await prisma.supportRequest.create({ data: { userId, requestKey, category: request.category, replyEmail: request.replyEmail ?? account.email, message: request.message } });
  } catch (error) {
    if (!duplicate(error)) throw error;
    const prior = await prisma.supportRequest.findUniqueOrThrow({ where });
    if (prior.message !== request.message || prior.category !== request.category || prior.replyEmail !== (request.replyEmail ?? account.email)) throw new AppError('This request reference already belongs to another message.', 409, 'SUPPORT_KEY_CONFLICT');
    return receipt(prior);
  }
  const html = renderKainaraEmailLayout({ title: 'New support request', kicker: 'Contact Support',
    contentHtml: field('Reference', record.id) + field('Topic', categories[request.category]) + field('Account', account.id) +
      field('Name', account.name) + field('Account email', account.email) + field('Reply email', record.replyEmail) + field('Role', account.role) + messageHtml(request.message),
    footerNote: 'This request is saved in the Kainara admin Support inbox. The reply address was provided by the account holder.',
  });
  let deliveryStatus: 'ACCEPTED' | 'UNCONFIRMED' = 'UNCONFIRMED';
  try {
    await sendTransactionalEmail({ to: SUPPORT_EMAIL, replyTo: record.replyEmail, subject: `KAINARA — Support: ${categories[request.category]}`, html });
    deliveryStatus = 'ACCEPTED';
  } catch { /* No retry: a timeout may already have delivered the message. The inbox remains authoritative. */ }
  return receipt(await prisma.supportRequest.update({ where: { id: record.id }, data: { deliveryStatus } }));
}

export async function listSupportRequests(adminId: string, input: unknown) {
  await adminAccount(adminId);
  const { page } = supportListSchema.parse(input);
  const pageSize = 20;
  const [items, total] = await Promise.all([
    prisma.supportRequest.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, category: true, replyEmail: true, deliveryStatus: true, createdAt: true, user: { select: { name: true, email: true } },
        replies: { orderBy: { createdAt: 'desc' }, take: 1, select: { deliveryStatus: true } } } }),
    prisma.supportRequest.count(),
  ]);
  return { items, total, page, pageSize };
}
export async function getSupportRequest(adminId: string, id: string) {
  await adminAccount(adminId); supportIdSchema.parse(id);
  const record = await prisma.supportRequest.findUnique({ where: { id },
    include: { user: { select: { name: true, email: true } }, replies: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { author: { select: { name: true } } } } } });
  if (!record) throw new AppError('Support request not found.', 404, 'SUPPORT_NOT_FOUND');
  return record;
}
export async function replyToSupportRequest(adminId: string, id: string, input: unknown) {
  const request = await getSupportRequest(adminId, id);
  const reply = supportReplySchema.parse(input);
  const where = { requestId_requestKey: { requestId: id, requestKey: reply.requestKey } };
  const prior = await prisma.supportReply.findUnique({ where });
  if (prior) {
    if (prior.message !== reply.message) throw new AppError('This reply reference already belongs to another message.', 409, 'SUPPORT_KEY_CONFLICT');
    return prior;
  }
  let record;
  try {
    record = await prisma.supportReply.create({ data: { requestId: id, authorId: adminId, requestKey: reply.requestKey, message: reply.message } });
  } catch (error) {
    if (!duplicate(error)) throw error;
    const prior = await prisma.supportReply.findUniqueOrThrow({ where });
    if (prior.message !== reply.message) throw new AppError('This reply reference already belongs to another message.', 409, 'SUPPORT_KEY_CONFLICT');
    return prior;
  }
  const html = renderKainaraEmailLayout({ title: 'A reply from Kainara Support', kicker: 'Contact Support',
    contentHtml: field('Reference', id) + messageHtml(reply.message) + '<hr/>' + field('Your request', request.message),
    footerNote: 'For a follow-up, reply to this email and include your request reference.',
  });
  let deliveryStatus: 'ACCEPTED' | 'UNCONFIRMED' = 'UNCONFIRMED';
  try {
    // EMAIL_FROM is the configured, authorized sender used for authentication emails.
    await sendTransactionalEmail({ to: request.replyEmail, replyTo: SUPPORT_EMAIL, subject: `KAINARA — Support reply [${id}]`, html });
    deliveryStatus = 'ACCEPTED';
  } catch { /* Keep the reply record; never automatically retry uncertain delivery. */ }
  return prisma.supportReply.update({ where: { id: record.id }, data: { deliveryStatus } });
}
