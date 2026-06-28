import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
import {
  db,
  projectsTable,
  companiesTable,
  matchesTable,
  performanceLogsTable,
} from "@workspace/db";
import {
  ListProjectsQueryParams,
  ListProjectsResponse,
  CreateProjectBody,
  CreateProjectResponse,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  GetProjectRecommendationsParams,
  GetProjectRecommendationsResponse,
  ListProjectMatchesParams,
  ListProjectMatchesResponse,
} from "@workspace/api-zod";
import { computeSynergyScore, buildReason } from "../lib/synergy";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.createdAt));

  if (query.data.status) {
    rows = rows.filter((p) => p.status === query.data.status);
  }

  res.json(ListProjectsResponse.parse(toJson(rows)));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({
      ...parsed.data,
      budget: parsed.data.budget ?? null,
      deadline: parsed.data.deadline ?? null,
      status: "matching",
    })
    .returning();

  // Smart matching engine: auto-create pending matches for top synergy partners.
  const companies = await db.select().from(companiesTable);
  const scored = companies
    .map((company) => ({
      company,
      ...computeSynergyScore(project, company),
    }))
    .filter((s) => s.matchedTags.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length > 0) {
    await db.insert(matchesTable).values(
      scored.map((s) => ({
        projectId: project.id,
        companyId: s.company.id,
        synergyScore: s.score,
        status: "pending",
      })),
    );
  }

  res.status(201).json(CreateProjectResponse.parse(toJson(project)));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(GetProjectResponse.parse(toJson(project)));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(UpdateProjectResponse.parse(toJson(project)));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db.delete(matchesTable).where(eq(matchesTable.projectId, project.id));
  await db
    .delete(performanceLogsTable)
    .where(eq(performanceLogsTable.projectId, project.id));

  res.sendStatus(204);
});

router.get(
  "/projects/:id/recommendations",
  async (req, res): Promise<void> => {
    const params = GetProjectRecommendationsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, params.data.id));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const companies = await db.select().from(companiesTable);
    const recommendations = companies
      .map((company) => {
        const { score, matchedTags } = computeSynergyScore(project, company);
        return {
          company,
          synergyScore: score,
          matchedTags,
          reason: buildReason(company, matchedTags, score),
        };
      })
      .filter((r) => r.synergyScore > 0)
      .sort((a, b) => b.synergyScore - a.synergyScore)
      .slice(0, 8);

    res.json(GetProjectRecommendationsResponse.parse(toJson(recommendations)));
  },
);

router.get("/projects/:id/matches", async (req, res): Promise<void> => {
  const params = ListProjectMatchesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const matches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.projectId, params.data.id))
    .orderBy(desc(matchesTable.synergyScore));

  const companies = await db.select().from(companiesTable);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const enriched = matches.map((m) => ({
    ...m,
    company: companyMap.get(m.companyId),
  }));

  res.json(ListProjectMatchesResponse.parse(toJson(enriched)));
});

export default router;
