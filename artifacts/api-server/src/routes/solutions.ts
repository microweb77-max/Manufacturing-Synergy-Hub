import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc, inArray } from "drizzle-orm";
import { db, solutionsTable, companiesTable } from "@workspace/db";
import {
  ListSolutionsQueryParams,
  ListSolutionsResponse,
  CreateSolutionBody,
  CreateSolutionResponse,
  GetSolutionParams,
  GetSolutionResponse,
  UpdateSolutionParams,
  UpdateSolutionBody,
  UpdateSolutionResponse,
  DeleteSolutionParams,
} from "@workspace/api-zod";
import type { Company } from "@workspace/db";

import { isMediaUrl } from "../lib/media";

const router: IRouter = Router();

function attachCompanies(
  solution: typeof solutionsTable.$inferSelect,
  companyMap: Map<number, Company>,
) {
  return {
    ...solution,
    companies: solution.companyIds
      .map((id) => companyMap.get(id))
      .filter((c): c is Company => Boolean(c)),
  };
}

router.get("/solutions", async (req, res): Promise<void> => {
  const query = ListSolutionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db
    .select()
    .from(solutionsTable)
    .orderBy(desc(solutionsTable.createdAt));

  if (query.data.featured !== undefined) {
    rows = rows.filter((s) => s.featured === query.data.featured);
  }

  const companies = await db.select().from(companiesTable);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  res.json(
    ListSolutionsResponse.parse(toJson(
      rows.map((s) => attachCompanies(s, companyMap)),
    )),
  );
});

router.post("/solutions", async (req, res): Promise<void> => {
  const parsed = CreateSolutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const requestedIds = parsed.data.companyIds;
  const existingCompanies =
    requestedIds.length > 0
      ? await db
          .select()
          .from(companiesTable)
          .where(inArray(companiesTable.id, requestedIds))
      : [];

  if (existingCompanies.length !== requestedIds.length) {
    res
      .status(400)
      .json({ error: "One or more referenced companies do not exist" });
    return;
  }

  const [solution] = await db
    .insert(solutionsTable)
    .values({
      ...parsed.data,
      imageUrl: parsed.data.imageUrl ?? null,
      outcome: parsed.data.outcome ?? null,
      featured: parsed.data.featured ?? false,
    })
    .returning();

  const companyMap = new Map(existingCompanies.map((c) => [c.id, c]));

  res
    .status(201)
    .json(CreateSolutionResponse.parse(toJson(attachCompanies(solution, companyMap))));
});

router.get("/solutions/:id", async (req, res): Promise<void> => {
  const params = GetSolutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [solution] = await db
    .select()
    .from(solutionsTable)
    .where(eq(solutionsTable.id, params.data.id));

  if (!solution) {
    res.status(404).json({ error: "Solution not found" });
    return;
  }

  const companies =
    solution.companyIds.length > 0
      ? await db
          .select()
          .from(companiesTable)
          .where(inArray(companiesTable.id, solution.companyIds))
      : [];
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  res.json(GetSolutionResponse.parse(toJson(attachCompanies(solution, companyMap))));
});

router.patch("/solutions/:id", async (req, res): Promise<void> => {
  const params = UpdateSolutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSolutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates = { ...parsed.data };
  // A media URL echoed back by the admin form means "unchanged".
  if (isMediaUrl(updates.imageUrl)) delete updates.imageUrl;

  const [solution] = await db
    .update(solutionsTable)
    .set(updates)
    .where(eq(solutionsTable.id, params.data.id))
    .returning();

  if (!solution) {
    res.status(404).json({ error: "Solution not found" });
    return;
  }

  const companies =
    solution.companyIds.length > 0
      ? await db
          .select()
          .from(companiesTable)
          .where(inArray(companiesTable.id, solution.companyIds))
      : [];
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  res.json(UpdateSolutionResponse.parse(toJson(attachCompanies(solution, companyMap))));
});

router.delete("/solutions/:id", async (req, res): Promise<void> => {
  const params = DeleteSolutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(solutionsTable)
    .where(eq(solutionsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Solution not found" });
    return;
  }

  res.status(204).end();
});

export default router;
