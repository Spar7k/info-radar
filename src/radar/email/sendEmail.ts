/**
 * Task 5C: Send a real email using nodemailer.
 *
 * Guards:
 *   - INFO_RADAR_EMAIL_SEND_ENABLED must be "true"
 *   - SMTP config must be complete
 *   - Provider must be valid (or custom with explicit host)
 *
 * Does NOT modify data/latest.json, dashboard.html, or any reference files.
 */

import nodemailer from "nodemailer";
import { loadLatest, renderEmailHtml, renderEmailText, sourceDist } from "./templates.ts";
import { loadEmailConfig, validateCanSend } from "./config.ts";

async function main(): Promise<void> {
  console.log("[radar:email:send] Task 5C — sending real email...\n");

  // 1. Load data
  const latest = loadLatest();
  const top10 = latest.topRecommendations;

  // 2. Render email
  const html = renderEmailHtml(latest);
  const text = renderEmailText(latest);

  // 3. Load config & validate
  const config = loadEmailConfig();

  console.log("── Config ──");
  console.log(`  Provider:     ${config.provider}`);
  console.log(`  Send enabled: ${config.sendEnabled}`);

  validateCanSend(config);

  // validateCanSend guarantees smtp and email are non-null
  const smtp = config.smtp!;
  const toAddrs = config.email!.to;
  const from = config.email!.from;

  console.log(`  Host:         ${smtp.host}:${smtp.port} (secure: ${smtp.secure})`);
  console.log(`  User:         ***configured***`);
  console.log(`  Pass:         ***configured***`);
  console.log(`  From:         ${from}`);
  console.log(`  To:           ${toAddrs.join(", ")}`);

  const dateStr = latest.date || new Date().toISOString().slice(0, 10);
  const subject = `agent雷达｜今日信息日报｜${dateStr}`;

  console.log(`\n── Sending ──`);
  console.log(`  Subject: ${subject}`);
  console.log(`  HTML:    ${html.length} bytes`);
  console.log(`  Text:    ${text.length} bytes`);
  console.log(`  Top rec: ${top10.length}`);
  console.log(`  Sources: ${JSON.stringify(sourceDist(top10))}`);

  // 4. Create transporter
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  // 5. Send
  try {
    const info = await transporter.sendMail({
      from,
      to: toAddrs.join(", "),
      subject,
      text,
      html,
    });

    console.log(`\n── Result ──`);
    console.log(`  Message ID: ${info.messageId}`);
    console.log(`  Accepted:   ${info.accepted?.join(", ") ?? "(none)"}`);
    console.log(`  Rejected:   ${info.rejected?.join(", ") ?? "(none)"}`);
    console.log(`\n[radar:email:send] Email sent successfully.`);
  } catch (err: unknown) {
    console.error(`\n[radar:email:send] Send failed: ${String(err).slice(0, 500)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[radar:email:send] Fatal:", err);
  process.exit(1);
});
