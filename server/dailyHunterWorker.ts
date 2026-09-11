/**
 * Single-purpose entry point for a Replit Scheduled Deployment.
 *
 * It does not host the web app, run a timer, or contain Hunter logic. The
 * scheduled deployment calls the authenticated endpoint on the web deployment,
 * where the durable idempotency key prevents duplicate daily cycles.
 */
async function main() {
  const appUrl = process.env.DAILY_HUNTER_APP_URL?.replace(/\/+$/, "");
  const token = process.env.DAILY_HUNTER_TRIGGER_TOKEN;
  const projectProtectionToken = process.env.DAILY_HUNTER_PROJECT_PROTECTION_TOKEN;
  if (!appUrl || !token) {
    throw new Error("DAILY_HUNTER_APP_URL and DAILY_HUNTER_TRIGGER_TOKEN are required");
  }
  if (!/^https:\/\//.test(appUrl)) {
    throw new Error("DAILY_HUNTER_APP_URL must be an https URL");
  }

  const triggerUrl = new URL(`${appUrl}/api/internal/daily-hunter/trigger`);
  if (projectProtectionToken) {
    // Replit's private-deployment gate is distinct from the application bearer
    // token. It is optional because public web deployments do not need it.
    triggerUrl.searchParams.set("project-protection-bypass", projectProtectionToken);
  }
  const response = await fetch(triggerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`Daily Hunter trigger failed with HTTP ${response.status}`);
  }
  console.log(await response.text());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});