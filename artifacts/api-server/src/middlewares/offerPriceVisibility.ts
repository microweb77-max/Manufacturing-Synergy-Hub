import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

type SessionReader = (req: Request) => {
  userId?: string | null;
  sessionId?: string | null;
};

/** Only Clerk's server-verified session determines price visibility, not admin status. */
export function createOfferPriceVisibility(
  readSession: SessionReader = (req) => getAuth(req),
): RequestHandler {
  return (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.vary("Cookie");
    res.vary("Authorization");
    try {
      const { userId, sessionId } = readSession(req);
      res.locals.canViewOfferPrices = Boolean(userId && sessionId);
      next();
    } catch {
      req.log?.error("Unable to verify offer price visibility");
      res.status(503).json({
        error: "로그인 상태를 확인할 수 없습니다. 다시 시도해 주세요.",
        code: "AUTH_UNAVAILABLE",
      });
    }
  };
}

export function visibleOfferPrice<T extends { unitPrice: string }>(offer: T, canViewPrices: boolean): T {
  return { ...offer, unitPrice: canViewPrices ? offer.unitPrice : "xxx" };
}
