import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
import {
  db,
  offerMatchesTable,
  supplyOffersTable,
  companiesTable,
} from "@workspace/db";
import {
  ListOfferMatchesResponse,
  CreateOfferMatchBody,
  CreateOfferMatchResponse,
  UpdateOfferMatchParams,
  UpdateOfferMatchBody,
  UpdateOfferMatchResponse,
  DeleteOfferMatchParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectShape = {
  id: offerMatchesTable.id,
  offerId: offerMatchesTable.offerId,
  itemName: supplyOffersTable.itemName,
  supplierCompanyId: supplyOffersTable.companyId,
  supplierCompanyName: companiesTable.name,
  clientCompanyNo: offerMatchesTable.clientCompanyNo,
  clientCompanyName: offerMatchesTable.clientCompanyName,
  contactName: offerMatchesTable.contactName,
  contactInfo: offerMatchesTable.contactInfo,
  message: offerMatchesTable.message,
  status: offerMatchesTable.status,
  adminNote: offerMatchesTable.adminNote,
  createdAt: offerMatchesTable.createdAt,
};

type RawRow = {
  itemName: string | null;
  supplierCompanyId: number | null;
  supplierCompanyName: string | null;
  [k: string]: unknown;
};

function shape(r: RawRow) {
  return {
    ...r,
    itemName: r.itemName ?? "",
    supplierCompanyId: r.supplierCompanyId ?? 0,
    supplierCompanyName: r.supplierCompanyName ?? "",
  };
}

router.get("/offer-matches", async (_req, res): Promise<void> => {
  const rows = await db
    .select(selectShape)
    .from(offerMatchesTable)
    .leftJoin(
      supplyOffersTable,
      eq(offerMatchesTable.offerId, supplyOffersTable.id),
    )
    .leftJoin(companiesTable, eq(supplyOffersTable.companyId, companiesTable.id))
    .orderBy(desc(offerMatchesTable.createdAt));

  res.json(ListOfferMatchesResponse.parse(toJson(rows.map(shape))));
});

router.post("/offer-matches", async (req, res): Promise<void> => {
  const parsed = CreateOfferMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [offer] = await db
    .select()
    .from(supplyOffersTable)
    .where(eq(supplyOffersTable.id, data.offerId));

  if (!offer) {
    res.status(404).json({ error: "Supply offer not found" });
    return;
  }

  const [inserted] = await db
    .insert(offerMatchesTable)
    .values({
      offerId: data.offerId,
      clientCompanyNo: data.clientCompanyNo ?? null,
      clientCompanyName: data.clientCompanyName,
      contactName: data.contactName ?? "",
      contactInfo: data.contactInfo ?? "",
      message: data.message ?? "",
    })
    .returning();

  const [row] = await db
    .select(selectShape)
    .from(offerMatchesTable)
    .leftJoin(
      supplyOffersTable,
      eq(offerMatchesTable.offerId, supplyOffersTable.id),
    )
    .leftJoin(companiesTable, eq(supplyOffersTable.companyId, companiesTable.id))
    .where(eq(offerMatchesTable.id, inserted.id));

  res.status(201).json(CreateOfferMatchResponse.parse(toJson(shape(row))));
});

router.patch("/offer-matches/:id", async (req, res): Promise<void> => {
  const params = UpdateOfferMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOfferMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(offerMatchesTable)
    .where(eq(offerMatchesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Offer match not found" });
    return;
  }

  await db
    .update(offerMatchesTable)
    .set(parsed.data)
    .where(eq(offerMatchesTable.id, params.data.id));

  const [row] = await db
    .select(selectShape)
    .from(offerMatchesTable)
    .leftJoin(
      supplyOffersTable,
      eq(offerMatchesTable.offerId, supplyOffersTable.id),
    )
    .leftJoin(companiesTable, eq(supplyOffersTable.companyId, companiesTable.id))
    .where(eq(offerMatchesTable.id, params.data.id));

  res.json(UpdateOfferMatchResponse.parse(toJson(shape(row))));
});

router.delete("/offer-matches/:id", async (req, res): Promise<void> => {
  const params = DeleteOfferMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(offerMatchesTable)
    .where(eq(offerMatchesTable.id, params.data.id));

  res.status(204).send();
});

export default router;
