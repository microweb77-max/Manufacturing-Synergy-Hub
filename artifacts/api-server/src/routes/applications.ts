import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  db,
  projectApplicationsTable,
  projectsTable,
  companiesTable,
} from "@workspace/db";
import {
  ListProjectApplicationsQueryParams,
  ListProjectApplicationsResponse,
  CreateProjectApplicationBody,
  CreateProjectApplicationResponse,
  UpdateProjectApplicationParams,
  UpdateProjectApplicationBody,
  UpdateProjectApplicationResponse,
  DeleteProjectApplicationParams,
} from "@workspace/api-zod";

import { isAdmin } from "../lib/auth";

const router: IRouter = Router();

const selectShape = {
  id: projectApplicationsTable.id,
  projectId: projectApplicationsTable.projectId,
  projectTitle: projectsTable.title,
  companyId: projectApplicationsTable.companyId,
  companyName: companiesTable.name,
  companyType: companiesTable.type,
  message: projectApplicationsTable.message,
  contactName: projectApplicationsTable.contactName,
  contactInfo: projectApplicationsTable.contactInfo,
  status: projectApplicationsTable.status,
  adminNote: projectApplicationsTable.adminNote,
  createdAt: projectApplicationsTable.createdAt,
};

type RawRow = {
  projectTitle: string | null;
  companyName: string | null;
  companyType: string | null;
  [k: string]: unknown;
};

function shape(r: RawRow) {
  return {
    ...r,
    projectTitle: r.projectTitle ?? "",
    companyName: r.companyName ?? "",
    companyType: r.companyType ?? "",
  };
}

router.get("/project-applications", async (req, res): Promise<void> => {
  const query = ListProjectApplicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const where: SQL | undefined = query.data.projectId
    ? eq(projectApplicationsTable.projectId, query.data.projectId)
    : undefined;

  const rows = await db
    .select(selectShape)
    .from(projectApplicationsTable)
    .leftJoin(
      projectsTable,
      eq(projectApplicationsTable.projectId, projectsTable.id),
    )
    .leftJoin(
      companiesTable,
      eq(projectApplicationsTable.companyId, companiesTable.id),
    )
    .where(where)
    .orderBy(desc(projectApplicationsTable.createdAt));

  // Contact details and admin notes are visible to admins only.
  const admin = isAdmin(req);
  const visible = rows.map(shape).map((r) =>
    admin ? r : { ...r, contactName: "", contactInfo: "", adminNote: "" },
  );
  res.json(ListProjectApplicationsResponse.parse(toJson(visible)));
});

router.post("/project-applications", async (req, res): Promise<void> => {
  const parsed = CreateProjectApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, data.companyId));
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const [inserted] = await db
    .insert(projectApplicationsTable)
    .values({
      projectId: data.projectId,
      companyId: data.companyId,
      message: data.message ?? "",
      contactName: data.contactName ?? "",
      contactInfo: data.contactInfo ?? "",
    })
    .returning();

  const [row] = await db
    .select(selectShape)
    .from(projectApplicationsTable)
    .leftJoin(
      projectsTable,
      eq(projectApplicationsTable.projectId, projectsTable.id),
    )
    .leftJoin(
      companiesTable,
      eq(projectApplicationsTable.companyId, companiesTable.id),
    )
    .where(eq(projectApplicationsTable.id, inserted.id));

  res
    .status(201)
    .json(CreateProjectApplicationResponse.parse(toJson(shape(row))));
});

router.patch("/project-applications/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProjectApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(projectApplicationsTable)
    .where(eq(projectApplicationsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Project application not found" });
    return;
  }

  await db
    .update(projectApplicationsTable)
    .set(parsed.data)
    .where(eq(projectApplicationsTable.id, params.data.id));

  const [row] = await db
    .select(selectShape)
    .from(projectApplicationsTable)
    .leftJoin(
      projectsTable,
      eq(projectApplicationsTable.projectId, projectsTable.id),
    )
    .leftJoin(
      companiesTable,
      eq(projectApplicationsTable.companyId, companiesTable.id),
    )
    .where(eq(projectApplicationsTable.id, params.data.id));

  res.json(UpdateProjectApplicationResponse.parse(toJson(shape(row))));
});

router.delete("/project-applications/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(projectApplicationsTable)
    .where(eq(projectApplicationsTable.id, params.data.id));

  res.status(204).send();
});

export default router;
