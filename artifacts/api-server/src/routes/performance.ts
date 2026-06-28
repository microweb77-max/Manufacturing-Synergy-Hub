import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
import {
  db,
  performanceLogsTable,
  companiesTable,
  projectsTable,
} from "@workspace/db";
import {
  ListPerformanceLogsQueryParams,
  ListPerformanceLogsResponse,
  CreatePerformanceLogBody,
  CreatePerformanceLogResponse,
  UpdatePerformanceLogParams,
  UpdatePerformanceLogBody,
  UpdatePerformanceLogResponse,
  DeletePerformanceLogParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/performance", async (req, res): Promise<void> => {
  const query = ListPerformanceLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db
    .select()
    .from(performanceLogsTable)
    .orderBy(desc(performanceLogsTable.createdAt));

  if (query.data.projectId !== undefined) {
    rows = rows.filter((r) => r.projectId === query.data.projectId);
  }
  if (query.data.companyId !== undefined) {
    rows = rows.filter((r) => r.companyId === query.data.companyId);
  }

  const companies = await db.select().from(companiesTable);
  const projects = await db.select().from(projectsTable);
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const enriched = rows.map((r) => ({
    ...r,
    company: companyMap.get(r.companyId),
    project: projectMap.get(r.projectId),
  }));

  res.json(ListPerformanceLogsResponse.parse(toJson(enriched)));
});

router.post("/performance", async (req, res): Promise<void> => {
  const parsed = CreatePerformanceLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, parsed.data.projectId));
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, parsed.data.companyId));

  if (!project) {
    res.status(400).json({ error: "Project not found" });
    return;
  }
  if (!company) {
    res.status(400).json({ error: "Company not found" });
    return;
  }

  const [log] = await db
    .insert(performanceLogsTable)
    .values({
      ...parsed.data,
      revenue: parsed.data.revenue ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(CreatePerformanceLogResponse.parse(toJson(log)));
});

router.patch("/performance/:id", async (req, res): Promise<void> => {
  const params = UpdatePerformanceLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePerformanceLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(performanceLogsTable)
    .where(eq(performanceLogsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Performance log not found" });
    return;
  }

  const [log] = await db
    .update(performanceLogsTable)
    .set(parsed.data)
    .where(eq(performanceLogsTable.id, params.data.id))
    .returning();

  res.json(UpdatePerformanceLogResponse.parse(toJson(log)));
});

router.delete("/performance/:id", async (req, res): Promise<void> => {
  const params = DeletePerformanceLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(performanceLogsTable)
    .where(eq(performanceLogsTable.id, params.data.id));

  res.status(204).send();
});

export default router;
