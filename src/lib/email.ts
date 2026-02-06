/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import nodemailer from "nodemailer";
import {
  getPublicRuntimeSettings,
  getSmtpSettings,
} from "@/lib/server/runtime-settings";

function escapeHtml(input: string) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function renderEmail(subject: string, contentHtml: string) {
  const { appName, supportEmail, supportName } =
    await getPublicRuntimeSettings();
  const bg = "#0f0d16";
  const card = "#141221";
  const text = "#e9e7f5";
  const muted = "#a39fbf";
  const primary = "#7c6cf6";
  const link = primary;

  return `
  <div style="margin:0;padding:24px;background:${bg};color:${text};font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:${card};border-radius:12px;overflow:hidden;border:1px solid #201b34;">
      <thead>
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #201b34;">
            <div style="font-weight:700;font-size:18px;letter-spacing:0.2px;color:${primary};">${escapeHtml(
              appName
            )}</div>
            <div style="font-size:12px;color:${muted};margin-top:4px;">${escapeHtml(
    subject
  )}</div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:24px;line-height:1.6;color:${text};">
            ${contentHtml}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #201b34;color:${muted};font-size:12px;">
            <div>Need help? <a href="mailto:${supportEmail}" style="color:${link};text-decoration:none;">${supportEmail}</a></div>
            <div style="margin-top:4px;">${escapeHtml(supportName)}</div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

let cachedTransport: nodemailer.Transporter | null = null;
let cachedKey = "";

async function getTransporter() {
  const smtp = await getSmtpSettings();
  if (!smtp.host || !smtp.port) {
    throw new Error("SMTP settings are missing.");
  }
  const { appName, supportEmail } = await getPublicRuntimeSettings();
  const from =
    smtp.from ||
    (supportEmail ? `${appName} <${supportEmail}>` : undefined);
  const key = JSON.stringify({
    host: smtp.host,
    port: smtp.port,
    user: smtp.user ?? "",
    pass: smtp.pass ? "set" : "",
  });
  if (!cachedTransport || cachedKey !== key) {
    cachedTransport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.user || smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    cachedKey = key;
  }
  return { transport: cachedTransport, from };
}

export async function sendEmail(to: string, subject: string, html: string) {
  const { transport, from } = await getTransporter();
  await transport.sendMail({
    from,
    to,
    subject,
    html,
  });
}

export async function sendBanNotification(to: string, reason: string) {
  const safeReason = escapeHtml(reason).replace(/\r?\n/g, "<br/>");
  const subject = "Your account has been locked";
  const html = await renderEmail(
    subject,
    `
    <p style=\"margin:0 0 12px\">Hello,</p>
    <p style=\"margin:0 0 12px\">Your account has been locked by an admin; ${safeReason}.</p>
    <p style=\"margin:0 0 12px\">If you believe this is an error, please contact our support team.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendBanLiftedNotification(to: string) {
  const subject = "Your account has been unlocked";
  const html = await renderEmail(
    subject,
    `
    <p style=\"margin:0 0 12px\">Welcome back!</p>
    <p style=\"margin:0 0 12px\">Your account ban has been lifted and you now have full access to your account.</p>
    <p style=\"margin:0 0 12px\">We’re glad to have you back. If you have any questions or need assistance, feel free to reach out.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendAccountDeletedEmail(to: string) {
  const subject = "Your account was deleted";
  const html = await renderEmail(
    subject,
    `
    <p style="margin:0 0 12px">Hello,</p>
    <p style="margin:0 0 12px">Your account has been deleted by an administrator.</p>
    <p style="margin:0 0 12px">If you believe this is a mistake, please contact our support team.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const subject = "Password reset";
  const html = await renderEmail(
    subject,
    `
    <h2 style=\"margin:0 0 12px\">Reset your password 🔑</h2>
    <p style=\"margin:0 0 12px\">We received a request to reset your password. This link expires in 1 hour.</p>
    <p style=\"margin:0 0 16px\"><a href=\"${resetLink}\" style=\"background:#7c6cf6;color:#0f0d16;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:600\">Reset password</a></p>
    <p style=\"margin:0\">If you didn’t request this, you can safely ignore this email.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendVerificationEmail(to: string, verifyLink: string) {
  const subject = "Verify your email";
  const html = await renderEmail(
    subject,
    `
    <h2 style="margin:0 0 12px">Verify your email ✉️</h2>
    <p style="margin:0 0 12px">Confirm your email address to finish setting up your account.</p>
    <p style="margin:0 0 16px"><a href="${verifyLink}" style="background:#7c6cf6;color:#0f0d16;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:600">Verify email</a></p>
    <p style="margin:0">If you didn’t request this, you can safely ignore this email.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendPasswordChangedEmail(to: string) {
  const subject = "Your password was changed";
  const html = await renderEmail(
    subject,
    `
    <h2 style=\"margin:0 0 12px\">Password changed ✅</h2>
    <p style=\"margin:0 0 12px\">Your password was just updated. If this wasn’t you, contact support immediately.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendChangeEmailConfirmationEmail(params: {
  to: string;
  newEmail: string;
  approveLink: string;
}) {
  const safeNewEmail = escapeHtml(params.newEmail);
  const subject = "Approve email change";
  const html = await renderEmail(
    subject,
    `
    <h2 style="margin:0 0 12px">Approve email change</h2>
    <p style="margin:0 0 12px">We received a request to change your email to <strong>${safeNewEmail}</strong>.</p>
    <p style="margin:0 0 16px"><a href="${params.approveLink}" style="background:#7c6cf6;color:#0f0d16;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:600">Approve change</a></p>
    <p style="margin:0">If you didn’t request this, you can ignore this email.</p>
  `
  );
  await sendEmail(params.to, subject, html);
}

export async function sendOtpEmail(to: string, otp: string) {
  const subject = "Your one-time code";
  const html = await renderEmail(
    subject,
    `
    <h2 style=\"margin:0 0 12px\">Your one-time code</h2>
    <p style=\"margin:0 0 12px\">Use this code to continue signing in. It expires in 10 minutes.</p>
    <div style=\"font-size:2rem;font-weight:700;letter-spacing:0.2em;margin:16px 0 24px 0;\">${escapeHtml(
      otp
    )}</div>
    <p style=\"margin:0 0 12px\">If you did not request this, you can ignore this email.</p>
    `
  );
  await sendEmail(to, subject, html);
}

export async function sendDeleteAccountVerificationEmail(
  to: string,
  deleteLink: string
) {
  const subject = "Confirm account deletion";
  const html = await renderEmail(
    subject,
    `
    <h2 style="margin:0 0 12px">Delete your account</h2>
    <p style="margin:0 0 12px">We received a request to permanently delete your account.</p>
    <p style="margin:0 0 16px"><a href="${deleteLink}" style="background:#ef4444;color:#0f0d16;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:600">Confirm deletion</a></p>
    <p style="margin:0">If you didn’t request this, you can ignore this email.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendWelcomeEmail(to: string, username?: string) {
  const safeUser = escapeHtml(username || "there");
  const subject = "Welcome to Swush ✨";
  const html = await renderEmail(
    subject,
    `
    <h2 style=\"margin:0 0 12px\">Welcome, ${safeUser}!</h2>
    <p style=\"margin:0 0 12px\">We’re thrilled to have you. Your account is ready to go.</p>
    <p style=\"margin:0\">If you need anything, contact support.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendLoginAlertEmail(
  to: string,
  meta: { ip: string; userAgent: string; whenISO?: string }
) {
  const subject = "New login to your account";
  const when = meta.whenISO
    ? new Date(meta.whenISO).toUTCString()
    : new Date().toUTCString();
  const ua = escapeHtml(meta.userAgent || "unknown");
  const ip = escapeHtml(meta.ip || "unknown");
  const html = await renderEmail(
    subject,
    `
    <h3 style=\"margin:0 0 12px\">New login detected</h3>
    <p style=\"margin:0 0 12px\">A new sign-in to your account just occurred.</p>
    <ul style=\"margin:0 0 12px;padding-left:18px\">
      <li><strong>IP:</strong> ${ip}</li>
      <li><strong>Device:</strong> ${ua}</li>
      <li><strong>Time (UTC):</strong> ${escapeHtml(when)}</li>
    </ul>
    <p style=\"margin:0 0 12px\">If this wasn’t you, change your password immediately and contact support.</p>
    <p style=\"margin:0\">Additionally, you can check the Active Sessions in your settings menu, and revoke access to any unknown devices.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendTwoFAEnabledEmail(to: string) {
  const subject = "2FA enabled on your account";
  const html = await renderEmail(
    subject,
    `
    <p style=\"margin:0 0 12px\">You just enabled two‑factor authentication. Great choice!</p>
    <p style=\"margin:0\">If this wasn’t you, contact support.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendTwoFADisabledEmail(to: string) {
  const subject = "2FA disabled on your account";
  const html = await renderEmail(
    subject,
    `
    <p style=\"margin:0 0 12px\">Two‑factor authentication was disabled.</p>
    <p style=\"margin:0\">If this wasn’t you, secure your account and contact support.</p>
  `
  );
  await sendEmail(to, subject, html);
}

export async function sendLimitReachedEmail(
  to: string,
  opts: {
    limitName: string;
    details?: string;
  }
) {
  const subject = `Limit reached: ${opts.limitName}`;
  const html = await renderEmail(
    subject,
    `
    <h3 style="margin:0 0 12px">You've hit a limit</h3>
    <p style="margin:0 0 12px">You’ve reached the <strong>${escapeHtml(
      opts.limitName
    )}</strong> for your account.</p>
    ${
      opts.details
        ? `<p style="margin:0 0 12px">${escapeHtml(opts.details)}</p>`
        : ""
    }
    <p style="margin:0 0 12px">If you need assistance, contact our support team.</p>
    <p style="margin:0">You can also free up space by deleting old files or wait until your daily quota resets.</p>
    `
  );
  await sendEmail(to, subject, html);
}

function formatMeetingDate(date: Date, timezone?: string | null) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      dateStyle: "full",
      timeStyle: "short",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(date);
  }
}

export async function sendMeetingRequestEmailToHost(params: {
  to: string;
  hostName: string;
  guestName: string;
  guestEmail: string;
  startsAt: Date;
  timezone?: string | null;
  notes?: string | null;
  status: string;
}) {
  const subject = "New meeting request";
  const when = escapeHtml(formatMeetingDate(params.startsAt, params.timezone));
  const guest = escapeHtml(params.guestName);
  const guestEmail = escapeHtml(params.guestEmail);
  const notes = params.notes
    ? `<p style="margin:12px 0 0">Reason: ${escapeHtml(params.notes)}</p>`
    : "";
  const html = await renderEmail(
    subject,
    `
      <h2 style="margin:0 0 12px">New meeting request</h2>
      <p style="margin:0">Hi ${escapeHtml(
        params.hostName
      )}, ${guest} (${guestEmail}) requested a meeting.</p>
      <ul style="margin:16px 0 0;padding-left:18px">
        <li><strong>When:</strong> ${when}</li>
        <li><strong>Status:</strong> ${escapeHtml(params.status)}</li>
      </ul>
      ${notes}
    `
  );
  await sendEmail(params.to, subject, html);
}

export async function sendMeetingRequestEmailToGuest(params: {
  to: string;
  hostName: string;
  startsAt: Date;
  timezone?: string | null;
  status: string;
}) {
  const subject = "Meeting request received";
  const when = escapeHtml(formatMeetingDate(params.startsAt, params.timezone));
  const html = await renderEmail(
    subject,
    `
      <h2 style="margin:0 0 12px">We received your request</h2>
      <p style="margin:0">Your meeting with ${escapeHtml(
        params.hostName
      )} is ${escapeHtml(params.status)}.</p>
      <p style="margin:12px 0 0">Requested time: <strong>${when}</strong></p>
    `
  );
  await sendEmail(params.to, subject, html);
}

export async function sendMeetingDecisionEmail(params: {
  to: string;
  hostName: string;
  startsAt: Date;
  timezone?: string | null;
  accepted?: boolean;
  status?: "accepted" | "declined" | "cancelled" | "completed";
  message?: string | null;
  meetingLink?: string | null;
}) {
  const status =
    params.status ??
    (params.accepted ? "accepted" : ("declined" as const));
  const subjectMap: Record<typeof status, string> = {
    accepted: "Meeting confirmed",
    declined: "Meeting request declined",
    cancelled: "Meeting cancelled",
    completed: "Meeting completed",
  };
  const subject = subjectMap[status] ?? "Meeting update";
  const when = escapeHtml(formatMeetingDate(params.startsAt, params.timezone));
  const link = params.meetingLink
    ? `<p style="margin:12px 0 0">Meeting link: ${escapeHtml(
        params.meetingLink
      )}</p>`
    : "";
  const note = params.message
    ? `<p style="margin:12px 0 0">${escapeHtml(params.message)}</p>`
    : "";
  const html = await renderEmail(
    subject,
    `
      <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
      <p style="margin:0">Your meeting with ${escapeHtml(
        params.hostName
      )} has been ${status}.</p>
      <p style="margin:12px 0 0">Scheduled time: <strong>${when}</strong></p>
      ${link}
      ${note}
    `
  );
  await sendEmail(params.to, subject, html);
}

export async function sendMeetingReminderEmail(params: {
  to: string;
  hostName: string;
  startsAt: Date;
  timezone?: string | null;
  minutesBefore: number;
  meetingLink?: string | null;
}) {
  const subject = `Meeting reminder (${params.minutesBefore} min)`;
  const when = escapeHtml(formatMeetingDate(params.startsAt, params.timezone));
  const link = params.meetingLink
    ? `<p style="margin:12px 0 0">Meeting link: ${escapeHtml(
        params.meetingLink
      )}</p>`
    : "";
  const html = await renderEmail(
    subject,
    `
      <h2 style="margin:0 0 12px">Meeting reminder</h2>
      <p style="margin:0">Your meeting with ${escapeHtml(
        params.hostName
      )} starts in ${escapeHtml(String(params.minutesBefore))} minutes.</p>
      <p style="margin:12px 0 0">Start time: <strong>${when}</strong></p>
      ${link}
    `
  );
  await sendEmail(params.to, subject, html);
}
