import assert from "node:assert/strict";
import { test, after } from "node:test";
import express from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, pool, companiesTable, companyClaimsTable as claims, companyMembersTable as members, companyInvitationsTable as invites, companyVerificationsTable as verifications, projectsTable, talentPostsTable, supplyOffersTable, matchesTable } from "@workspace/db";
import { createMembershipRouter } from "../src/routes/membership";
import { createApiAuthorization, type Identity } from "../src/middlewares/apiAuthorization";
import { authorizeCompanyWrite } from "../src/lib/companyPermissions";
import { newToken, hashToken, tokenIsLive } from "../src/lib/membershipTokens";
import companiesRouter from "../src/routes/companies";
import projectsRouter from "../src/routes/projects";
import supplyOffersRouter from "../src/routes/supplyOffers";
import talentRouter from "../src/routes/talent";

after(async () => { await pool.end(); });
test("one-time tokens are random hashes with strict expiry and state", () => {
  const a = newToken(), b = newToken();
  assert.notEqual(a, b); assert.equal(a.length, 43); assert.equal(hashToken(a).length, 64);
  const now = new Date();
  assert.equal(tokenIsLive({ status: "pending", expiresAt: new Date(now.getTime() + 1) }, now), true);
  for (const status of ["approved", "sending", "cancelled", "delivery_failed", "accepted"]) {
    assert.equal(tokenIsLive({ status, expiresAt: new Date(now.getTime() + 9999) }, now), false);
  }
  assert.equal(tokenIsLive({ status: "pending", expiresAt: now }, now), false);
});

test("claim lifecycle, review, invites, ownership and revocation against isolated records", async t => {
  const createdCompanies: number[] = [];
  const createdProjects: number[] = [], createdTalent: number[] = [], createdOffers: number[] = [];
  let identity: Identity | null = { userId: "membership-test-owner", isAdmin: false };
  let mailFails = false;
  let emails = ["staff@example.test"];
  const sent: { to: string; token: string }[] = [];
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use("/api", createApiAuthorization(async () => identity));
  app.use("/api", createMembershipRouter({
    sendMail: async (to, _company, link) => {
      if (mailFails) throw new Error("Simulated send error");
      sent.push({ to, token: new URLSearchParams(new URL(link).hash.slice(1)).get("token")! });
    },
    saveEvidence: async () => "private-test-evidence",
    readEvidence: async () => ({ bytes: Buffer.from("test"), mime: "application/pdf" }),
    verifiedEmails: async () => emails,
  }));
  app.use("/api", companiesRouter, projectsRouter, supplyOffersRouter, talentRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address(); assert.ok(addr && typeof addr !== "string");
  const base = `http://127.0.0.1:${addr.port}/api`;
  const request = (path: string, method = "GET", body?: unknown) => fetch(base + path, {
    method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  async function company(email = "registered@example.test") {
    const [row] = await db.insert(companiesTable).values({ name: "Membership isolated test fixture", type: "hardware", contactEmail: email }).returning();
    createdCompanies.push(row.id); return row.id;
  }
  const resetCooldown = (companyId: number) => db.update(claims).set({ createdAt: new Date(Date.now() - 61_000) }).where(eq(claims.companyId, companyId));
  const owner = () => { identity = { userId: "membership-test-owner", isAdmin: false }; };
  const admin = () => { identity = { userId: "membership-test-platform", isAdmin: true }; };
  try {
    const first = await company();
    let claimId = 0;
    await t.test("registered email only; unauthenticated and forged recipient rejected", async () => {
      identity = null;
      assert.equal((await request("/membership/claims", "POST", { companyId: first, method: "email" })).status, 401);
      assert.equal((await request("/membership/companies/" + first)).status, 401);
      owner();
      assert.equal((await request("/membership/claims", "POST", { companyId: first, method: "email", email: "attacker@example.test" })).status, 400);
      const response = await request("/membership/claims", "POST", { companyId: first, method: "email" });
      assert.equal(response.status, 201); claimId = (await response.json()).id;
      assert.equal(sent.at(-1)!.to, "registered@example.test");
      const [row] = await db.select().from(claims).where(eq(claims.id, claimId));
      assert.equal(row.tokenHash, hashToken(sent.at(-1)!.token));
      assert.notEqual(row.tokenHash, sent.at(-1)!.token);
      assert.equal((await request("/membership/claims")).status, 403);
    });
    await t.test("duplicate claims, wrong account, expiration, cancellation", async () => {
      await resetCooldown(first);
      assert.equal((await request("/membership/claims", "POST", { companyId: first, method: "email" })).status, 409);
      identity = { userId: "membership-test-other", isAdmin: false };
      assert.equal((await request("/membership/consume", "POST", { token: sent.at(-1)!.token })).status, 403);
      owner();
      await db.update(claims).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(claims.id, claimId));
      assert.equal((await request("/membership/consume", "POST", { token: sent.at(-1)!.token })).status, 409);
      assert.equal((await request(`/membership/claims/${claimId}`, "DELETE")).status, 204);
      assert.equal((await request("/membership/consume", "POST", { token: sent.at(-1)!.token })).status, 409);
    });
    await t.test("single winning claim under concurrent acceptance; badge preserves company", async () => {
      await resetCooldown(first);
      assert.equal((await request("/membership/claims", "POST", { companyId: first, method: "email" })).status, 201);
      const token = sent.at(-1)!.token;
      const responses = await Promise.all([request("/membership/consume", "POST", { token }), request("/membership/consume", "POST", { token })]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      assert.equal((await request("/membership/consume", "POST", { token })).status, 409);
      assert.equal((await request("/membership/claims", "POST", { companyId: first, method: "email" })).status, 409);
      const [companyRow] = await db.select().from(companiesTable).where(eq(companiesTable.id, first));
      assert.ok(companyRow); assert.equal(companyRow.name, "Membership isolated test fixture");
      assert.equal((await (await request(`/companies/${first}/verification`)).json()).verified, true);
      const mine = await (await request("/membership/mine")).json();
      assert.equal(mine.find((m: { companyId: number }) => m.companyId === first).role, "company_admin");
    });
    const second = await company("");
    let manualId = 0;
    await t.test("manual approval requires MST, private document, platform reviewer and note", async () => {
      assert.equal((await request("/membership/claims", "POST", { companyId: second, method: "email" })).status, 400);
      assert.equal((await request("/membership/claims", "POST", { companyId: second, method: "manual", taxCode: "123" })).status, 400);
      const response = await request("/membership/claims", "POST", { companyId: second, method: "manual", taxCode: "123", evidenceData: "stubbed-private-file" });
      assert.equal(response.status, 201); manualId = (await response.json()).id;
      assert.equal((await request(`/membership/claims/${manualId}`, "PATCH", { decision: "approve", note: "checked" })).status, 403);
      identity = { userId: "membership-test-other", isAdmin: false };
      assert.equal((await request(`/membership/claims/${manualId}/evidence`)).status, 403);
      admin();
      assert.equal((await request(`/membership/claims/${manualId}/evidence`)).status, 200);
      assert.equal((await request(`/membership/claims/${manualId}`, "PATCH", { decision: "approve", note: "" })).status, 400);
      assert.equal((await request(`/membership/claims/${manualId}`, "PATCH", { decision: "approve", note: "MST and business card checked" })).status, 200);
      assert.equal((await request(`/membership/claims/${manualId}`, "PATCH", { decision: "approve", note: "again" })).status, 409);
      owner();
    });
    await t.test("ownership scope, staff profile denial, forged reassignment, legacy activities", async () => {
      const other = await company();
      const [project] = await db.insert(projectsTable).values({ title: "isolated", ownerCompanyId: first }).returning();
      const [legacy] = await db.insert(projectsTable).values({ title: "isolated legacy" }).returning();
      createdProjects.push(project.id, legacy.id);
      const [talent] = await db.insert(talentPostsTable).values({ postType: "hiring", title: "isolated", authorName: "test", ownerCompanyId: first }).returning();
      createdTalent.push(talent.id);
      const [offer] = await db.insert(supplyOffersTable).values({ companyId: first, itemName: "isolated" }).returning();
      createdOffers.push(offer.id);
      const check = (path: string, method: string, body: object = {}) => authorizeCompanyWrite({ path, method, body } as express.Request, identity!);
      assert.equal(await check(`/companies/${first}`, "PATCH", { description: "mine" }), true);
      assert.equal(await check(`/companies/${other}`, "PATCH", { description: "foreign" }), false);
      for (const field of ["trustScore", "rating", "contactEmail", "taxCode", "projectsCompleted", "type"]) {
        assert.equal(await check(`/companies/${first}`, "PATCH", { [field]: "forged" }), false);
      }
      assert.equal(await check(`/companies/${first}`, "DELETE"), false);
      assert.equal(await check(`/projects/${project.id}`, "PATCH", { title: "mine" }), true);
      assert.equal(await check(`/projects/${legacy.id}`, "DELETE"), false);
      assert.equal(await check(`/projects/${project.id}`, "PATCH", { ownerCompanyId: other }), false);
      assert.equal(await check(`/supply-offers/${offer.id}`, "PATCH", { companyId: other }), false);
      assert.equal(await check(`/talent/${talent.id}`, "DELETE"), true);
      assert.equal(await check("/project-applications", "POST", { companyId: first }), true);
      assert.equal(await check("/project-applications", "POST", { companyId: other }), false);
      assert.equal(await check("/projects", "POST", { ownerCompanyId: other }), false);
      await db.insert(members).values({ companyId: first, userId: "membership-test-staff", role: "staff" });
      identity = { userId: "membership-test-staff", isAdmin: false };
      assert.equal(await check(`/companies/${first}`, "PATCH", { description: "staff" }), false);
      assert.equal(await check(`/projects/${project.id}`, "DELETE"), true);
      assert.equal((await request(`/membership/companies/${first}/invitations`, "POST", { email: "staff@example.test", role: "staff" })).status, 403);
      const [staff] = await db.select().from(members).where(and(eq(members.companyId, first), eq(members.userId, identity.userId)));
      owner();
      assert.equal((await request(`/membership/companies/${first}/members/${staff.id}`, "DELETE")).status, 204);
      identity = { userId: "membership-test-staff", isAdmin: false };
      assert.equal(await check(`/projects/${project.id}`, "DELETE"), false);
      owner();
    });
    await t.test("real profile and activity handlers preserve ownership and editable fields", async () => {
      const profile = await request(`/companies/${first}`, "PATCH", { description: "Own profile edited through API" });
      assert.equal(profile.status, 200); assert.equal((await profile.json()).description, "Own profile edited through API");
      assert.equal((await request(`/companies/${first}`, "PATCH", { rating: 5 })).status, 403);
      const projectResponse = await request("/projects", "POST", { title: "Isolated request-owned project", description: "", category: "", demandCompany: "forged name", ownerCompanyId: first, requiredTags: [] });
      assert.equal(projectResponse.status, 201);
      const project = await projectResponse.json(); createdProjects.push(project.id);
      assert.equal(project.ownerCompanyId, first); assert.equal(project.demandCompany, "Membership isolated test fixture");
      assert.equal((await request(`/projects/${project.id}`, "PATCH", { title: "Updated own project", budget: "" })).status, 200);
      const offerResponse = await request("/supply-offers", "POST", { companyId: first, itemName: "Own isolated offer" });
      assert.equal(offerResponse.status, 201);
      const offer = await offerResponse.json(); createdOffers.push(offer.id);
      assert.equal(offer.companyId, first);
      assert.equal((await request(`/supply-offers/${offer.id}`, "PATCH", { unitPrice: "10" })).status, 200);
      const talentResponse = await request("/talent", "POST", { ownerCompanyId: first, authorName: "forged name", postType: "hiring", title: "Own isolated talent", headcount: 3 });
      assert.equal(talentResponse.status, 201);
      const talent = await talentResponse.json(); createdTalent.push(talent.id);
      assert.equal(talent.ownerCompanyId, first); assert.equal(talent.authorName, "Membership isolated test fixture");
      const cleared = await request(`/talent/${talent.id}`, "PATCH", { headcount: null, contactPhone: "" });
      assert.equal(cleared.status, 200); assert.equal((await cleared.json()).headcount, null);
      identity = { userId: "membership-test-other", isAdmin: false };
      for (const path of [`/projects/${project.id}`, `/supply-offers/${offer.id}`, `/talent/${talent.id}`]) {
        assert.equal((await request(path, "PATCH", { title: "foreign edit" })).status, 403);
        assert.equal((await request(path, "DELETE")).status, 403);
      }
      owner();
      assert.equal((await request(`/projects/${project.id}`, "DELETE")).status, 204);
      assert.equal((await request(`/supply-offers/${offer.id}`, "DELETE")).status, 204);
      assert.equal((await request(`/talent/${talent.id}`, "DELETE")).status, 204);
    });
    await t.test("conflicting or missing canonical ownership fields cannot create activity", async () => {
      const foreignCompany = await company();
      const itemName = "Conflicting-owner isolated regression offer";
      const response = await request("/supply-offers", "POST", {
        ownerCompanyId: first, companyId: foreignCompany, itemName,
      });
      const inserted = await db.select().from(supplyOffersTable).where(and(eq(supplyOffersTable.companyId, foreignCompany), eq(supplyOffersTable.itemName, itemName)));
      // Keep cleanup reliable even if a future regression unexpectedly inserts.
      createdOffers.push(...inserted.map(row => row.id));
      assert.equal(response.status, 403);
      assert.equal(inserted.length, 0);
      assert.equal((await request("/supply-offers", "POST", { ownerCompanyId: first, itemName })).status, 403);
      assert.equal((await request("/supply-offers", "POST", { ownerCompanyId: first, companyId: first, itemName })).status, 403);
      for (const path of ["/projects", "/talent"]) {
        const body = { companyId: first, title: "Missing canonical owner isolated regression", description: "", category: "", requiredTags: [], demandCompany: "forged", authorName: "forged", postType: "hiring" };
        assert.equal((await request(path, "POST", body)).status, 403);
        assert.equal((await request(path, "POST", { ...body, ownerCompanyId: first })).status, 403);
        assert.equal((await request(path, "POST", { ...body, companyId: foreignCompany, ownerCompanyId: first })).status, 403);
      }
      const invalidProjects = await db.select().from(projectsTable).where(eq(projectsTable.title, "Missing canonical owner isolated regression"));
      const invalidTalent = await db.select().from(talentPostsTable).where(eq(talentPostsTable.title, "Missing canonical owner isolated regression"));
      createdProjects.push(...invalidProjects.map(row => row.id));
      createdTalent.push(...invalidTalent.map(row => row.id));
      assert.equal(invalidProjects.length, 0);
      assert.equal(invalidTalent.length, 0);
    });
    let invitationId = 0;
    await t.test("invitations require verified email; expiration, cancellation, no reuse", async () => {
      const response = await request(`/membership/companies/${first}/invitations`, "POST", { email: "STAFF@example.test", role: "staff" });
      assert.equal(response.status, 201); invitationId = (await response.json()).id;
      const token = sent.at(-1)!.token;
      await db.update(invites).set({ createdAt: new Date(Date.now() - 61_000) }).where(eq(invites.id, invitationId));
      assert.equal((await request(`/membership/companies/${first}/invitations`, "POST", { email: "staff@example.test", role: "staff" })).status, 409);
      identity = { userId: "membership-test-staff", isAdmin: false }; emails = [];
      assert.equal((await request("/membership/consume", "POST", { token })).status, 403);
      emails = ["staff@example.test"];
      await db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.id, invitationId));
      assert.equal((await request("/membership/consume", "POST", { token })).status, 409);
      await db.update(invites).set({ expiresAt: new Date(Date.now() + 100_000) }).where(eq(invites.id, invitationId));
      assert.equal((await request("/membership/consume", "POST", { token })).status, 200);
      assert.equal((await request("/membership/consume", "POST", { token })).status, 409);
      owner();
      const [onlyAdmin] = await db.select().from(members).where(and(eq(members.companyId, first), eq(members.role, "company_admin")));
      assert.equal((await request(`/membership/companies/${first}/members/${onlyAdmin.id}`, "DELETE")).status, 409);
      const cancelResponse = await request(`/membership/companies/${first}/invitations`, "POST", { email: "cancel@example.test", role: "staff" });
      assert.equal(cancelResponse.status, 201);
      const cancelId = (await cancelResponse.json()).id, cancelToken = sent.at(-1)!.token;
      assert.equal((await request(`/membership/companies/${first}/invitations/${cancelId}`, "DELETE")).status, 204);
      emails = ["cancel@example.test"]; identity = { userId: "membership-test-cancel", isAdmin: false };
      assert.equal((await request("/membership/consume", "POST", { token: cancelToken })).status, 409);
      owner();
    });
    await t.test("failed email delivery cannot approve claims", async () => {
      const third = await company();
      mailFails = true;
      assert.equal((await request("/membership/claims", "POST", { companyId: third, method: "email" })).status, 502);
      const [claim] = await db.select().from(claims).where(eq(claims.companyId, third));
      assert.equal(claim.status, "delivery_failed"); assert.equal(claim.tokenHash, null);
      assert.equal((await db.select().from(verifications).where(eq(verifications.companyId, third))).length, 0);
      mailFails = false;
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (createdProjects.length) {
      await db.delete(matchesTable).where(inArray(matchesTable.projectId, createdProjects));
      await db.delete(projectsTable).where(inArray(projectsTable.id, createdProjects));
    }
    if (createdTalent.length) await db.delete(talentPostsTable).where(inArray(talentPostsTable.id, createdTalent));
    if (createdOffers.length) await db.delete(supplyOffersTable).where(inArray(supplyOffersTable.id, createdOffers));
    if (createdCompanies.length) await db.delete(companiesTable).where(inArray(companiesTable.id, createdCompanies));
  }
});