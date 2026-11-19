import type { RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { getClerkProxyHost } from "./clerkProxyMiddleware";
import { authorizeCompanyWrite } from "../lib/companyPermissions";

export interface Identity {
  userId: string;
  isAdmin: boolean;
}

// Private metadata is writable only through Clerk's backend API, never by members.
export async function resolveIdentity(req: Parameters<RequestHandler>[0]): Promise<Identity | null> {
  const { userId, sessionId } = getAuth(req);
  if (!userId || !sessionId) return null;
  const user = await clerkClient.users.getUser(userId);
  return { userId, isAdmin: user.privateMetadata.platformRole === "platform_admin" };
}

const privateLists = new Set([
  "/project-applications", "/resume-submissions", "/talent-contact-requests", "/offer-matches",
  "/admin", // admin-only reads (e.g. /admin/events incl. hidden events)
  "/me",    // a member's own bookmarks / alert preferences
]);

export function createApiAuthorization(
  identify: typeof resolveIdentity = resolveIdentity,
  authorizeCompany: typeof authorizeCompanyWrite = authorizeCompanyWrite,
): RequestHandler {
  return async (req, res, next) => {
    // Express routes are case-insensitive by default; authorization must agree.
    const path = req.path.toLowerCase().replace(/\/+$/, "") || "/";
    const isRead = req.method === "GET" || req.method === "HEAD";
    const membership = path === "/membership" || path.startsWith("/membership/");
    // "My own data": any verified member may use it; handlers scope every query to
    // identity.userId. Never extend this to company- or admin-owned resources.
    const selfService = path === "/me" || path.startsWith("/me/");
    const isPrivate = membership || [...privateLists].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
    if (req.method === "OPTIONS" || (isRead && !isPrivate)) {
      next();
      return;
    }
    // Cookie-authenticated mutations must originate from this app, not another site.
    const origin = req.get("origin");
    if (!isRead && origin) {
      try {
        if (new URL(origin).host !== getClerkProxyHost(req)) {
          res.status(403).json({ error: "외부 사이트의 변경 요청은 허용되지 않습니다.", code: "ORIGIN_REJECTED" });
          return;
        }
      } catch {
        res.status(403).json({ error: "요청 출처를 확인할 수 없습니다.", code: "ORIGIN_REJECTED" });
        return;
      }
    }
    try {
      const identity = await identify(req);
      if (!identity) {
        res.status(401).json({ error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" });
        return;
      }
      res.locals.identity = identity;
      // Membership handlers enforce their own company-admin/reviewer rules; /me/* is self-service.
      if (!identity.isAdmin && !membership && !selfService && !await authorizeCompany(req, identity)) {
        res.status(403).json({
          error: "이 회사의 인증된 소속과 해당 작업 권한이 필요합니다.",
          code: "COMPANY_PERMISSION_REQUIRED",
        });
        return;
      }
      req.log?.info({ actorId: identity.userId }, "Authorized administrator request");
      next();
    } catch {
      req.log?.error("Unable to verify account permissions");
      res.status(503).json({ error: "계정 권한을 확인할 수 없습니다. 다시 시도하세요.", code: "AUTH_UNAVAILABLE" });
    }
  };
}