/**
 * SMTP configuration — env-only, never hard-coded, never written to files.
 */

// ---------------------------------------------------------------------------
// Provider presets
// ---------------------------------------------------------------------------

interface SmtpPreset {
  host: string;
  port: number;
  secure: boolean;
}

const PRESETS: Record<string, SmtpPreset> = {
  qq:            { host: "smtp.qq.com",   port: 465, secure: true },
  netease163:    { host: "smtp.163.com",  port: 465, secure: true },
  netease126:    { host: "smtp.126.com",  port: 465, secure: true },
  neteaseyeah:   { host: "smtp.yeah.net", port: 465, secure: true },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  provider: string;
  smtp: SmtpConfig | null;
  email: EmailConfig | null;
  sendEnabled: boolean;
  missingFields: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function envStr(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadEmailConfig(): DryRunConfig {
  const missing: string[] = [];
  const provider = envStr("INFO_RADAR_EMAIL_PROVIDER") ?? "custom";
  const sendEnabled = envStr("INFO_RADAR_EMAIL_SEND_ENABLED") === "true";

  // Resolve host/port/secure: explicit env vars override preset
  const host = envStr("INFO_RADAR_SMTP_HOST") ?? PRESETS[provider]?.host;
  const portRaw = envStr("INFO_RADAR_SMTP_PORT") ?? String(PRESETS[provider]?.port ?? "");
  const secureRaw = envStr("INFO_RADAR_SMTP_SECURE") ?? String(PRESETS[provider]?.secure ?? false);

  const user = envStr("INFO_RADAR_SMTP_USER");
  const pass = envStr("INFO_RADAR_SMTP_PASS");
  const from = envStr("INFO_RADAR_EMAIL_FROM");
  const toRaw = envStr("INFO_RADAR_EMAIL_TO"); // optional — API calls provide toOverride

  if (!host) missing.push("INFO_RADAR_SMTP_HOST");
  if (!portRaw) missing.push("INFO_RADAR_SMTP_PORT");
  if (!user) missing.push("INFO_RADAR_SMTP_USER");
  if (!pass) missing.push("INFO_RADAR_SMTP_PASS");
  if (!from) missing.push("INFO_RADAR_EMAIL_FROM");
  // INFO_RADAR_EMAIL_TO is not in missingFields — it's optional when
  // the API caller provides a toOverride or the CLI provides it explicitly.

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

  // email object always requires `from`; `to` is optional
  const email: EmailConfig | null = from
    ? {
        from,
        to: toRaw ? toRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      }
    : null;

  return { provider, smtp, email, sendEnabled, missingFields: missing };
}

export function validateCanSend(cfg: DryRunConfig): void {
  if (!cfg.sendEnabled) {
    throw new Error(
      "Send not enabled. Set INFO_RADAR_EMAIL_SEND_ENABLED=true to allow real sending.\n" +
        "Run 'npm run radar:email:dry-run' first to verify configuration.",
    );
  }
  if (!cfg.smtp) {
    throw new Error(
      `SMTP config incomplete. Missing: ${cfg.missingFields.join(", ")}.\n` +
        "Run 'npm run radar:email:dry-run' to see what's missing.",
    );
  }
  if (!cfg.email?.from) {
    throw new Error("Sender not configured. Set INFO_RADAR_EMAIL_FROM.");
  }
}
