import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc, and, ilike, or, type SQL } from "drizzle-orm";
import { db, supplyOffersTable, companiesTable } from "@workspace/db";
import {
  ListSupplyOffersQueryParams,
  ListSupplyOffersResponse,
  CreateSupplyOfferBody,
  CreateSupplyOfferResponse,
  UpdateSupplyOfferParams,
  UpdateSupplyOfferBody,
  UpdateSupplyOfferResponse,
  DeleteSupplyOfferParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/supply-offers", async (req, res): Promise<void> => {
  const query = ListSupplyOffersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const filters: SQL[] = [];
  if (query.data.category) {
    filters.push(eq(supplyOffersTable.category, query.data.category));
  }
  if (query.data.search) {
    const term = `%${query.data.search}%`;
    const cond = or(
      ilike(supplyOffersTable.itemName, term),
      ilike(supplyOffersTable.description, term),
      ilike(companiesTable.name, term),
    );
    if (cond) filters.push(cond);
  }

  const rows = await db
    .select({
      id: supplyOffersTable.id,
      companyId: supplyOffersTable.companyId,
      companyName: companiesTable.name,
      category: supplyOffersTable.category,
      itemName: supplyOffersTable.itemName,
      unitPrice: supplyOffersTable.unitPrice,
      unit: supplyOffersTable.unit,
      currency: supplyOffersTable.currency,
      minOrderQty: supplyOffersTable.minOrderQty,
      description: supplyOffersTable.description,
      createdAt: supplyOffersTable.createdAt,
    })
    .from(supplyOffersTable)
    .leftJoin(companiesTable, eq(supplyOffersTable.companyId, companiesTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(supplyOffersTable.createdAt));

  const shaped = rows.map((r) => ({ ...r, companyName: r.companyName ?? "" }));
  res.json(ListSupplyOffersResponse.parse(toJson(shaped)));
});

router.post("/supply-offers", async (req, res): Promise<void> => {
  const parsed = CreateSupplyOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [offer] = await db
    .insert(supplyOffersTable)
    .values({
      companyId: data.companyId,
      category: data.category ?? "원재료",
      itemName: data.itemName,
      unitPrice: data.unitPrice ?? "",
      unit: data.unit ?? "",
      currency: data.currency ?? "USD",
      minOrderQty: data.minOrderQty ?? "",
      description: data.description ?? "",
    })
    .returning();

  const [company] = await db
    .select({ name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.id, offer.companyId));

  res.status(201).json(
    CreateSupplyOfferResponse.parse(
      toJson({ ...offer, companyName: company?.name ?? "" }),
    ),
  );
});

router.patch("/supply-offers/:id", async (req, res): Promise<void> => {
  const params = UpdateSupplyOfferParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSupplyOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(supplyOffersTable)
    .where(eq(supplyOffersTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Supply offer not found" });
    return;
  }

  const [offer] = await db
    .update(supplyOffersTable)
    .set(parsed.data)
    .where(eq(supplyOffersTable.id, params.data.id))
    .returning();

  const [company] = await db
    .select({ name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.id, offer.companyId));

  res.json(
    UpdateSupplyOfferResponse.parse(
      toJson({ ...offer, companyName: company?.name ?? "" }),
    ),
  );
});

router.delete("/supply-offers/:id", async (req, res): Promise<void> => {
  const params = DeleteSupplyOfferParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(supplyOffersTable)
    .where(eq(supplyOffersTable.id, params.data.id));

  res.status(204).send();
});

export default router;
