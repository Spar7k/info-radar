/**
 * Scheduled email sender — called by cron / systemd timer at 08:00 Beijing time.
 *
 * This script does NOT check the current time itself. It assumes the OS
 * scheduler fires it at the correct moment (Asia/Shanghai 08:00).
 *
 * Dry-run: set INFO_RADAR_SCHEDULED_EMAIL_DRY_RUN=true
 */

import { loadSettings } from "../server/emailSettings.ts";
import { sendRadarEmail, type SendResult } from "./sendRadarEmail.ts";

interface LogLine {
  status: "sent" | "skipped" | "error";
  reason?: string;
  toMasked?: string;
  messageId?: string;
  acceptedCount?: number;
  rejectedCount?: number;
  error?: string;
}

function log(obj: LogLine): void {
  console.log(JSON.stringify({ ...obj, ts: new Date().toISOString() }));
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email.slice(0, 1) + "***" + email.slice(at);
  return email.slice(0, 1) + "***" + email.slice(at - 1);
}

async function main(): Promise<void> {
  const isDryRun = process.env["INFO_RADAR_SCHEDULED_EMAIL_DRY_RUN"] === "true";
  console.log(`[scheduled] Daily 08:00 (Asia/Shanghai) email task. Dry-run: ${isDryRun}`);

  // 1. Load settings
  const settings = loadSettings();

  // 2. Guard: settings file not found / empty
  if (!settings.updatedAt) {
    log({ status: "skipped", reason: "settings_not_found" });
    return;
  }

  // 3. Guard: daily disabled
  if (!settings.dailyEnabled) {
    log({ status: "skipped", reason: "daily_disabled" });
    return;
  }

  // 4. Guard: no recipient
  if (!settings.to) {
    log({ status: "skipped", reason: "recipient_missing" });
    return;
  }

  // 5. Assert time config
  if (settings.dailyHour !== 8) {
    log({ status: "skipped", reason: `unexpected_dailyHour: ${settings.dailyHour}` });
    return;
  }

  if (settings.timezone !== "Asia/Shanghai") {
    console.warn(
      `[scheduled] WARNING: timezone is "${settings.timezone}", expected "Asia/Shanghai". Proceeding anyway.`,
    );
  }

  // 6. Send enabled check
  if (process.env["INFO_RADAR_EMAIL_SEND_ENABLED"] !== "true") {
    log({ status: "skipped", reason: "send_not_enabled" });
    return;
  }

  // 7. Dry-run
  if (isDryRun) {
    console.log(`[scheduled] DRY-RUN — would send to: ${maskEmail(settings.to)}`);
    log({ status: "skipped", reason: "dry_run", toMasked: maskEmail(settings.to) });
    return;
  }

  // 8. Real send
  console.log(`[scheduled] Sending to ${maskEmail(settings.to)}...`);

  try {
    const result: SendResult = await sendRadarEmail({ toOverride: settings.to });

    log({
      status: "sent",
      toMasked: maskEmail(settings.to),
      messageId: result.messageId,
      acceptedCount: result.accepted.length,
      rejectedCount: result.rejected.length,
    });

    console.log(`[scheduled] Sent. ID: ${result.messageId}`);
  } catch (err: unknown) {
    log({ status: "error", error: String(err).slice(0, 300) });
    console.error(`[scheduled] Send failed: ${String(err).slice(0, 300)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[scheduled] Fatal:", String(err).slice(0, 300));
  process.exit(1);
});
