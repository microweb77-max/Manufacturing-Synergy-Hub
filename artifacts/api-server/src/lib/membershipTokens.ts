import { randomBytes, createHash } from "node:crypto";

export function newToken() { return randomBytes(32).toString("base64url"); }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function tokenIsLive(row: { status: string; expiresAt: Date }, now = new Date()) {
  return row.status === "pending" && row.expiresAt.getTime() > now.getTime();
}
export class MembershipError extends Error {
  constructor(public status: number, message: string) { super(message); }
}