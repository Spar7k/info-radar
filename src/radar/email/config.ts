/**
 * SMTP configuration — read from environment variables only.
 * Never hard-coded, never written to output files.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface EmailConfig {
  from: string;
  to: string[];
}

export interface DryRunConfig {
  smtp: SmtpConfig | null;
  email: EmailConfig | null;
  missingFields: string[];
}

function envStr(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function loadEmailConfig(): DryRunConfig {
  const missing: string[] = [];

  const host = envStr("INFO_RADAR_SMTP_HOST");
  const portRaw = envStr("INFO_RADAR_SMTP_PORT");
  const secureRaw = envStr("INFO_RADAR_SMTP_SECURE");
  const user = envStr("INFO_RADAR_SMTP_USER");
  const pass = envStr("INFO_RADAR_SMTP_PASS");
  const from = envStr("INFO_RADAR_EMAIL_FROM");
  const toRaw = envStr("INFO_RADAR_EMAIL_TO");

  if (!host) missing.push("INFO_RADAR_SMTP_HOST");
  if (!portRaw) missing.push("INFO_RADAR_SMTP_PORT");
  if (!user) missing.push("INFO_RADAR_SMTP_USER");
  if (!pass) missing.push("INFO_RADAR_SMTP_PASS");
  if (!from) missing.push("INFO_RADAR_EMAIL_FROM");
  if (!toRaw) missing.push("INFO_RADAR_EMAIL_TO");

  let smtp: SmtpConfig | null = null;
  if (host && portRaw && user && pass) {
    const port = parseInt(portRaw, 10);
    smtp = {
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: secureRaw === "true",
      user,
      pass,
    };
  }

  let email: EmailConfig | null = null;
  if (from && toRaw) {
    email = {
      from,
      to: toRaw.split(",").map((s) => s.trim()).filter(Boolean),
    };
  }

  return { smtp, email, missingFields: missing };
}
