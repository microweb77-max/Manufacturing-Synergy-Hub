import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { desc } from "drizzle-orm";
import {
  db,
  companiesTable,
  projectsTable,
  matchesTable,
  solutionsTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const companies = await db.select().from(companiesTable);
  const projects = await db.select().from(projectsTable);
  const matches = await db.select().from(matchesTable);
  const solutions = await db.select().from(solutionsTable);

  const tagCounts = new Map<string, number>();
  for (const c of companies) {
    for (const tag of c.capabilityTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const avgTrustScore =
    companies.length > 0
      ? Math.round(
          companies.reduce((sum, c) => sum + c.trustScore, 0) /
            companies.length,
        )
      : 0;

  const summary = {
    totalCompanies: companies.length,
    customerCompanies: companies.filter((c) => c.type === "customer").length,
    supplierCompanies: companies.filter((c) => c.type === "supplier").length,
    activeProjects: projects.filter(
      (p) => p.status === "open" || p.status === "matching" || p.status === "in_progress",
    ).length,
    completedProjects: projects.filter((p) => p.status === "completed").length,
    totalMatches: matches.length,
    acceptedMatches: matches.filter((m) => m.status === "accepted").length,
    jointSolutions: solutions.length,
    avgTrustScore,
    topTags,
  };

  res.json(GetDashboardSummaryResponse.parse(toJson(summary)));
});

router.get("/dashboard/activity", async (_req, res): Promise<void> => {
  const companies = await db
    .select()
    .from(companiesTable)
    .orderBy(desc(companiesTable.createdAt))
    .limit(5);
  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.createdAt))
    .limit(5);
  const matches = await db
    .select()
    .from(matchesTable)
    .orderBy(desc(matchesTable.createdAt))
    .limit(5);
  const solutions = await db
    .select()
    .from(solutionsTable)
    .orderBy(desc(solutionsTable.createdAt))
    .limit(5);

  const companyMap = new Map(
    (await db.select().from(companiesTable)).map((c) => [c.id, c]),
  );

  const items = [
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      type: "project" as const,
      title: p.title,
      description: `${p.demandCompany} · ${p.category} 프로젝트 등록`,
      createdAt: p.createdAt.toISOString(),
    })),
    ...matches.map((m) => ({
      id: `match-${m.id}`,
      type: "match" as const,
      title: `${companyMap.get(m.companyId)?.name ?? "업체"} 매칭`,
      description: `시너지 ${m.synergyScore}점 · 상태 ${m.status}`,
      createdAt: m.createdAt.toISOString(),
    })),
    ...solutions.map((s) => ({
      id: `solution-${s.id}`,
      type: "solution" as const,
      title: s.title,
      description: `${s.category} 패키지 솔루션 공개`,
      createdAt: s.createdAt.toISOString(),
    })),
    ...companies.map((c) => ({
      id: `company-${c.id}`,
      type: "company" as const,
      title: c.name,
      description: `${c.type === "customer" ? "제조(고객사)" : c.type === "supplier" ? "공급사" : c.type} 업체 등록`,
      createdAt: c.createdAt.toISOString(),
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 12);

  res.json(GetRecentActivityResponse.parse(toJson(items)));
});

export default router;
