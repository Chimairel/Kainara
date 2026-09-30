import nodemailer from 'nodemailer';

export const EMAIL_REQUEST_TIMEOUT_MS = 10_000;
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function smtpTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: EMAIL_REQUEST_TIMEOUT_MS,
      greetingTimeout: EMAIL_REQUEST_TIMEOUT_MS,
      socketTimeout: EMAIL_REQUEST_TIMEOUT_MS,
    });
  }
  return transporter;
}

function provider(): 'smtp' | 'brevo' {
  const value = process.env.EMAIL_PROVIDER ?? 'smtp';
  if (value !== 'smtp' && value !== 'brevo') throw new Error('EMAIL_PROVIDER must be smtp or brevo.');
  return value;
}

export async function sendTransactionalEmail(message: { to: string; subject: string; html: string }): Promise<void> {
  if (provider() === 'smtp') {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@kainara.ph';
    await smtpTransporter().sendMail({ from: `"KAINARA" <${from}>`, ...message });
    return;
  }
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error('Brevo email requires BREVO_API_KEY and a verified EMAIL_FROM address.');
  // Never forward credentials to a redirected host or retry an ambiguously delivered OTP/invitation.
  let response: Response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS),
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'KAINARA', email: from },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
      }),
    });
    if (!response.ok) throw new Error('Provider rejected request');
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== 'object' ||
      !('messageId' in result) ||
      typeof result.messageId !== 'string' ||
      !result.messageId.trim()
    ) {
      throw new Error('Provider did not acknowledge request');
    }
  } catch {
    // Provider bodies/transport errors may contain addresses, tokens or credentials.
    throw new Error('Email delivery was not confirmed. Check provider activation, verified sender and delivery logs.');
  }
}

/** Brevo verifies local configuration only; actual sender activation/delivery needs a real test. */
export async function verifyEmailTransport(): Promise<boolean> {
  try {
    if (provider() === 'brevo') return Boolean(process.env.BREVO_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
    await smtpTransporter().verify();
    return true;
  } catch {
    return false;
  }
}
