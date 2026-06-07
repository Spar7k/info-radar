/**
 * Task 5C CLI: Send a real email (thin wrapper around shared sendRadarEmail).
 */

import { loadEmailConfig } from "./config.ts";
import { sendRadarEmail } from "./sendRadarEmail.ts";

async function main(): Promise<void> {
  console.log("[radar:email:send] Task 5C — sending real email...\n");

  const config = loadEmailConfig();

  console.log("── Config ──");
  console.log(`  Provider:     ${config.provider}`);
  console.log(`  Send enabled: ${config.sendEnabled}`);
  if (config.smtp) {
    console.log(`  Host:         ${config.smtp.host}:${config.smtp.port} (secure: ${config.smtp.secure})`);
  }
  console.log(`  User:         ${config.smtp?.user ? "***configured***" : "(missing)"}`);
  console.log(`  Pass:         ${config.smtp?.pass ? "***configured***" : "(missing)"}`);
  console.log(`  From:         ${config.email?.from ?? "(missing)"}`);
  console.log(`  To:           ${config.email?.to?.join(", ") ?? "(missing)"}`);

  const result = await sendRadarEmail();

  console.log(`\n── Result ──`);
  console.log(`  Message ID: ${result.messageId}`);
  console.log(`  Accepted:   ${result.accepted.join(", ") || "(none)"}`);
  console.log(`  Rejected:   ${result.rejected.join(", ") || "(none)"}`);
  console.log(`\n[radar:email:send] Email sent successfully.`);
}

main().catch((err) => {
  console.error("[radar:email:send] Fatal:", err);
  process.exit(1);
});
