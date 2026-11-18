import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { rateLimit } from "../lib/rateLimit";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { buildCompanyPatch } from "../lib/companyBulkUpdate";
import {
  db,
  companiesTable,
  matchesTable,
  performanceLogsTable,
  solutionsTable,
} from "@workspace/db";
import {
  ListCompaniesQueryParams,
  ListCompaniesResponse,
  CreateCompanyBody,
  CreateCompanyResponse,
  GetCompanyParams,
  GetCompanyResponse,
  UpdateCompanyParams,
  UpdateCompanyBody,
  UpdateCompanyResponse,
  DeleteCompanyParams,
  GetCompanyLeaderboardResponse,
  AnalyzeCompanyMaterialBody,
  AnalyzeCompanyMaterialResponse,
  BulkUpdateCompaniesBody,
  BulkUpdateCompaniesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ALLOWED_MATERIAL_MIME = /^(image\/(png|jpeg|jpg|webp|gif)|application\/pdf)$/;
const MAX_MATERIAL_BYTES = 7 * 1024 * 1024;

const LOGO_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Validates a logo value. Accepts a raster image data URL (<= 2MB decoded) or a
 * plain https URL. Returns the normalized value, or `{ error }` if invalid.
 */
function validateLogoUrl(value: string): { value: string } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { value: "" };

  const dataMatch = LOGO_DATA_URL_RE.exec(trimmed);
  if (dataMatch) {
    const base64 = dataMatch[2];
    const decodedBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (decodedBytes > MAX_LOGO_BYTES) {
      return { error: "로고 이미지는 2MB 이하여야 합니다." };
    }
    return { value: trimmed };
  }

  if (/^https:\/\/\S+$/.test(trimmed)) {
    return { value: extractDirectImageUrl(trimmed) };
  }

  return { error: "유효하지 않은 로고 이미지입니다. 이미지(PNG, JPG, WEBP, GIF) 파일을 업로드해주세요." };
}

// Users sometimes paste a Google Images viewer-page link
// (https://www.google.com/imgres?...&imgurl=<direct-url>) instead of the direct
// image URL. That page returns HTML, not an image, so the <img> never renders.
// Extract the embedded `imgurl` (the real image file) when present.
function extractDirectImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname);
    if (isGoogle && parsed.pathname.includes("/imgres")) {
      const imgUrl = parsed.searchParams.get("imgurl");
      if (imgUrl && /^https:\/\/\S+$/.test(imgUrl)) {
        return imgUrl;
      }
    }
  } catch {
    // Not parseable; return original.
  }
  return url;
}

const ANALYZE_PROMPT = `당신은 B2B 제조업 협업 네트워크의 기업 프로필 분석 전문가입니다.
첨부된 기업 홍보자료(이미지 또는 PDF)를 읽고, 그 안의 텍스트와 시각 정보를 분석하여 아래 항목을 추출하세요.

반드시 다음 JSON 스키마에 맞는 JSON 객체만 출력하세요. 설명이나 코드블록 표시(\`\`\`) 없이 순수 JSON만 출력합니다.

{
  "name": "기업명 (문서에서 찾을 수 없으면 빈 문자열)",
  "type": "hardware, software, service 중 하나. 장비/로봇/금형/물류 등 물리적 제조는 hardware, MES/ERP/자동화/머신비전 등 소프트웨어는 software, 컨설팅/유지보수/엔지니어링 서비스 등은 service",
  "taxCode": "사업자세금코드 MST (베트남 Mã số thuế, Tax Code). 숫자로 된 코드. 찾을 수 없으면 빈 문자열",
  "phone": "대표 전화번호 또는 담당자 연락처 (찾을 수 없으면 빈 문자열)",
  "kakaoTalkId": "카카오톡 ID (KakaoTalk ID). 찾을 수 없으면 빈 문자열",
  "description": "기업 소개 및 주요 사업 영역 요약 (한국어, 2~3문장)",
  "location": "본사 또는 주요 사업장 위치 (찾을 수 없으면 빈 문자열)",
  "capabilityTags": ["핵심 역량 키워드 배열 (예: CNC가공, MES구축, 머신비전). 3~8개"],
  "techSpecs": "장비 사양, 사용 기술 스택, 인증, 생산능력 등 기술적 세부사항 (한국어)",
  "contactEmail": "담당자 이메일 (찾을 수 없으면 빈 문자열)"
}

모든 텍스트 값은 한국어로 작성하세요. 정보가 명확하지 않으면 합리적으로 추론하되, 전혀 알 수 없는 항목은 빈 문자열 또는 빈 배열로 둡니다.`;

const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "자료 분석 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.",
});

router.post("/companies/analyze-material", analyzeLimiter, async (req, res): Promise<void> => {
  const parsed = AnalyzeCompanyMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fileBase64, mimeType } = parsed.data;

  if (!ALLOWED_MATERIAL_MIME.test(mimeType)) {
    res.status(400).json({
      error: "지원하지 않는 파일 형식입니다. 이미지(PNG, JPG, WEBP) 또는 PDF만 업로드할 수 있습니다.",
    });
    return;
  }

  const approxBytes = Math.floor((fileBase64.length * 3) / 4);
  if (approxBytes > MAX_MATERIAL_BYTES) {
    res.status(400).json({
      error: "파일이 너무 큽니다. 7MB 이하의 파일을 업로드해주세요.",
    });
    return;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(fileBase64) || fileBase64.length % 4 !== 0) {
    res.status(400).json({ error: "파일 데이터가 올바르지 않습니다." });
    return;
  }

  let ai: typeof import("@workspace/integrations-gemini-ai")["ai"];
  try {
    ({ ai } = await import("@workspace/integrations-gemini-ai"));
  } catch (err) {
    req.log.error({ err }, "Gemini integration unavailable");
    res.status(503).json({ error: "AI 분석 기능을 현재 사용할 수 없습니다." });
    return;
  }

  let rawText: string;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: fileBase64 } },
            { text: ANALYZE_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });
    rawText = response.text ?? "";
  } catch (err) {
    req.log.error({ err }, "Gemini material analysis failed");
    res.status(502).json({ error: "홍보자료 분석에 실패했습니다. 잠시 후 다시 시도해주세요." });
    return;
  }

  let extracted: unknown;
  try {
    extracted = JSON.parse(rawText);
  } catch {
    req.log.error({ outputLength: rawText.length }, "Gemini returned non-JSON output");
    res.status(502).json({ error: "분석 결과를 해석하지 못했습니다. 다른 자료로 다시 시도해주세요." });
    return;
  }

  const result = AnalyzeCompanyMaterialResponse.safeParse(extracted);
  if (!result.success) {
    req.log.error(
      { issues: result.error.issues.map((i) => ({ path: i.path, code: i.code })) },
      "Gemini output failed schema validation",
    );
    res.status(502).json({ error: "분석 결과 형식이 올바르지 않습니다. 다시 시도해주세요." });
    return;
  }

  res.json(result.data);
});

router.get("/companies", async (req, res): Promise<void> => {
  const query = ListCompaniesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db
    .select()
    .from(companiesTable)
    .orderBy(desc(companiesTable.trustScore));

  const { type, tag, search } = query.data;
  if (type) rows = rows.filter((c) => c.type === type);
  if (tag) rows = rows.filter((c) => c.capabilityTags.includes(tag));
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.description.toLowerCase().includes(s) ||
        c.capabilityTags.some((t) => t.toLowerCase().includes(s)),
    );
  }

  res.json(ListCompaniesResponse.parse(toJson(rows)));
});

router.get("/companies/leaderboard", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(companiesTable)
    .orderBy(desc(companiesTable.trustScore))
    .limit(10);
  res.json(GetCompanyLeaderboardResponse.parse(toJson(rows)));
});

router.post("/companies", async (req, res): Promise<void> => {
  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let logoUrl: string | null = null;
  if (parsed.data.logoUrl != null) {
    const logoResult = validateLogoUrl(parsed.data.logoUrl);
    if ("error" in logoResult) {
      res.status(400).json({ error: logoResult.error });
      return;
    }
    logoUrl = logoResult.value === "" ? null : logoResult.value;
  }

  const [company] = await db
    .insert(companiesTable)
    .values({
      ...parsed.data,
      taxCode: parsed.data.taxCode?.trim() ? parsed.data.taxCode.trim() : null,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
      kakaoTalkId: parsed.data.kakaoTalkId?.trim() ? parsed.data.kakaoTalkId.trim() : null,
      logoUrl,
    })
    .returning();

  res.status(201).json(CreateCompanyResponse.parse(toJson(company)));
});

// Admin-only (fail-closed in apiAuthorization: no company-member rule matches this path).
// Policy: rows that fail validation are skipped and reported; all valid rows are
// applied together in ONE transaction (all-or-nothing for the valid set).
router.post("/companies/bulk-update", async (req, res): Promise<void> => {
  const parsed = BulkUpdateCompaniesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { items } = parsed.data;
  const errors: { row: number; id?: number; reason: string }[] = [];
  const candidates: { id: number; patch: Record<string, unknown> }[] = [];
  const seen = new Set<number>();
  let skipped = 0;

  const ids = [...new Set(items.map((i) => i.id))];
  const found = ids.length
    ? await db.select({ id: companiesTable.id }).from(companiesTable).where(inArray(companiesTable.id, ids))
    : [];
  const existing = new Set(found.map((c) => c.id));

  items.forEach((item, index) => {
    const row = item.row ?? index + 1;
    if (!existing.has(item.id)) {
      errors.push({ row, id: item.id, reason: `id ${item.id}를 찾을 수 없습니다.` });
      return;
    }
    if (seen.has(item.id)) {
      errors.push({ row, id: item.id, reason: `id ${item.id}가 중복되었습니다.` });
      return;
    }
    seen.add(item.id);
    const built = buildCompanyPatch(item);
    if ("error" in built) {
      errors.push({ row, id: item.id, reason: built.error });
      return;
    }
    if (!Object.keys(built.patch).length) {
      skipped++;
      return;
    }
    candidates.push({ id: item.id, patch: built.patch });
  });

  await db.transaction(async (tx) => {
    for (const { id, patch } of candidates) {
      await tx.update(companiesTable).set(patch).where(eq(companiesTable.id, id));
    }
  });

  res.json(
    BulkUpdateCompaniesResponse.parse({ updated: candidates.length, skipped, errors }),
  );
});

router.get("/companies/:id", async (req, res): Promise<void> => {
  const params = GetCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, params.data.id));

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.json(GetCompanyResponse.parse(toJson(company)));
});

router.patch("/companies/:id", async (req, res): Promise<void> => {
  const params = UpdateCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { taxCode, phone, kakaoTalkId, logoUrl, ...rest } = parsed.data;

  let normalizedLogoUrl: string | null | undefined;
  if (logoUrl !== undefined) {
    const logoResult = validateLogoUrl(logoUrl);
    if ("error" in logoResult) {
      res.status(400).json({ error: logoResult.error });
      return;
    }
    normalizedLogoUrl = logoResult.value === "" ? null : logoResult.value;
  }

  const updateValues = {
    ...rest,
    ...(taxCode !== undefined ? { taxCode: taxCode.trim() ? taxCode.trim() : null } : {}),
    ...(phone !== undefined ? { phone: phone.trim() ? phone.trim() : null } : {}),
    ...(kakaoTalkId !== undefined ? { kakaoTalkId: kakaoTalkId.trim() ? kakaoTalkId.trim() : null } : {}),
    ...(logoUrl !== undefined ? { logoUrl: normalizedLogoUrl } : {}),
  };

  const [company] = await db
    .update(companiesTable)
    .set(updateValues)
    .where(eq(companiesTable.id, params.data.id))
    .returning();

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.json(UpdateCompanyResponse.parse(toJson(company)));
});

router.delete("/companies/:id", async (req, res): Promise<void> => {
  const params = DeleteCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, params.data.id));

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  // Clean up dependent records to avoid dangling references.
  await db.delete(matchesTable).where(eq(matchesTable.companyId, company.id));
  await db
    .delete(performanceLogsTable)
    .where(eq(performanceLogsTable.companyId, company.id));

  const referencingSolutions = await db
    .select()
    .from(solutionsTable)
    .where(sql`${company.id} = ANY(${solutionsTable.companyIds})`);
  for (const solution of referencingSolutions) {
    await db
      .update(solutionsTable)
      .set({
        companyIds: solution.companyIds.filter((cid) => cid !== company.id),
      })
      .where(eq(solutionsTable.id, solution.id));
  }

  await db.delete(companiesTable).where(eq(companiesTable.id, company.id));

  res.sendStatus(204);
});

export default router;
