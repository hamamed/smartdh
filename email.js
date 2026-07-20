// Optional email. If SMTP is not configured via environment variables,
// emails are just logged to the console so the app runs out of the box.
let transporter = null;

try {
  if (process.env.SMTP_HOST) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }
} catch (e) {
  console.warn('Email disabled (nodemailer/SMTP not ready):', e.message);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Turn a plain-text message (what an admin types) into safe paragraph HTML:
// blank lines separate paragraphs, single newlines become <br>.
function textToHtml(text) {
  return String(text || '').trim().split(/\n{2,}/).map(block =>
    `<p style="margin:0 0 16px;color:#3a4640;font-size:15px;line-height:1.6;">${
      esc(block).replace(/\n/g, '<br>')
    }</p>`
  ).join('');
}

// Build a full, email-client-safe HTML message that matches the site's look:
// a sunset-gradient header, a white card body, a CTA button and a footer with
// the play-money disclaimer + unsubscribe link. Uses tables + inline styles so
// it renders in Gmail/Outlook/Apple Mail (which strip <style> and flexbox).
function renderEmail(opts = {}) {
  const {
    siteName = 'KanzUp',
    appUrl = '#',
    logoUrl = '',
    unsubscribeUrl = '',
    preview = '',
    heading = '',
    intro = '',
    bodyHtml = '',
    lines = [],
    cta = null,                 // { text, url }
    dir = 'ltr',
    labels = {}
  } = opts;

  const L = Object.assign({
    disclaimer: 'This is a game. All coins, balances and earnings are virtual play money — nothing here involves real money or real investing.',
    tagline: 'A play-money game between friends & family.',
    unsubscribe: 'Unsubscribe from these emails',
    visit: 'Open the game'
  }, labels);

  const align = dir === 'rtl' ? 'right' : 'left';
  const body = bodyHtml || lines.map(l =>
    `<p style="margin:0 0 16px;color:#3a4640;font-size:15px;line-height:1.6;">${esc(l)}</p>`
  ).join('');

  const button = cta && cta.url ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;">
          <tr><td align="center" bgcolor="#0e9f6e" style="border-radius:12px;">
            <a href="${esc(cta.url)}" target="_blank"
               style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background:linear-gradient(135deg,#17b57e,#0b7d57);">
              ${esc(cta.text || L.visit)}
            </a>
          </td></tr>
        </table>` : '';

  return `<!doctype html>
<html dir="${dir}" lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(heading || siteName)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f3ef;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview || heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3ef;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(20,38,28,.10);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <!-- Header -->
      <tr><td align="center" bgcolor="#0e9f6e" style="background:linear-gradient(135deg,#13b07f 0%,#0b7d57 100%);padding:30px 24px;">
        ${logoUrl
          ? `<img src="${esc(logoUrl)}" alt="${esc(siteName)}" height="40" style="height:40px;max-height:40px;width:auto;display:inline-block;">`
          : `<div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:.3px;">${esc(siteName)}</div>`}
        <div style="font-size:12px;color:rgba(255,255,255,.9);margin-top:6px;">${esc(L.tagline)}</div>
      </td></tr>
      <!-- Body -->
      <tr><td align="${align}" dir="${dir}" style="padding:32px 30px 8px;">
        ${heading ? `<h1 style="margin:0 0 14px;font-size:21px;font-weight:800;color:#14261c;">${esc(heading)}</h1>` : ''}
        ${intro ? `<p style="margin:0 0 16px;color:#3a4640;font-size:15px;line-height:1.6;">${esc(intro)}</p>` : ''}
        ${body}
        ${button}
      </td></tr>
      <!-- Disclaimer -->
      <tr><td style="padding:8px 30px 26px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7e6;border:1px solid #ffe3a8;border-radius:12px;">
          <tr><td style="padding:12px 14px;color:#8a6d1e;font-size:12px;line-height:1.5;" align="${align}" dir="${dir}">
            ⚠️ ${esc(L.disclaimer)}
          </td></tr>
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td align="center" style="padding:20px 24px 28px;border-top:1px solid #e5eae2;">
        <a href="${esc(appUrl)}" target="_blank" style="color:#0b7d57;font-size:13px;font-weight:600;text-decoration:none;">${esc(L.visit)}</a>
        ${unsubscribeUrl ? `
        <div style="margin-top:10px;">
          <a href="${esc(unsubscribeUrl)}" target="_blank" style="color:#9a93a3;font-size:12px;text-decoration:underline;">${esc(L.unsubscribe)}</a>
        </div>` : ''}
        <div style="margin-top:10px;color:#b3adbd;font-size:11px;">© ${esc(siteName)} · ${esc(L.tagline)}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function sendMail(to, subject, html) {
  if (!transporter) {
    console.log(`\n[email disabled] To: ${to}\nSubject: ${subject}\n(HTML ${String(html).length} chars)\n`);
    return { ok: true, disabled: true };
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'KanzUp <no-reply@kanzup.com>',
      to, subject, html
    });
    return { ok: true };
  } catch (e) {
    console.error('Failed to send email:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendMail, renderEmail, textToHtml };
