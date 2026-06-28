import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc, sql } from "drizzle-orm";
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
} from "@workspace/api-zod";

const router: IRouter = Router();

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

  const [company] = await db
    .insert(companiesTable)
    .values({
      ...parsed.data,
      logoUrl: parsed.data.logoUrl ?? null,
    })
    .returning();

  res.status(201).json(CreateCompanyResponse.parse(toJson(company)));
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

  const [company] = await db
    .update(companiesTable)
    .set(parsed.data)
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
