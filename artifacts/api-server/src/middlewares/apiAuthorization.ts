import type { RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { getClerkProxyHost } from "./clerkProxyMiddleware";

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
]);

export function createApiAuthorization(
  identify: typeof resolveIdentity = resolveIdentity,
): RequestHandler {
  return async (req, res, next) => {
    // Express routes are case-insensitive by default; authorization must agree.
    const path = req.path.toLowerCase().replace(/\/+$/, "") || "/";
    const isRead = req.method === "GET" || req.method === "HEAD";
    const isPrivate = [...privateLists].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
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
      // Until company claims/ownership exist, a member must not modify shared records
      // or impersonate another company via client-supplied company IDs.
      if (!identity.isAdmin) {
        res.status(403).json({
          error: "현재 등록·수정·삭제는 플랫폼 관리자만 가능합니다. 회사 인증 기능은 준비 중입니다.",
          code: "ADMIN_REQUIRED",
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