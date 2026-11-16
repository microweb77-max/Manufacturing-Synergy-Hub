import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

/**
 * API integration tests. Need Postgres (DATABASE_URL). Skipped when DATABASE_URL
 * is missing, or when it does not look like a throwaway DB (name contains
 * "test", or CI=true) because the tests TRUNCATE tables.
 */
const url = process.env["DATABASE_URL"];
const safeToWipe = !!url && (/test/i.test(url) || process.env["CI"] === "true");
const run = safeToWipe ? describe : describe.skip;

const PASSWORD = "integration-test-pw";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PDF = "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK";

let app: Express;
let pool: { query: (q: string) => Promise<unknown>; end: () => Promise<void> };

async function adminAgent() {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ password: PASSWORD }).expect(200);
  return agent;
}

run("API 통합 테스트", () => {
  beforeAll(async () => {
    process.env["ADMIN_PASSWORD"] = PASSWORD;
    delete process.env["SESSION_SECRET"];
    app = (await import("../app")).default;
    pool = (await import("@workspace/db")).pool;
  });

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE companies, projects, talent_posts, project_applications, resume_submissions, matches, solutions, banners RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  const company = (over: Record<string, unknown> = {}) => ({
    name: "테스트기업",
    type: "hardware",
    capabilityTags: ["CNC"],
    ...over,
  });

  it("비로그인 접근 정책", async () => {
    await request(app).get("/api/companies").expect(200);
    await request(app).get("/api/resume-submissions").expect(401);
    await request(app).delete("/api/companies/1").expect(401);
    await request(app).post("/api/news/collect").expect(401);
  });

  it("로그인: 틀린 비번 401 / 맞는 비번 200+쿠키 → 관리자 조회 가능", async () => {
    await request(app).post("/api/auth/login").send({ password: "wrong" }).expect(401);
    const ok = await request(app).post("/api/auth/login").send({ password: PASSWORD }).expect(200);
    expect(String(ok.headers["set-cookie"])).toContain("admin_session=");
    const agent = await adminAgent();
    await agent.get("/api/resume-submissions").expect(200);
  });

  it("공개 기업 등록 201", async () => {
    const res = await request(app).post("/api/companies").send(company()).expect(201);
    expect(res.body.name).toBe("테스트기업");
  });

  it("프로젝트 지원: 비로그인 목록은 연락처 마스킹, 관리자는 원본", async () => {
    const c = await request(app).post("/api/companies").send(company()).expect(201);
    const p = await request(app)
      .post("/api/projects")
      .send({ title: "P", description: "", demandCompany: "D", category: "c", requiredTags: ["CNC"] })
      .expect(201);
    await request(app)
      .post("/api/project-applications")
      .send({ projectId: p.body.id, companyId: c.body.id, contactName: "홍길동", contactInfo: "010-1234" })
      .expect(201);

    const anon = await request(app).get("/api/project-applications").expect(200);
    expect(anon.body).toHaveLength(1);
    expect(anon.body[0].contactName).toBe("");
    expect(anon.body[0].contactInfo).toBe("");

    const admin = await adminAgent();
    const full = await admin.get("/api/project-applications").expect(200);
    expect(full.body[0].contactName).toBe("홍길동");
    expect(full.body[0].contactInfo).toBe("010-1234");
  });

  it("로고(data URL): 목록은 미디어 URL, 해당 URL은 image/png", async () => {
    const c = await request(app).post("/api/companies").send(company({ logoUrl: PNG })).expect(201);
    const list = await request(app).get("/api/companies").expect(200);
    const logo: string = list.body[0].logoUrl;
    expect(logo).toMatch(new RegExp(`^/api/media/company/${c.body.id}\\?v=`));
    const img = await request(app).get(logo).expect(200);
    expect(img.headers["content-type"]).toContain("image/png");
  });

  it("이력서: 목록은 다운로드 경로, 비로그인 다운로드 401", async () => {
    const post = await request(app)
      .post("/api/talent")
      .send({ postType: "hiring", title: "구인", authorName: "A" })
      .expect(201);
    await request(app)
      .post("/api/resume-submissions")
      .send({
        talentPostId: post.body.id,
        applicantName: "지원자",
        resumeFileName: "cv.pdf",
        resumeFileData: PDF,
      })
      .expect(201);

    const admin = await adminAgent();
    const list = await admin.get("/api/resume-submissions").expect(200);
    const path: string = list.body[0].resumeFileData;
    expect(path).toBe(`/api/resume-submissions/${list.body[0].id}/file`);
    await request(app).get(path).expect(401);
    const file = await admin.get(path).expect(200);
    expect(file.headers["content-type"]).toContain("application/pdf");
  });

  it("존재하지 않는 경로는 404 JSON", async () => {
    const res = await request(app).get("/api/nope").expect(404);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.error).toBeTruthy();
  });
});
