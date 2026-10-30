// Outgoing email: Resend (RESEND_API_KEY) or any SMTP server (SMTP_URL, e.g. smtps://user:pass@smtp.gmail.com:465).
// With neither set, emails are printed to the server log so the links can be used during development.
import nodemailer from "nodemailer";
import { BRAND } from "../src/config.js";

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const SMTP_URL = process.env.SMTP_URL ?? "";
const FROM = process.env.MAIL_FROM ?? `${BRAND.name} <no-reply@example.com>`;

export const MAIL_PROVIDER = RESEND_KEY ? "resend" : SMTP_URL ? "smtp" : "console";
const smtp = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Simple branded email with one button. */
function render({ heading, text, button, url, footer }) {
  const html = `<!doctype html><html><body style="margin:0;background:#f7f8fa;font-family:Arial,Helvetica,sans-serif;color:#111318">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e4e6eb;border-radius:14px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<p style="margin:0 0 18px;font-size:20px;font-weight:900">${escapeHtml(BRAND.first)}<span style="color:#c70033">${escapeHtml(BRAND.second)}</span></p>
<h1 style="margin:0 0 10px;font-size:20px">${escapeHtml(heading)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#374151">${escapeHtml(text)}</p>
<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#fa003f;color:#ffffff;font-weight:700;text-decoration:none">${escapeHtml(button)}</a>
<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(footer)}<br>${escapeHtml(url)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { html, text: `${heading}\n\n${text}\n\n${button}: ${url}\n\n${footer}` };
}

async function send(to, subject, body) {
  const { html, text } = render(body);
  if (MAIL_PROVIDER === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }
  if (MAIL_PROVIDER === "smtp") {
    await smtp.sendMail({ from: FROM, to, subject, html, text });
    return;
  }
  console.log(`\n[mail → ${to}] ${subject}\n${text}\n`);
}

export const sendVerifyEmail = (to, url) =>
  send(to, `Verify your ${BRAND.name} email`, {
    heading: "Confirm your email",
    text: "Tap the button to confirm this is your email address. Then you can top up and start cloud phones.",
    button: "Verify email",
    url,
    footer: "The link works for 24 hours. If you didn't create an account, ignore this email.",
  });

export const sendResetEmail = (to, url) =>
  send(to, `Reset your ${BRAND.name} password`, {
    heading: "Reset your password",
    text: "Someone (hopefully you) asked to reset the password for this account. Tap the button to choose a new one.",
    button: "Choose a new password",
    url,
    footer: "The link works for 1 hour and only once. If you didn't ask for this, ignore this email — your password stays the same.",
  });

/** Account notices (phone expiring / expired / deleted) with one button back to the dashboard. */
export const sendNotice = (to, { subject, heading, text, button, url }) =>
  send(to, subject, { heading, text, button, url, footer: `You're getting this because you have a ${BRAND.name} account.` });
