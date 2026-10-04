import { db, companyMembersTable, companyVerificationsTable, supplyOffersTable, projectsTable, talentPostsTable, companiesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import type { Identity } from "../middlewares/apiAuthorization";

export const editableCompanyFields = new Set(["name", "description", "location", "capabilityTags", "techSpecs", "phone", "kakaoTalkId", "logoUrl"]);
export async function memberRole(userId: string, companyId: number) {
  const [row] = await db.select({ role: companyMembersTable.role }).from(companyMembersTable)
    .innerJoin(companyVerificationsTable, eq(companyVerificationsTable.companyId, companyMembersTable.companyId))
    .where(and(eq(companyMembersTable.userId, userId), eq(companyMembersTable.companyId, companyId)));
  return row?.role ?? null;
}
export async function authorizeCompanyWrite(req: Request, identity: Identity): Promise<boolean> {
  const path = req.path.toLowerCase().replace(/\/+$/, "");
  const method = req.method;
  const company = /^\/companies\/(\d+)$/.exec(path);
  if (company && method === "PATCH") {
    if (Object.keys(req.body ?? {}).some(k => !editableCompanyFields.has(k))) return false;
    return await memberRole(identity.userId, Number(company[1])) === "company_admin";
  }
  const domain = /^\/(supply-offers|projects|talent)(?:\/(\d+))?$/.exec(path);
  if (domain) {
    const [, kind, rawId] = domain;
    const ownershipField = kind === "supply-offers" ? "companyId" : "ownerCompanyId";
    const unrelatedOwnershipField = kind === "supply-offers" ? "ownerCompanyId" : "companyId";
    // Authorize exactly the identifier the handler persists. Never accept an
    // alternate identifier that the handler's Zod schema would silently strip.
    if (Object.hasOwn(req.body ?? {}, unrelatedOwnershipField)) return false;
    let companyId: number | null = null;
    if (!rawId && method === "POST") companyId = req.body?.[ownershipField];
    else if (rawId && ["PATCH", "DELETE"].includes(method)) {
      const id = Number(rawId);
      if (kind === "supply-offers") {
        const [row] = await db.select().from(supplyOffersTable).where(eq(supplyOffersTable.id, id));
        companyId = row?.companyId ?? null;
      } else if (kind === "projects") {
        const [row] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
        companyId = row?.ownerCompanyId ?? null;
      } else {
        const [row] = await db.select().from(talentPostsTable).where(eq(talentPostsTable.id, id));
        companyId = row?.ownerCompanyId ?? null;
      }
      if (["companyId", "ownerCompanyId"].some(k => req.body?.[k] !== undefined && req.body[k] !== companyId)) return false;
    }
    if (!Number.isSafeInteger(companyId) || !companyId || !await memberRole(identity.userId, companyId)) return false;
    // Names are presentation, not ownership. Derive them from the verified company.
    if (method === "POST" || method === "PATCH") {
      const [row] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
      if (kind === "projects") req.body.demandCompany = row.name;
      if (kind === "talent") req.body.authorName = row.name;
    }
    return true;
  }
  if (path === "/project-applications" && method === "POST") {
    const id = req.body?.companyId;
    return Number.isSafeInteger(id) && !!await memberRole(identity.userId, id);
  }
  return false;
}