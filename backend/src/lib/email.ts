import { escapeEmailHtml as escapeHtml, emailLink, renderKainaraEmailLayout } from './email-template';
import { formatApplicationTime } from '@/domain/application-time';
import { sendTransactionalEmail, verifyEmailTransport } from './email-transport';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Email templates shared by SMTP and Brevo HTTPS delivery.
 *
 * SMTP uses SMTP_HOST/PORT/USER/PASS and optional EMAIL_FROM.
 * Brevo HTTPS uses EMAIL_PROVIDER=brevo, BREVO_API_KEY and verified EMAIL_FROM.
 */

export type CapturedMail = {
  type:
    | 'EMAIL_VERIFICATION'
    | 'PASSWORD_RESET'
    | 'NUTRITIONIST_INVITATION'
    | 'NUTRITIONIST_CALL_SCHEDULED'
    | 'NUTRITIONIST_APPLICATION_SUBMITTED'
    | 'NUTRITIONIST_APPLICATION_REJECTED';
  to: string;
  token?: string;
  metadata?: Record<string, unknown>;
};

async function captureTestMail(message: CapturedMail): Promise<boolean> {
  const capturePath = process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH?.trim();
  if (!capturePath) return false;
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('The test mail capture boundary requires NODE_ENV=test.');
  }
  if (!path.isAbsolute(capturePath)) {
    throw new Error('The test mail capture path must be absolute.');
  }

  await mkdir(path.dirname(capturePath), { recursive: true });
  await appendFile(capturePath, `${JSON.stringify({ ...message, capturedAt: new Date().toISOString() })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return true;
}

/**
 * Sends a 6-digit OTP verification email to the user's inbox.
 */
export async function sendVerificationEmail(
  to: string,
  otp: string,
  userName: string,
  purpose: 'account' | 'application' = 'account'
): Promise<void> {
  if (await captureTestMail({ type: 'EMAIL_VERIFICATION', to, token: otp })) return;
  const subject = `KAINARA — Verify Your Email Address`;
  const isApplication = purpose === 'application';
  const contentHtml = `
    <p style="margin:0 0 22px;">${isApplication ? 'Enter this code to verify the email address for your nutritionist application.' : 'Enter this code in KAINARA to verify your email address and continue setting up your account.'}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>
      <td class="email-code" align="center" bgcolor="#eef6ef" style="padding:20px 12px;background-color:#eef6ef;color:#173e33;">
        <p style="margin:0 0 10px;font-size:13px;line-height:20px;">Your verification code</p>
        <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:32px;line-height:40px;font-weight:700;letter-spacing:6px;">${escapeHtml(otp)}</p>
      </td>
    </tr></table>
    <p style="margin:0;">Valid for <strong>15 minutes</strong>. Do not share this code.</p>
  `;

  const html = renderKainaraEmailLayout({
    preheader: 'Verify your email address. Your code is valid for 15 minutes.',
    title: 'Verify your email',
    kicker: isApplication ? 'Nutritionist Application' : 'Account Verification',
    recipientName: userName,
    contentHtml,
    footerNote: isApplication
      ? 'If you did not apply to join KAINARA, you can safely disregard this email.'
      : 'If you did not create a KAINARA account, you can safely disregard this email.',
  });

  try {
    await sendTransactionalEmail({
      to,
      subject,
      html,
    });
    console.log(`[Email] Verification OTP sent to ${to}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send verification email to ${to}:`, error.message);
    throw new Error('Failed to send verification email. Please check email provider configuration.');
  }
}

/**
 * Sends a password reset email with a reset link containing the token.
 */
export async function sendPasswordResetEmail(to: string, resetToken: string, userName: string): Promise<void> {
  if (await captureTestMail({ type: 'PASSWORD_RESET', to, token: resetToken })) return;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const subject = `KAINARA — Password Reset Request`;

  const contentHtml =
    '<p style="margin:0;">We received a request to reset your KAINARA password. Choose a new password using the button below.</p>';
  const footerNote = `
    <p style="margin:0 0 14px;">If you didn’t request this, you can ignore this email. Your password hasn’t been changed.</p>
    <p style="margin:0 0 6px;">Button not working? Open this link in your browser:</p>
    ${emailLink(resetLink)}
  `;

  const html = renderKainaraEmailLayout({
    preheader: 'Choose a new password. This link is valid for 15 minutes.',
    postActionHtml: '<strong>Valid for 15 minutes.</strong> This link can be used once.',
    title: 'Reset your password',
    kicker: 'Account Security',
    recipientName: userName,
    contentHtml,
    ctaButton: {
      label: 'Reset password',
      url: resetLink,
      color: 'terracotta',
    },
    footerNote,
  });

  try {
    await sendTransactionalEmail({
      to,
      subject,
      html,
    });
    console.log(`[Email] Password reset email sent to ${to}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send password reset email to ${to}:`, error.message);
    throw new Error('Failed to send password reset email. Please check email provider configuration.');
  }
}

/** Sends an approved nutritionist applicant an expiring account-activation link. */
export async function sendNutritionistInvitationEmail(
  to: string,
  invitationToken: string,
  applicantName: string
): Promise<void> {
  if (await captureTestMail({ type: 'NUTRITIONIST_INVITATION', to, token: invitationToken })) return;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const invitationLink = `${frontendUrl}/nutritionist-invitation?token=${encodeURIComponent(invitationToken)}`;
  const subject = 'KAINARA — Welcome to the Professional Review Team (Account Activation)';

  const contentHtml = `
    <p style="margin:0 0 16px;">Your application to the KAINARA Professional Review Team has been approved following your PRC credential review and verification call.</p>
    <p style="margin:0;">Create your password to activate your registered nutritionist-dietitian workspace.</p>
  `;
  const footerNote = `
    <p style="margin:0 0 14px;">If the link expires, ask KAINARA administration for a new invitation.</p>
    <p style="margin:0 0 6px;">Button not working? Open this activation link:</p>
    ${emailLink(invitationLink)}
  `;

  const html = renderKainaraEmailLayout({
    preheader: 'Your application was approved. Activate your nutritionist workspace.',
    postActionHtml: 'This private activation link is valid for <strong>72 hours</strong>.',
    title: 'Your application is approved',
    kicker: 'Professional Review Team',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Activate your workspace',
      url: invitationLink,
      color: 'emerald',
    },
    footerNote,
  });

  try {
    await sendTransactionalEmail({
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist invitation sent to ${to}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send nutritionist invitation to ${to}:`, error.message);
    throw new Error('Failed to send nutritionist invitation. Please check email provider configuration.');
  }
}

export interface NutritionistCallScheduledEmailParams {
  to: string;
  applicantName: string;
  referenceCode: string;
  scheduledCallAt: string | Date;
  meetingUrl: string;
}

/**
 * Sends the applicant an email when the administrator schedules their 1-on-1 verification call.
 */
export async function sendNutritionistCallScheduledEmail(params: NutritionistCallScheduledEmailParams): Promise<void> {
  const { to, applicantName, referenceCode, scheduledCallAt, meetingUrl } = params;
  if (
    await captureTestMail({
      type: 'NUTRITIONIST_CALL_SCHEDULED',
      to,
      metadata: { referenceCode, meetingUrl, scheduledCallAt: new Date(scheduledCallAt).toISOString() },
    })
  ) {
    return;
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const formattedDate = formatApplicationTime(scheduledCallAt);

  const subject = `KAINARA — 1-on-1 Verification Call Scheduled [${referenceCode}]`;

  const contentHtml = `
    <p style="margin:0 0 24px;">Your online verification call has been scheduled. The confirmed details are below.</p>
    <p class="email-muted" style="margin:0 0 4px;color:#587168;font-size:13px;">Date and time · Manila</p>
    <p style="margin:0 0 18px;font-size:18px;line-height:28px;"><strong>${escapeHtml(formattedDate)}</strong></p>
    <p class="email-muted" style="margin:0 0 4px;color:#587168;font-size:13px;">Application reference</p>
    <p style="margin:0 0 24px;font-family:Consolas,'Courier New',monospace;overflow-wrap:anywhere;word-break:break-all;"><strong>${escapeHtml(referenceCode)}</strong></p>
    <h2 style="margin:0 0 12px;font-size:16px;line-height:24px;">Before your call</h2>
    <ul style="margin:0;padding-left:20px;">
      <li style="margin-bottom:8px;">Have your physical PRC license card ready for visual verification.</li>
      <li style="margin-bottom:8px;">Check your camera and microphone.</li>
      <li>Join the meeting room 5 minutes before the scheduled time.</li>
    </ul>
  `;
  const footerNote = `
    <p style="margin:0 0 6px;">Direct meeting link:</p>${emailLink(meetingUrl)}
    <p style="margin:14px 0 0;">You can also track your application at the <a class="email-link" href="${escapeHtml(frontendUrl)}/nutritionist-apply" style="color:#08705b;">KAINARA Application Portal</a> using reference <strong>${escapeHtml(referenceCode)}</strong>.</p>
  `;

  const html = renderKainaraEmailLayout({
    preheader: 'Your verification call is scheduled. View your confirmed meeting details.',
    title: 'Your verification call is scheduled',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Join verification call',
      url: meetingUrl,
      color: 'terracotta',
    },
    footerNote,
  });

  try {
    await sendTransactionalEmail({
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist call scheduled email sent to ${to} for call at ${formattedDate}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send call scheduled email to ${to}:`, error.message);
    throw new Error('Failed to send call scheduled email. Please check email provider configuration.');
  }
}

/**
 * Sends a confirmation email to the applicant immediately upon submitting their application.
 */
export async function sendNutritionistApplicationSubmittedEmail(
  to: string,
  applicantName: string,
  referenceCode: string
): Promise<void> {
  if (
    await captureTestMail({
      type: 'NUTRITIONIST_APPLICATION_SUBMITTED',
      to,
      metadata: { referenceCode },
    })
  ) {
    return;
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const subject = `KAINARA — Application Received [${referenceCode}]`;

  const contentHtml = `
    <p style="margin:0 0 24px;">Thank you for applying to the KAINARA Professional Review Team. Your application is ready for administrative review.</p>
    <p class="email-muted" style="margin:0 0 4px;color:#587168;font-size:13px;">Your application reference</p>
    <p style="margin:0 0 26px;font-family:Consolas,'Courier New',monospace;font-size:20px;line-height:28px;font-weight:700;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(referenceCode)}</p>
    <h2 style="margin:0 0 12px;font-size:16px;line-height:24px;">What happens next</h2>
    <ol style="margin:0;padding-left:22px;">
      <li style="margin-bottom:10px;">An administrator reviews your PRC registration details and background.</li>
      <li style="margin-bottom:10px;">You receive an email with your confirmed verification call and meeting link.</li>
      <li>After the call and successful review, an invitation lets you activate your nutritionist workspace.</li>
    </ol>
  `;
  const footerNote = '<p style="margin:0;">Save this reference. You’ll need it to check your application status.</p>';

  const html = renderKainaraEmailLayout({
    preheader: 'We received your application. Keep your reference to track its status.',
    title: 'We received your application',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Track your application',
      url: `${frontendUrl}/nutritionist-apply`,
      color: 'terracotta',
    },
    footerNote,
  });

  try {
    await sendTransactionalEmail({
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist application received email sent to ${to} (ref: ${referenceCode})`);
  } catch (error: any) {
    console.error(`[Email] Failed to send application received email to ${to}:`, error.message);
    throw new Error('Failed to send application received email. Please check email provider configuration.');
  }
}

/**
 * Sends a notification email if an application cannot be approved.
 */
export async function sendNutritionistApplicationRejectedEmail(
  to: string,
  applicantName: string,
  referenceCode: string,
  reason: string
): Promise<void> {
  if (
    await captureTestMail({
      type: 'NUTRITIONIST_APPLICATION_REJECTED',
      to,
      metadata: { referenceCode, reason },
    })
  ) {
    return;
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const subject = `KAINARA — Nutritionist Application Status Update [${referenceCode}]`;

  const contentHtml = `
    <p style="margin:0 0 20px;">An administrator has reviewed your application, reference <strong>${escapeHtml(referenceCode)}</strong>. It cannot be approved at this time.</p>
    <h2 style="margin:0 0 10px;font-size:16px;line-height:24px;">Review feedback</h2>
    <p style="margin:0 0 24px;white-space:pre-line;overflow-wrap:anywhere;">${escapeHtml(reason)}</p>
    <p style="margin:0;">If your credentials have been renewed or you have additional documentation, you can submit an updated application with your current PRC registration details.</p>
  `;

  const html = renderKainaraEmailLayout({
    preheader: 'Your application review is complete. Read the feedback and next steps.',
    title: 'An update on your application',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'View application details',
      url: `${frontendUrl}/nutritionist-apply`,
      color: 'terracotta',
    },
    footerNote: 'If you have questions regarding this decision, contact KAINARA administration.',
  });

  try {
    await sendTransactionalEmail({
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist application rejected email sent to ${to} (ref: ${referenceCode})`);
  } catch (error: any) {
    console.error(`[Email] Failed to send application rejected email to ${to}:`, error.message);
    throw new Error('Failed to send application rejected email. Please check email provider configuration.');
  }
}

/**
 * Check the selected email transport. Brevo does not send a startup test email.
 * Call this on server start to catch configuration issues early.
 */
export async function verifyEmailTransporter(): Promise<boolean> {
  const configured = await verifyEmailTransport();
  if (!configured) console.warn('[Email] Selected email provider is not configured or could not be checked.');
  return configured;
}
