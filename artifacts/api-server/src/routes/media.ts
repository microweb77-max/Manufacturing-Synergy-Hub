import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable, bannersTable, solutionsTable } from "@workspace/db";
import { sendDataUrl } from "../lib/media";

/** Serves inline-stored images as cacheable binary responses. Public. */
const router: IRouter = Router();

router.get("/media/:kind/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "잘못된 ID입니다." });
    return;
  }

  let data: string | null | undefined;
  switch (req.params.kind) {
    case "company": {
      const [row] = await db
        .select({ v: companiesTable.logoUrl })
        .from(companiesTable)
        .where(eq(companiesTable.id, id));
      data = row?.v;
      break;
    }
    case "banner": {
      const [row] = await db
        .select({ v: bannersTable.imageUrl })
        .from(bannersTable)
        .where(eq(bannersTable.id, id));
      data = row?.v;
      break;
    }
    case "solution": {
      const [row] = await db
        .select({ v: solutionsTable.imageUrl })
        .from(solutionsTable)
        .where(eq(solutionsTable.id, id));
      data = row?.v;
      break;
    }
    default:
      res.status(404).json({ error: "Not found" });
      return;
  }

  if (!sendDataUrl(res, data, { cache: true })) {
    res.status(404).json({ error: "이미지가 없습니다." });
  }
});

export default router;
