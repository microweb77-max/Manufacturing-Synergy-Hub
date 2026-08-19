import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { ListClientCompaniesResponse } from "@workspace/api-zod";
import clientCompanies from "../data/clientCompanies.json";

const router: IRouter = Router();

const legacyCompanies = ListClientCompaniesResponse.parse(clientCompanies);

function normalizeCompanyName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
}

function splitLocation(location: string): { region: string; address: string } {
  const [region, ...addressParts] = location.split("—");

  return {
    region: region?.trim() ?? "",
    address: addressParts.join("—").trim(),
  };
}

router.get("/client-companies", async (_req, res): Promise<void> => {
  const kochamCustomers = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.type, "customer"));

  // Retain the richer FDI record when a company appears in both sources.
  const legacyNames = new Set(
    legacyCompanies.flatMap((company) =>
      [company.nameKo, company.nameEn]
        .filter(Boolean)
        .map(normalizeCompanyName),
    ),
  );

  const uniqueKochamCustomers = kochamCustomers.filter(
    (company) => !legacyNames.has(normalizeCompanyName(company.name)),
  );

  const kochamCompanies = uniqueKochamCustomers.map((company) => {
    const { region, address } = splitLocation(company.location);

    return {
      no: 0,
      nameKo: "",
      nameEn: company.name,
      parentCompany: "",
      entryType: "KOCHAM 2025",
      investmentType: "",
      industry: company.description,
      industryDetail: company.techSpecs,
      region,
      address,
      postalCode: "",
    };
  });

  const mergedCompanies = [...legacyCompanies, ...kochamCompanies].map(
    (company, index) => ({ ...company, no: index + 1 }),
  );

  res.json(ListClientCompaniesResponse.parse(mergedCompanies));
});

export default router;
