import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import {
  CLIENT_COMPANY_MASK, createClientCompanyVisibility, visibleClientCompany,
} from "../src/middlewares/clientCompanyVisibility";

const company = {
  no: 42,
  nameKo: "공개 기업명",
  nameEn: "PUBLIC COMPANY",
  industry: "전자 제조",
  parentCompany: "Private Parent",
  entryType: "Private Entry",
  investmentType: "Private Investment",
  industryDetail: "Private Detail",
  region: "Private Region",
  address: "Private Address",
  postalCode: "Private Postal",
};
const privateFields = ["parentCompany", "entryType", "investmentType", "industryDetail", "region", "address", "postalCode"] as const;

async function withSession(
  session: { userId: string | null; sessionId: string | null } | "failure",
  run: (url: string) => Promise<void>,
) {
  const app = express();
  app.get("/api/client-companies", createClientCompanyVisibility(() => {
    if (session === "failure") throw new Error("Private identity provider error");
    return session;
  }), (_req, res) => res.json([visibleClientCompany(company, res.locals.canViewClientDetails === true)]));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}/api/client-companies`); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test("anonymous records expose names/industry and mask every other business field exactly", async () => {
  await withSession({ userId: null, sessionId: null }, async (url) => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const [record] = await response.json();
    assert.equal(record.nameKo, company.nameKo);
    assert.equal(record.nameEn, company.nameEn);
    assert.equal(record.industry, company.industry);
    assert.equal(record.no, company.no); // Internal React row key only.
    for (const key of privateFields) assert.equal(record[key], "------------", key);
    assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/);
    assert.match(response.headers.get("vary") ?? "", /Cookie/);
    assert.match(response.headers.get("vary") ?? "", /Authorization/);
  });
});
test("ordinary authenticated members receive full details, not only platform administrators", async () => {
  for (const userId of ["ordinary-member", "admin"]) {
    await withSession({ userId, sessionId: "verified-session" }, async (url) => {
      const response = await fetch(url);
      assert.deepEqual(await response.json(), [company]);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    });
  }
});
test("partial sessions and forged request parameters do not grant detail access", async () => {
  for (const session of [{ userId: null, sessionId: null }, { userId: "member", sessionId: null }, { userId: null, sessionId: "session" }]) {
    await withSession(session, async (url) => {
      const response = await fetch(`${url}?isSignedIn=true&role=admin`, {
        headers: { Cookie: "admin_auth=1", "X-User-Id": "admin" },
      });
      const [record] = await response.json();
      for (const key of privateFields) assert.equal(record[key], CLIENT_COMPANY_MASK);
    });
  }
});
test("the public allowlist excludes unrecognized fields and never modifies source data", () => {
  const source = { ...company, privateNewField: "secret new field" };
  const snapshot = JSON.stringify(source);
  const result = visibleClientCompany(source, false);
  assert.ok(!("privateNewField" in result));
  assert.equal(JSON.stringify(source), snapshot);
  assert.notEqual(result, source);
});
test("session verification errors do not return the company list or provider details", async () => {
  await withSession("failure", async (url) => {
    const response = await fetch(url);
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.ok(!text.includes(company.address));
    assert.ok(!text.includes("Private identity provider"));
  });
});
