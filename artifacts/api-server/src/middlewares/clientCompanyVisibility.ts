import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";
import type { ClientCompany } from "@workspace/api-zod";

export const CLIENT_COMPANY_MASK = "------------";

export function createClientCompanyVisibility(
  readSession: (req: Request) => { userId?: string | null; sessionId?: string | null } = (req) => getAuth(req),
): RequestHandler {
  return (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.vary("Cookie");
    res.vary("Authorization");
    try {
      const session = readSession(req);
      res.locals.canViewClientDetails = Boolean(session.userId && session.sessionId);
      next();
    } catch {
      req.log?.error("Unable to verify client directory visibility");
      res.status(503).json({ error: "로그인 상태를 확인할 수 없습니다. 다시 시도해 주세요.", code: "AUTH_UNAVAILABLE" });
    }
  };
}

/** Explicit public allowlist: new business fields must not become public accidentally. */
export function visibleClientCompany(company: ClientCompany, canViewDetails: boolean): ClientCompany {
  if (canViewDetails) return { ...company };
  return {
    no: company.no, // Stable row identity, never displayed to anonymous visitors.
    nameKo: company.nameKo,
    nameEn: company.nameEn,
    industry: company.industry,
    parentCompany: CLIENT_COMPANY_MASK,
    entryType: CLIENT_COMPANY_MASK,
    investmentType: CLIENT_COMPANY_MASK,
    industryDetail: CLIENT_COMPANY_MASK,
    region: CLIENT_COMPANY_MASK,
    address: CLIENT_COMPANY_MASK,
    postalCode: CLIENT_COMPANY_MASK,
  };
}
