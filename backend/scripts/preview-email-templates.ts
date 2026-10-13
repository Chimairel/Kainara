/** Offline previews only: intercepts Brevo, uses synthetic content and never reads the database. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNutritionistInvitationEmail,
  sendNutritionistCallScheduledEmail,
  sendNutritionistApplicationSubmittedEmail,
  sendNutritionistApplicationRejectedEmail,
} from '../src/lib/email';

async function main() {
  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.BREVO_API_KEY = 'OFFLINE_PREVIEW';
  process.env.EMAIL_FROM = 'preview@example.invalid';
  process.env.FRONTEND_URL = 'https://www.kainara.site';
  delete process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH;
  const messages: Array<{ htmlContent: string; subject: string }> = [];
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, input) => {
    assert.equal(String(url), 'https://api.brevo.com/v3/smtp/email');
    assert.equal(input?.method, 'POST');
    messages.push(JSON.parse(String(input?.body)));
    return Response.json({ messageId: 'offline-preview' }, { status: 201 });
  };
  try {
    const to = 'member@example.invalid';
    await sendPasswordResetEmail(to, 'preview-reset-token', 'Andrea');
    await sendVerificationEmail(to, '483712', 'Andrea');
    await sendVerificationEmail(to, '483712', 'Andrea', 'application');
    await sendNutritionistInvitationEmail(to, 'preview-invitation-token', 'Andrea');
    await sendNutritionistCallScheduledEmail({
      to,
      applicantName: 'Andrea',
      referenceCode: 'NM-DEMO-2026',
      scheduledCallAt: '2026-10-16T02:00:00Z',
      meetingUrl: 'https://meet.example.invalid/kainara-verification',
    });
    await sendNutritionistApplicationSubmittedEmail(to, 'Andrea', 'NM-DEMO-2026');
    await sendNutritionistApplicationRejectedEmail(
      to,
      'Andrea',
      'NM-DEMO-2026',
      'The uploaded PRC registration document is not readable. Please provide a clear copy showing the license number and validity dates.'
    );
    const names = [
      'password-reset',
      'verification',
      'application-verification',
      'invitation',
      'scheduled-call',
      'application-received',
      'application-feedback',
    ];
    assert.equal(messages.length, names.length);
    const output = path.resolve(__dirname, '../.local/email-previews');
    await mkdir(output, { recursive: true });
    for (const [index, message] of messages.entries())
      await writeFile(path.join(output, `${names[index]}.html`), message.htmlContent);
    const indexHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAINARA email previews</title><body style="background:#f6f3ed;color:#173e33;font:16px/1.6 Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px"><h1>KAINARA email previews</h1><p>Synthetic preview data. No email was delivered.</p><ul>${names.map((name, index) => `<li><a style="color:#08705b" href="${name}.html">${messages[index].subject}</a></li>`).join('')}</ul></body></html>`;
    await writeFile(path.join(output, 'index.html'), indexHtml);
    console.log(`Created ${messages.length} offline email previews: ${output}`);
  } finally {
    globalThis.fetch = nativeFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
