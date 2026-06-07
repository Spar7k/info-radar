/**
 * Shared email send logic — used by both CLI and server API.
 */

import nodemailer from "nodemailer";
import { loadLatest, renderEmailHtml, renderEmailText } from "./templates.ts";
import { loadEmailConfig, validateCanSend, type SmtpConfig } from "./config.ts";

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export interface SendOptions {
  /** Override the recipient (single address). When set, config EMAIL_TO is ignored. */
  toOverride?: string;
}

export async function sendRadarEmail(opts: SendOptions = {}): Promise<SendResult> {
  const config = loadEmailConfig();
  validateCanSend(config);

  const smtp = config.smtp!;
  const latest = loadLatest();
  const html = renderEmailHtml(latest);
  const text = renderEmailText(latest);
  const dateStr = latest.date || new Date().toISOString().slice(0, 10);
  const subject = `agent雷达｜今日信息日报｜${dateStr}`;

  // Prefer explicit override (API), fall back to env var default (CLI / cron)
  const to = opts.toOverride
    ? opts.toOverride
    : config.email?.to?.length
      ? config.email.to.join(", ")
      : null;

  if (!to) {
    throw new Error(
      "No recipient configured. Set INFO_RADAR_EMAIL_TO (for CLI/cron) or provide a 'to' field (for API).",
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const info = await transporter.sendMail({
    from: config.email!.from,
    to,
    subject,
    text,
    html,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted as string[],
    rejected: info.rejected as string[],
  };
}
