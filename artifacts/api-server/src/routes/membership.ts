import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db, companiesTable, companyMembersTable as members, companyVerificationsTable as verifications, companyClaimsTable as claims, companyInvitationsTable as invitations } from "@workspace/db";
import { z } from "zod";
import type { Identity } from "../middlewares/apiAuthorization";
import { memberRole } from "../lib/companyPermissions";
import { hashToken, newToken, tokenIsLive, MembershipError } from "../lib/membershipTokens";
import { sendMembershipMail, membershipLink } from "../lib/membershipMail";
import { saveEvidence, readEvidence } from "../lib/claimEvidence";
import { toJson } from "../lib/serialize";

export function createMembershipRouter(deps: {
  sendMail?: typeof sendMembershipMail;
  saveEvidence?: typeof saveEvidence;
  readEvidence?: typeof readEvidence;
  verifiedEmails?: (userId: string) => Promise<string[]>;
} = {}): IRouter {
const router: IRouter = Router();
const sendMail = deps.sendMail ?? sendMembershipMail;
const storeEvidence = deps.saveEvidence ?? saveEvidence;
const loadEvidence = deps.readEvidence ?? readEvidence;
const verifiedEmails = deps.verifiedEmails ?? (async (userId: string) => {
  const user = await clerkClient.users.getUser(userId);
  return user.emailAddresses.filter(e => e.verification?.status === "verified").map(e => e.emailAddress.toLowerCase());
});
const claimInput = z.object({
  companyId: z.number().int().positive(), method: z.enum(["email", "manual"]),
  taxCode: z.string().trim().max(100).optional(),
  evidenceData: z.string().max(7_100_000).optional(),
}).strict();
const invitationInput = z.object({ email: z.string().email().max(254).transform(s => s.toLowerCase()), role: z.enum(["company_admin", "staff"]) }).strict();
function actor(res: { locals: Record<string, unknown> }) { return res.locals.identity as Identity; }
function id(value: unknown) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) throw new MembershipError(400, "잘못된 번호입니다."); return n; }
function fail(status: number, message: string): never { throw new MembershipError(status, message); }
async function requireManager(identity: Identity, companyId: number) {
  if (!identity.isAdmin && await memberRole(identity.userId, companyId) !== "company_admin") fail(403, "회사 관리자만 소속을 관리할 수 있습니다.");
}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function lockCompany(tx: Tx, companyId: number) {
  const [company] = await tx.select().from(companiesTable).where(eq(companiesTable.id, companyId)).for("update");
  if (!company) fail(404, "기업을 찾을 수 없습니다.");
  return company;
}
async function approveClaim(tx: Tx, claim: typeof claims.$inferSelect, reviewer: string | null) {
  if (!tokenIsLive(claim)) fail(409, "이미 처리되었거나 만료된 인증 요청입니다.");
  const [verified] = await tx.select().from(verifications).where(eq(verifications.companyId, claim.companyId));
  if (verified) fail(409, "이미 인증된 회사입니다. 회사 관리자에게 초대를 요청하세요.");
  await tx.insert(verifications).values({ companyId: claim.companyId, method: claim.method });
  await tx.insert(members).values({ companyId: claim.companyId, userId: claim.userId, role: "company_admin" });
  await tx.update(claims).set({ status: "approved", reviewedBy: reviewer, tokenHash: null }).where(eq(claims.id, claim.id));
  await tx.update(claims).set({ status: "superseded", tokenHash: null })
    .where(and(eq(claims.companyId, claim.companyId), inArray(claims.status, ["pending", "sending"])));
}

router.get("/companies/:id/verification", async (req, res): Promise<void> => {
  const [row] = await db.select().from(verifications).where(eq(verifications.companyId, id(req.params.id)));
  res.json({ verified: !!row, method: row?.method ?? null });
});
router.get("/membership/mine", async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const rows = await db.select({ companyId: members.companyId, role: members.role, name: companiesTable.name })
    .from(members).innerJoin(companiesTable, eq(companiesTable.id, members.companyId))
    .innerJoin(verifications, eq(verifications.companyId, members.companyId))
    .where(eq(members.userId, actor(res).userId));
  res.json(rows);
});
router.get("/membership/companies/:id", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const companyId = id(req.params.id), identity = actor(res);
  const role = await memberRole(identity.userId, companyId);
  const manager = identity.isAdmin || role === "company_admin";
  const [verified] = await db.select().from(verifications).where(eq(verifications.companyId, companyId));
  const ownClaims = await db.select({ id: claims.id, method: claims.method, status: claims.status, expiresAt: claims.expiresAt, reviewNote: claims.reviewNote })
    .from(claims).where(and(eq(claims.companyId, companyId), eq(claims.userId, identity.userId))).orderBy(desc(claims.id));
  const companyMembers = manager ? await db.select().from(members).where(eq(members.companyId, companyId)) : [];
  const companyInvitations = manager ? await db.select({ id: invitations.id, email: invitations.email, role: invitations.role, status: invitations.status, expiresAt: invitations.expiresAt })
    .from(invitations).where(eq(invitations.companyId, companyId)).orderBy(desc(invitations.id)) : [];
  res.json(toJson({ verified: !!verified, role, members: companyMembers, invitations: companyInvitations, claims: ownClaims }));
});
router.post("/membership/claims", async (req, res): Promise<void> => {
  const parsed = claimInput.safeParse(req.body);
  if (!parsed.success) fail(400, "회사 번호와 인증 방법, 증빙을 확인하세요.");
  const input = parsed.data, identity = actor(res);
  const token = input.method === "email" ? newToken() : null;
  let destination = "", companyName = "";
  const claim = await db.transaction(async tx => {
    const company = await lockCompany(tx, input.companyId);
    companyName = company.name;
    if ((await tx.select().from(verifications).where(eq(verifications.companyId, company.id))).length) fail(409, "이미 인증된 회사입니다. 회사 관리자에게 초대를 요청하세요.");
    // DB-backed throttling survives restarts and serializes competing requests.
    const [recent] = await tx.select().from(claims).where(and(eq(claims.companyId, company.id), gt(claims.createdAt, new Date(Date.now() - 60_000))));
    if (recent) fail(429, "잠시 후 다시 요청하세요.");
    const [pending] = await tx.select().from(claims).where(and(eq(claims.companyId, company.id), eq(claims.userId, identity.userId), inArray(claims.status, ["pending", "sending"]), gt(claims.expiresAt, new Date())));
    if (pending) fail(409, "이미 진행 중인 인증 요청이 있습니다.");
    let evidencePath: string | null = null;
    if (input.method === "email") {
      if (!z.string().email().safeParse(company.contactEmail.trim()).success) fail(400, "등록 이메일이 없습니다. MST·명함으로 수동 인증을 신청하세요.");
      destination = company.contactEmail.trim().toLowerCase();
    } else {
      if (!input.taxCode || !input.evidenceData) fail(400, "MST 번호와 명함 또는 사업자 증빙 파일이 필요합니다.");
      evidencePath = await storeEvidence(input.evidenceData);
    }
    const [row] = await tx.insert(claims).values({
      companyId: company.id, userId: identity.userId, method: input.method,
      status: input.method === "email" ? "sending" : "pending",
      email: destination || null, tokenHash: token ? hashToken(token) : null,
      taxCode: input.taxCode ?? null, evidencePath,
      expiresAt: new Date(Date.now() + (input.method === "email" ? 30 * 60_000 : 14 * 24 * 60 * 60_000)),
    }).returning();
    return row;
  });
  if (token) {
    try {
      await sendMail(destination, companyName, membershipLink(req, token));
      await db.update(claims).set({ status: "pending" }).where(and(eq(claims.id, claim.id), eq(claims.status, "sending")));
    } catch {
      await db.update(claims).set({ status: "delivery_failed", tokenHash: null }).where(eq(claims.id, claim.id));
      fail(502, "인증 메일 발송에 실패했습니다. 잠시 후 다시 요청하세요.");
    }
  }
  res.status(201).json({ id: claim.id, status: "pending", expiresAt: claim.expiresAt.toISOString() });
});
router.delete("/membership/claims/:id", async (req, res): Promise<void> => {
  const identity = actor(res);
  const [claim] = await db.select().from(claims).where(eq(claims.id, id(req.params.id)));
  if (!claim || (!identity.isAdmin && claim.userId !== identity.userId)) fail(403, "취소 권한이 없습니다.");
  await db.transaction(async tx => {
    await lockCompany(tx, claim.companyId);
    const rows = await tx.update(claims).set({ status: "cancelled", tokenHash: null })
      .where(and(eq(claims.id, claim.id), inArray(claims.status, ["pending", "sending"]))).returning();
    if (!rows.length) fail(409, "이미 처리된 요청입니다.");
  });
  res.sendStatus(204);
});
router.get("/membership/claims", async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (!actor(res).isAdmin) fail(403, "플랫폼 관리자만 검수할 수 있습니다.");
  const rows = await db.select({ id: claims.id, companyId: claims.companyId, companyName: companiesTable.name, userId: claims.userId, taxCode: claims.taxCode, registeredTaxCode: companiesTable.taxCode, method: claims.method, status: claims.status, expiresAt: claims.expiresAt, reviewNote: claims.reviewNote })
    .from(claims).innerJoin(companiesTable, eq(companiesTable.id, claims.companyId)).orderBy(desc(claims.id));
  res.json(toJson(rows));
});
router.get("/membership/claims/:id/evidence", async (req, res): Promise<void> => {
  const identity = actor(res);
  const [claim] = await db.select().from(claims).where(eq(claims.id, id(req.params.id)));
  if (!claim || (!identity.isAdmin && claim.userId !== identity.userId)) fail(403, "증빙 열람 권한이 없습니다.");
  if (!claim.evidencePath) fail(404, "첨부된 증빙이 없습니다.");
  const file = await loadEvidence(claim.evidencePath);
  const extension = file.mime === "application/pdf" ? "pdf" : file.mime === "image/png" ? "png" : "jpg";
  res.set({ "Cache-Control": "no-store", "Content-Type": file.mime, "Content-Disposition": `attachment; filename="company-evidence.${extension}"`, "X-Content-Type-Options": "nosniff" });
  res.send(file.bytes);
});
router.patch("/membership/claims/:id", async (req, res): Promise<void> => {
  const identity = actor(res);
  if (!identity.isAdmin) fail(403, "플랫폼 관리자만 승인할 수 있습니다.");
  const parsed = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().min(1).max(1000) }).strict().safeParse(req.body);
  if (!parsed.success) fail(400, "승인 여부와 검수 사유가 필요합니다.");
  const [initial] = await db.select().from(claims).where(eq(claims.id, id(req.params.id)));
  if (!initial) fail(404, "인증 요청을 찾을 수 없습니다.");
  await db.transaction(async tx => {
    await lockCompany(tx, initial.companyId);
    const [claim] = await tx.select().from(claims).where(eq(claims.id, initial.id));
    if (claim.method !== "manual" || !tokenIsLive(claim)) fail(409, "검수 가능한 수동 요청이 아닙니다.");
    if (parsed.data.decision === "approve") await approveClaim(tx, claim, identity.userId);
    else await tx.update(claims).set({ status: "rejected", reviewedBy: identity.userId }).where(eq(claims.id, claim.id));
    await tx.update(claims).set({ reviewNote: parsed.data.note }).where(eq(claims.id, claim.id));
  });
  res.json({ ok: true });
});
router.post("/membership/consume", async (req, res): Promise<void> => {
  const parsed = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().safeParse(req.body);
  if (!parsed.success) fail(400, "인증 링크가 올바르지 않습니다.");
  const tokenHash = hashToken(parsed.data.token), identity = actor(res);
  const [initialClaim] = await db.select().from(claims).where(eq(claims.tokenHash, tokenHash));
  const [initialInvite] = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash));
  const companyId = initialClaim?.companyId ?? initialInvite?.companyId;
  if (!companyId) fail(409, "이미 사용되었거나 유효하지 않은 링크입니다.");
  // Only verified Clerk email ownership accepts an invitation; never trust a request email.
  const emails = initialInvite ? await verifiedEmails(identity.userId) : [];
  await db.transaction(async tx => {
    const company = await lockCompany(tx, companyId);
    if (initialClaim) {
      const [claim] = await tx.select().from(claims).where(eq(claims.id, initialClaim.id));
      if (claim.userId !== identity.userId) fail(403, "인증을 신청한 계정으로 로그인하세요.");
      if (claim.email !== company.contactEmail.trim().toLowerCase()) fail(409, "등록 이메일이 변경되어 다시 인증해야 합니다.");
      await approveClaim(tx, claim, null);
    } else {
      const [invite] = await tx.select().from(invitations).where(eq(invitations.id, initialInvite!.id));
      if (!tokenIsLive(invite)) fail(409, "초대가 만료되었거나 이미 처리되었습니다.");
      if (!emails.includes(invite.email)) fail(403, "초대받은 이메일이 인증된 계정으로 로그인하세요.");
      const [inviter] = await tx.select().from(members).where(and(eq(members.companyId, companyId), eq(members.userId, invite.invitedBy), eq(members.role, "company_admin")));
      // Platform admins can review claims, but invitations require a current company admin.
      if (!inviter) fail(409, "초대한 관리자의 권한이 해제되었습니다.");
      if ((await tx.select().from(members).where(and(eq(members.companyId, companyId), eq(members.userId, identity.userId)))).length) fail(409, "이미 소속된 계정입니다.");
      await tx.insert(members).values({ companyId, userId: identity.userId, role: invite.role });
      await tx.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, invite.id));
    }
  });
  res.json({ companyId });
});
router.post("/membership/companies/:id/invitations", async (req, res): Promise<void> => {
  const companyId = id(req.params.id), identity = actor(res);
  const parsed = invitationInput.safeParse(req.body);
  if (!parsed.success) fail(400, "초대 이메일과 역할을 확인하세요.");
  const token = newToken();
  const invite = await db.transaction(async tx => {
    await lockCompany(tx, companyId);
    // Recheck inside the company lock to serialize revocation with invitation creation.
    const [manager] = await tx.select().from(members).where(and(eq(members.companyId, companyId), eq(members.userId, identity.userId), eq(members.role, "company_admin")));
    if (!manager) fail(403, "소속된 회사 관리자만 초대할 수 있습니다.");
    const [recent] = await tx.select().from(invitations).where(and(eq(invitations.companyId, companyId), gt(invitations.createdAt, new Date(Date.now() - 60_000))));
    if (recent) fail(429, "잠시 후 다시 초대하세요.");
    const [pending] = await tx.select().from(invitations).where(and(eq(invitations.companyId, companyId), eq(invitations.email, parsed.data.email), inArray(invitations.status, ["pending", "sending"]), gt(invitations.expiresAt, new Date())));
    if (pending) fail(409, "진행 중인 초대가 있습니다.");
    const [row] = await tx.insert(invitations).values({ companyId, ...parsed.data, invitedBy: identity.userId, tokenHash: hashToken(token), status: "sending", expiresAt: new Date(Date.now() + 48 * 60 * 60_000) }).returning();
    return row;
  });
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  try {
    await sendMail(invite.email, company.name, membershipLink(req, token), true);
    await db.update(invitations).set({ status: "pending" }).where(and(eq(invitations.id, invite.id), eq(invitations.status, "sending")));
  } catch {
    await db.update(invitations).set({ status: "delivery_failed" }).where(eq(invitations.id, invite.id));
    fail(502, "초대 메일 발송에 실패했습니다. 잠시 후 다시 요청하세요.");
  }
  res.status(201).json({ id: invite.id, status: "pending", expiresAt: invite.expiresAt.toISOString() });
});
router.delete("/membership/companies/:id/invitations/:invitationId", async (req, res): Promise<void> => {
  const companyId = id(req.params.id), identity = actor(res);
  await db.transaction(async tx => {
    await lockCompany(tx, companyId);
    await requireManager(identity, companyId);
    const rows = await tx.update(invitations).set({ status: "cancelled" })
      .where(and(eq(invitations.id, id(req.params.invitationId)), eq(invitations.companyId, companyId), inArray(invitations.status, ["pending", "sending"]))).returning();
    if (!rows.length) fail(409, "취소 가능한 초대가 아닙니다.");
  });
  res.sendStatus(204);
});
router.delete("/membership/companies/:id/members/:memberId", async (req, res): Promise<void> => {
  const companyId = id(req.params.id), identity = actor(res);
  await db.transaction(async tx => {
    await lockCompany(tx, companyId);
    await requireManager(identity, companyId);
    const [target] = await tx.select().from(members).where(and(eq(members.id, id(req.params.memberId)), eq(members.companyId, companyId)));
    if (!target) fail(404, "소속을 찾을 수 없습니다.");
    if (target.role === "company_admin") {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(members).where(and(eq(members.companyId, companyId), eq(members.role, "company_admin")));
      if (count <= 1) fail(409, "마지막 회사 관리자는 해제할 수 없습니다. 먼저 다른 관리자를 초대하세요.");
    }
    await tx.delete(members).where(eq(members.id, target.id));
    await tx.update(invitations).set({ status: "cancelled" }).where(and(eq(invitations.companyId, companyId), eq(invitations.invitedBy, target.userId), inArray(invitations.status, ["pending", "sending"])));
  });
  res.sendStatus(204);
});
router.use((error: unknown, req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (error instanceof MembershipError) { res.status(error.status).json({ error: error.message }); return; }
  req.log?.error("Company membership operation failed");
  res.status(503).json({ error: "회사 인증 서비스를 사용할 수 없습니다. 다시 시도하세요." });
});
return router;
}
export default createMembershipRouter();