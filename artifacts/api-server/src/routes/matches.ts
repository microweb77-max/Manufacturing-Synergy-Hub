import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
import {
  db,
  matchesTable,
  companiesTable,
  projectsTable,
} from "@workspace/db";
import {
  ListMatchesQueryParams,
  ListMatchesResponse,
  CreateMatchBody,
  CreateMatchResponse,
  UpdateMatchParams,
  UpdateMatchBody,
  UpdateMatchResponse,
  DeleteMatchParams,
} from "@workspace/api-zod";
import { computeSynergyScore } from "../lib/synergy";

const router: IRouter = Router();

router.get("/matches", async (req, res): Promise<void> => {
  const query = ListMatchesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let matches = await db
    .select()
    .from(matchesTable)
    .orderBy(desc(matchesTable.createdAt));

  if (query.data.status) {
    matches = matches.filter((m) => m.status === query.data.status);
  }

  const companies = await db.select().from(companiesTable);
  const projects = await db.select().from(projectsTable);
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const enriched = matches.map((m) => ({
    ...m,
    company: companyMap.get(m.companyId),
    project: projectMap.get(m.projectId),
  }));

  res.json(ListMatchesResponse.parse(toJson(enriched)));
});

router.post("/matches", async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
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

  const synergyScore =
    parsed.data.synergyScore ?? computeSynergyScore(project, company).score;

  const [match] = await db
    .insert(matchesTable)
    .values({
      projectId: parsed.data.projectId,
      companyId: parsed.data.companyId,
      synergyScore,
      status: "pending",
    })
    .returning();

  res.status(201).json(CreateMatchResponse.parse(toJson(match)));
});

router.patch("/matches/:id", async (req, res): Promise<void> => {
  const params = UpdateMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [match] = await db
    .update(matchesTable)
    .set({ status: parsed.data.status })
    .where(eq(matchesTable.id, params.data.id))
    .returning();

  // Bump collaboration count only on the transition into "accepted".
  if (parsed.data.status === "accepted" && existing.status !== "accepted") {
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, match.companyId));
    if (company) {
      await db
        .update(companiesTable)
        .set({ collaborationCount: company.collaborationCount + 1 })
        .where(eq(companiesTable.id, company.id));
    }
  }

  res.json(UpdateMatchResponse.parse(toJson(match)));
});

router.delete("/matches/:id", async (req, res): Promise<void> => {
  const params = DeleteMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(matchesTable).where(eq(matchesTable.id, params.data.id));

  res.status(204).send();
});

export default router;
