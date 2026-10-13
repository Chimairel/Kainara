import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { escapeEmailHtml, renderKainaraEmailLayout } from '@/lib/email-template';
import { sendTransactionalEmail } from '@/lib/email-transport';
import { supportRequestSchema, type SupportRequest } from '@/validation/support.schemas';

const categories = { ACCOUNT: 'Account help', MEALS: 'Meals and planning', GROCERIES: 'Groceries', NOTIFICATIONS: 'Notifications', OTHER: 'Other question or feedback' };
export const SUPPORT_EMAIL = 'chimairelp@gmail.com';

/** Support is available before onboarding/review completes. No clinical records are fetched. */
export async function sendSupportRequest(userId: string, input: SupportRequest) {
  const request = supportRequestSchema.parse(input);
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, emailVerified: true } });
  if (!account) throw new AppError('Sign in again before contacting support.', 401, 'AUTHENTICATION_REQUIRED');
  if (!account.emailVerified) throw new AppError('Verify your email before contacting support.', 403, 'EMAIL_VERIFICATION_REQUIRED');
  const reference = randomUUID();
  const field = (label: string, value: string) => `<p><strong>${label}:</strong> ${escapeEmailHtml(value)}</p>`;
  const html = renderKainaraEmailLayout({
    title: 'New support request', kicker: 'Contact Support',
    contentHtml: field('Reference', reference) + field('Topic', categories[request.category]) +
      field('Account', account.id) + field('Name', account.name) + field('Reply email', account.email) + field('Role', account.role) +
      `<p style="white-space:pre-wrap;overflow-wrap:anywhere;">${escapeEmailHtml(request.message).replace(/\n/g, '<br/>')}</p>`,
    footerNote: 'Submitted by a signed-in Kainara account. Reply to this email to contact the sender.',
  });
  try {
    await sendTransactionalEmail({ to: SUPPORT_EMAIL, replyTo: account.email, subject: `KAINARA — Support: ${categories[request.category]}`, html });
  } catch {
    // No retry: an ambiguous provider failure may already have delivered the request.
    throw new AppError('Support email could not be confirmed.', 503, 'SUPPORT_EMAIL_UNCONFIRMED');
  }
  return { reference, status: 'ACCEPTED' as const };
}
