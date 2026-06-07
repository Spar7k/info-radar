/**
 * Email settings persistence — read/write data/server/email_settings.json.
 * Never stores SMTP_PASS, API keys, or any credentials.
 */

import fs from "node:fs";
import path from "node:path";

const SETTINGS_PATH = path.resolve("data", "server", "email_settings.json");

export interface EmailSettings {
  to: string;
  dailyEnabled: boolean;
  dailyHour: number;
  timezone: string;
  updatedAt: string;
}

const DEFAULTS: EmailSettings = {
  to: "",
  dailyEnabled: false,
  dailyHour: 8,
  timezone: process.env["INFO_RADAR_EMAIL_TIMEZONE"] || "Asia/Shanghai",
  updatedAt: "",
};

export function loadSettings(): EmailSettings {
  if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULTS };

  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    return {
      to: typeof raw.to === "string" ? raw.to : "",
      dailyEnabled: typeof raw.dailyEnabled === "boolean" ? raw.dailyEnabled : false,
      dailyHour: 8, // always fixed
      timezone: process.env["INFO_RADAR_EMAIL_TIMEZONE"] || "Asia/Shanghai",
      updatedAt: raw.updatedAt || "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(to: string, dailyEnabled: boolean): EmailSettings {
  const dir = path.dirname(SETTINGS_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const settings: EmailSettings = {
    to: to.trim(),
    dailyEnabled,
    dailyHour: 8,
    timezone: process.env["INFO_RADAR_EMAIL_TIMEZONE"] || "Asia/Shanghai",
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
  return settings;
}
