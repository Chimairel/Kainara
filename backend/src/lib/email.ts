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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

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

function getLogoUrl(): string {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const isLocal = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
  return isLocal
    ? 'https://raw.githubusercontent.com/Chimairel/nutrimindv1/development/frontend/public/icons/icon-192.png'
    : `${frontendUrl}/icons/icon-192.png`;
}

interface EmailLayoutOptions {
  title: string;
  kicker?: string;
  recipientName?: string;
  contentHtml: string;
  ctaButton?: {
    label: string;
    url: string;
    color?: 'terracotta' | 'emerald';
  };
  footerNote?: string;
}

/**
 * Renders a consistent, mobile-responsive HTML email in KAINARA's authentic clinical theme.
 * Featuring deep pine/obsidian surfaces, emerald/terracotta brand accents, and the official circular logo.
 */
function renderKainaraEmailLayout(options: EmailLayoutOptions): string {
  const {
    title,
    kicker = 'Clinical Nutrition Intelligence',
    recipientName,
    contentHtml,
    ctaButton,
    footerNote,
  } = options;
  const currentYear = new Date().getFullYear();
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06100c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #e4ebe7;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #06100c; min-height: 100vh; padding: 36px 14px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 540px; margin: 0 auto;">
          <!-- Header Branding -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="width: 52px; height: 52px; border-radius: 50%; background-color: #0c1e17; border: 2px solid #1a4235; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45); padding: 0;">
                          <img
                            src="${logoUrl}"
                            alt="KAINARA"
                            width="52"
                            height="52"
                            style="display: block; width: 52px; height: 52px; border-radius: 50%; border: 0; outline: none; text-decoration: none;"
                          />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <span style="font-size: 20px; font-weight: 900; letter-spacing: 3px; color: #fbf8f1; text-transform: uppercase; display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      KAINARA
                    </span>
                    <span style="font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #10b981; text-transform: uppercase; display: block; margin-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      ${escapeHtml(kicker)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0c1e17; border: 1px solid #183d2f; border-radius: 20px; box-shadow: 0 20px 48px -10px rgba(0, 0, 0, 0.65); overflow: hidden;">
                <!-- Decorative Brand Accent Top Bar -->
                <tr>
                  <td style="height: 4px; line-height: 4px; font-size: 4px; background-color: #10b981; background: linear-gradient(90deg, #10b981 0%, #059669 35%, #eb6a38 75%, #f59e0b 100%);">
                    &nbsp;
                  </td>
                </tr>
                <tr>
                  <td style="padding: 34px 28px;">
                    ${
                      title
                        ? `<h1 style="font-size: 21px; font-weight: 800; color: #fbf8f1; margin: 0 0 16px; line-height: 1.3; letter-spacing: -0.02em;">${escapeHtml(
                            title
                          )}</h1>`
                        : ''
                    }
                    ${
                      recipientName
                        ? `<p style="font-size: 15px; line-height: 1.6; color: #9bb7aa; margin: 0 0 16px;">Hi <strong style="color: #ffffff;">${escapeHtml(
                            recipientName
                          )}</strong>,</p>`
                        : ''
                    }
                    
                    <div style="font-size: 14px; line-height: 1.7; color: #cbd5e1;">
                      ${contentHtml}
                    </div>

                    ${
                      ctaButton
                        ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 10px;">
                            <tr>
                              <td align="center">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td align="center" style="border-radius: 9999px; background-color: ${
                                      ctaButton.color === 'emerald' ? '#10b981' : '#eb6a38'
                                    }; box-shadow: ${
                                      ctaButton.color === 'emerald'
                                        ? '0 6px 18px rgba(16, 185, 129, 0.35)'
                                        : '0 6px 18px rgba(235, 106, 56, 0.35)'
                                    };">
                                      <a href="${ctaButton.url}" target="_blank" style="display: inline-block; background-color: ${
                                        ctaButton.color === 'emerald' ? '#10b981' : '#eb6a38'
                                      }; color: ${
                                        ctaButton.color === 'emerald' ? '#061a12' : '#ffffff'
                                      }; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; text-decoration: none; padding: 14px 34px; border-radius: 9999px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                        ${escapeHtml(ctaButton.label)}
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>`
                        : ''
                    }

                    ${
                      footerNote
                        ? `<div style="font-size: 12px; line-height: 1.65; color: #789487; margin: 24px 0 0; padding-top: 18px; border-top: 1px solid #163629;">${footerNote}</div>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Legal & Disclaimer -->
          <tr>
            <td align="center" style="padding-top: 24px; padding-bottom: 16px;">
              <p style="font-size: 11px; line-height: 1.65; color: #475e52; margin: 0; text-align: center;">
                © ${currentYear} KAINARA. All rights reserved.<br />
                AI-Assisted Clinical Nutrition &amp; Dietary System · Republic of the Philippines<br />
                <span style="color: #374a40;">This is an automated operational notification regarding your account or application.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    <p style="margin: 0 0 16px;">${
      isApplication
        ? 'Thank you for applying to the KAINARA Professional Review Team. To verify your email address and continue your registration, enter the one-time security code below:'
        : 'Welcome to KAINARA! To complete your account verification and start your personalized clinical nutrition journey, enter the one-time security code below:'
    }</p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 26px 0;">
      <tr>
        <td align="center">
          <div style="background-color: #071510; border: 1.5px solid #174837; border-radius: 16px; padding: 22px 28px; display: inline-block; text-align: center; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(16, 185, 129, 0.15);">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #10b981; text-transform: uppercase; margin-bottom: 8px;">
              One-Time Verification Code
            </div>
            <div style="letter-spacing: 12px; font-size: 34px; font-weight: 900; color: #10b981; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace; padding-left: 12px;">
              ${escapeHtml(otp)}
            </div>
          </div>
        </td>
      </tr>
    </table>
    <p style="font-size: 13px; color: #8ba395; text-align: center; margin: 0 0 6px;">
      This security code expires in <strong style="color: #f1f7f4;">15 minutes</strong>.
    </p>
    <p style="font-size: 12px; color: #5f7a6c; text-align: center; margin: 0;">
      For your security, do not share this code with anyone.
    </p>
  `;

  const html = renderKainaraEmailLayout({
    title: 'Verify Your Email Address',
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
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  const subject = `KAINARA — Password Reset Request`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">We received a request to reset the password for your KAINARA account. Click the button below to choose a new secure password:</p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #071510; border: 1px solid #16382c; border-radius: 12px; margin: 20px 0 10px; padding: 14px 18px;">
      <tr>
        <td style="font-size: 12px; line-height: 1.6; color: #8ea99f;">
          <strong style="color: #f1f7f4;">Security notice:</strong> This link is single-use and will expire in <strong style="color: #f1f7f4;">15 minutes</strong>. If you did not request a password reset, you can safely ignore this email—your account remains protected.
        </td>
      </tr>
    </table>
  `;

  const footerNote = `
    This password reset link expires in <strong style="color: #f1f7f4;">15 minutes</strong>.<br />
    If the button above does not work, copy and paste this URL into your browser:<br />
    <span style="color: #10b981; word-break: break-all;">${escapeHtml(resetLink)}</span><br /><br />
    If you did not request a password reset, your account remains secure and you can safely ignore this email.
  `;

  const html = renderKainaraEmailLayout({
    title: 'Reset Your Password',
    kicker: 'Account Security',
    recipientName: userName,
    contentHtml,
    ctaButton: {
      label: 'Reset Password',
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
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const invitationLink = `${frontendUrl}/nutritionist-invitation?token=${encodeURIComponent(invitationToken)}`;
  const subject = 'KAINARA — Welcome to the Professional Review Team (Account Activation)';

  const contentHtml = `
    <div style="background-color: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 14px; padding: 16px 20px; margin: 0 0 20px;">
      <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #10b981; text-transform: uppercase; display: block; margin-bottom: 4px;">
        ✓ Credentials Verified &amp; Approved
      </span>
      <span style="font-size: 13px; color: #d1fae5; line-height: 1.5; display: block;">
        Manual PRC credential evaluation and 1-on-1 verification call successfully completed.
      </span>
    </div>
    <p style="margin: 0 0 16px;">Congratulations! Following your manual PRC credential review and 1-on-1 verification call, your application to join the KAINARA Professional Review Team has been <strong style="color: #10b981;">approved</strong>.</p>
    <p style="margin: 0 0 16px;">Please click the button below to create your password and activate your registered nutritionist-dietitian portal workspace:</p>
  `;

  const footerNote = `
    This private activation link expires in <strong style="color: #f1f7f4;">72 hours</strong>.<br />
    If it expires, please contact KAINARA administration so a new invitation can be issued.<br />
    Direct link: <span style="color: #10b981; word-break: break-all;">${escapeHtml(invitationLink)}</span>
  `;

  const html = renderKainaraEmailLayout({
    title: 'Your Application Was Approved',
    kicker: 'Professional Review Team',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Activate Nutritionist Workspace',
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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const formattedDate = formatApplicationTime(scheduledCallAt);

  const subject = `KAINARA — 1-on-1 Verification Call Scheduled [${referenceCode}]`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">An administrator has reviewed your professional credentials and confirmed your online identity verification call.</p>
    
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #071510; border: 1px solid #16382c; border-radius: 16px; margin: 20px 0; padding: 22px;">
      <tr>
        <td>
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #10b981;">Confirmed Schedule</p>
          <p style="margin: 0 0 16px; font-size: 17px; font-weight: 800; color: #f1f7f4;">📅 ${escapeHtml(
            formattedDate
          )}</p>
          
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #8ea99f;">Application Reference</p>
          <p style="margin: 0; font-size: 15px; font-family: 'SF Mono', Consolas, monospace; font-weight: 700; color: #f59e0b; letter-spacing: 1px;">${escapeHtml(
            referenceCode
          )}</p>
        </td>
      </tr>
    </table>

    <h3 style="font-size: 14px; font-weight: 800; color: #f1f7f4; margin: 22px 0 12px; letter-spacing: -0.01em;">📋 Call Preparation Checklist:</h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.7; color: #b6c7be; margin-bottom: 20px;">
      <tr>
        <td style="vertical-align: top; width: 22px; padding: 3px 0; color: #10b981; font-weight: 700;">•</td>
        <td style="padding: 3px 0;"><strong style="color: #ffffff;">Physical PRC ID Card:</strong> Have your original, unexpired PRC license card on hand to show to the camera.</td>
      </tr>
      <tr>
        <td style="vertical-align: top; width: 22px; padding: 3px 0; color: #10b981; font-weight: 700;">•</td>
        <td style="padding: 3px 0;"><strong style="color: #ffffff;">Device &amp; Video Setup:</strong> Ensure your webcam and microphone are working in advance.</td>
      </tr>
      <tr>
        <td style="vertical-align: top; width: 22px; padding: 3px 0; color: #10b981; font-weight: 700;">•</td>
        <td style="padding: 3px 0;"><strong style="color: #ffffff;">Punctuality:</strong> Please join the video meeting room 5 minutes before the scheduled time.</td>
      </tr>
    </table>
  `;

  const footerNote = `
    Direct meeting link: <a href="${meetingUrl}" style="color: #10b981; word-break: break-all;">${escapeHtml(meetingUrl)}</a><br /><br />
    You can also track your real-time application timeline at the <a href="${frontendUrl}/nutritionist-apply" style="color: #eb6a38; text-decoration: none; font-weight: 700;">KAINARA Application Portal</a> using reference code <strong style="color: #ffffff;">${escapeHtml(referenceCode)}</strong>.
  `;

  const html = renderKainaraEmailLayout({
    title: '1-on-1 Verification Call Scheduled',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Join Video Call Room',
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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const subject = `KAINARA — Application Received [${referenceCode}]`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">Thank you for applying to join the KAINARA Professional Review Team. Your application has been successfully received and logged into our clinical credentials verification queue.</p>
    
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #071510; border: 1px solid #16382c; border-radius: 16px; margin: 20px 0; padding: 22px;">
      <tr>
        <td align="center">
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #8ea99f;">Your Tracking Reference Code</p>
          <p style="margin: 0; font-size: 24px; font-family: 'SF Mono', Consolas, 'Courier New', monospace; font-weight: 900; color: #f59e0b; letter-spacing: 3px;">${escapeHtml(
            referenceCode
          )}</p>
        </td>
      </tr>
    </table>

    <h3 style="font-size: 14px; font-weight: 800; color: #f1f7f4; margin: 22px 0 12px; letter-spacing: -0.01em;">Review Timeline &amp; Next Steps:</h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.7; color: #b6c7be; margin-bottom: 20px;">
      <tr>
        <td style="vertical-align: top; width: 26px; padding: 4px 0; color: #10b981; font-weight: 800;">1.</td>
        <td style="padding: 4px 0;"><strong style="color: #ffffff;">Credential Review:</strong> Our administrative team manually verifies your PRC license number and background with official records.</td>
      </tr>
      <tr>
        <td style="vertical-align: top; width: 26px; padding: 4px 0; color: #10b981; font-weight: 800;">2.</td>
        <td style="padding: 4px 0;"><strong style="color: #ffffff;">1-on-1 Verification Call:</strong> An administrator will review your availability slots and email you a confirmed video meeting link.</td>
      </tr>
      <tr>
        <td style="vertical-align: top; width: 26px; padding: 4px 0; color: #10b981; font-weight: 800;">3.</td>
        <td style="padding: 4px 0;"><strong style="color: #ffffff;">Workspace Activation:</strong> Following your verification call, you will receive an official invitation link to activate your registered nutritionist-dietitian portal.</td>
      </tr>
    </table>
  `;

  const footerNote = `
    Save this email for your records. You can check your application progress anytime on the <a href="${frontendUrl}/nutritionist-apply" style="color: #eb6a38; text-decoration: none; font-weight: 700;">KAINARA Application Portal</a> using your reference code.
  `;

  const html = renderKainaraEmailLayout({
    title: 'Application Received',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Track Application Status',
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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const subject = `KAINARA — Nutritionist Application Status Update [${referenceCode}]`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">Thank you for your interest in joining the KAINARA Professional Review Team. An administrator has completed the evaluation of your application (Ref: <strong style="color: #f1f7f4; font-family: monospace;">${escapeHtml(
      referenceCode
    )}</strong>).</p>
    <p style="margin: 0 0 16px;">At this time, we are unable to advance your application for the following reason:</p>
    <div style="background-color: #111a16; border-left: 4px solid #eb6a38; border-radius: 8px; padding: 16px 20px; margin: 20px 0; color: #fecdd3; font-size: 13px; line-height: 1.6;">
      <span style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #eb6a38; text-transform: uppercase; display: block; margin-bottom: 6px;">Evaluation Feedback</span>
      <span style="color: #f1f7f4; display: block;">${escapeHtml(reason)}</span>
    </div>
    <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.65;">
      If your credentials have recently been renewed or if you wish to provide additional documentation, you are welcome to submit an updated application with current PRC registration details.
    </p>
  `;

  const html = renderKainaraEmailLayout({
    title: 'Application Status Update',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'View Application Details',
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
