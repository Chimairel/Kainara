/** Table-based transactional email; inline light styles remain usable without embedded CSS. */
export const escapeEmailHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const emailLink = (url: string) =>
  `<a class="email-link" href="${escapeEmailHtml(url)}" style="color:#08705b;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${escapeEmailHtml(url)}</a>`;

export interface EmailLayoutOptions {
  title: string;
  kicker?: string;
  preheader?: string;
  recipientName?: string;
  contentHtml: string;
  ctaButton?: { label: string; url: string; color?: 'terracotta' | 'emerald' };
  postActionHtml?: string;
  footerNote?: string;
}

function logoUrl() {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const host = new URL(frontend).hostname;
  return ['localhost', '127.0.0.1', '[::1]'].includes(host)
    ? 'https://www.kainara.site/icons/icon-192.png'
    : `${frontend}/icons/icon-192.png`;
}

export function renderKainaraEmailLayout({
  title,
  kicker,
  preheader = title,
  recipientName,
  contentHtml,
  ctaButton,
  postActionHtml,
  footerNote,
}: EmailLayoutOptions): string {
  const buttonColor = ctaButton?.color === 'emerald' ? '#08705b' : '#eb6a38';
  const buttonText = ctaButton?.color === 'emerald' ? '#ffffff' : '#0d2219';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeEmailHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:separate; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    @media only screen and (max-width:620px) {
      .email-outer { padding:16px 12px !important; }
      .email-brand { padding:20px !important; }
      .email-content { padding:28px 22px !important; }
      .email-title { font-size:27px !important; line-height:34px !important; }
    }
    @media (prefers-color-scheme:dark) {
      .email-canvas { background-color:#071914 !important; }
      .email-surface { background-color:#0e271f !important; border-color:#24483b !important; }
      .email-copy, .email-title, .email-copy strong { color:#edf4ef !important; }
      .email-muted { color:#b1c4ba !important; }
      .email-divider { border-color:#355447 !important; }
      .email-code { background-color:#173d30 !important; color:#edf4ef !important; }
      .email-link { color:#84ddbd !important; }
    }
  </style>
</head>
<body class="email-canvas" style="margin:0;padding:0;background-color:#f6f3ed;font-family:Arial,Helvetica,sans-serif;">
  <div aria-hidden="true" style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeEmailHtml(preheader)}</div>
  <table class="email-canvas" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f3ed">
    <tr><td class="email-outer" align="center" style="padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table class="email-surface" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background-color:#ffffff;border:1px solid #dce6df;border-radius:20px;">
        <tr><td class="email-brand" bgcolor="#0e271f" style="padding:24px 32px;background-color:#0e271f;border-radius:19px 19px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="52" valign="middle"><img src="${escapeEmailHtml(logoUrl())}" alt="" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;"></td>
            <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;color:#ffffff;font-size:18px;line-height:24px;font-weight:700;letter-spacing:2px;">KAINARA</p>
              ${kicker ? `<p style="margin:3px 0 0;color:#bfd3c7;font-size:12px;line-height:18px;">${escapeEmailHtml(kicker)}</p>` : ''}
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="email-content email-copy" style="padding:36px 32px;color:#173e33;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;word-wrap:break-word;">
          <h1 class="email-title" style="margin:0 0 22px;color:#173e33;font-size:32px;line-height:39px;font-weight:700;letter-spacing:-0.5px;">${escapeEmailHtml(title)}</h1>
          ${recipientName ? `<p style="margin:0 0 16px;">Hi ${escapeEmailHtml(recipientName)},</p>` : ''}
          ${contentHtml}
          ${
            ctaButton
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;"><tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:340px;"><tr>
              <td align="center" bgcolor="${buttonColor}" style="background-color:${buttonColor};border-radius:28px;mso-padding-alt:16px 24px;">
                <a href="${escapeEmailHtml(ctaButton.url)}" target="_blank" style="display:block;padding:16px 24px;color:${buttonText};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:700;text-decoration:none;border-radius:28px;">${escapeEmailHtml(ctaButton.label)}</a>
              </td>
            </tr></table>
          </td></tr></table>`
              : ''
          }
          ${postActionHtml ? `<div class="email-muted" style="margin-top:12px;color:#587168;font-size:13px;line-height:21px;">${postActionHtml}</div>` : ''}
          ${footerNote ? `<div class="email-muted email-divider" style="margin-top:28px;padding-top:22px;border-top:1px solid #dce6df;color:#587168;font-size:14px;line-height:23px;">${footerNote}</div>` : ''}
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p class="email-muted" style="max-width:560px;margin:20px auto 0;color:#587168;font-size:12px;line-height:20px;text-align:center;">© ${new Date().getFullYear()} KAINARA. All rights reserved.<br>Automated email for your account or application.</p>
    </td></tr>
  </table>
</body>
</html>`;
}
