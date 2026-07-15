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

async function sendMail(to, subject, html) {
  if (!transporter) {
    console.log(`\n[email disabled] To: ${to}\nSubject: ${subject}\n${html}\n`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'DirhamVest <no-reply@game.local>',
      to, subject, html
    });
  } catch (e) {
    console.error('Failed to send email:', e.message);
  }
}

module.exports = { sendMail };
