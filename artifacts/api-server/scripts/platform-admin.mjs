import { clerkClient } from "@clerk/express";

// Offline operator command only. No HTTP bootstrap route or "first signup wins".
const [userId, action = "grant"] = process.argv.slice(2);
if (!userId?.startsWith("user_") || !["grant", "revoke"].includes(action)) {
  throw new Error("Usage: pnpm --filter @workspace/api-server admin:role user_ID [grant|revoke]");
}
if (!process.env.CLERK_SECRET_KEY) throw new Error("Clerk is not configured in this environment.");
await clerkClient.users.updateUserMetadata(userId, {
  privateMetadata: { platformRole: action === "grant" ? "platform_admin" : null },
});
console.info(`Platform administrator permission ${action === "grant" ? "granted" : "revoked"}.`);