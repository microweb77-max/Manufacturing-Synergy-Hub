import { Router, type IRouter } from "express";
import { ListClientCompaniesResponse } from "@workspace/api-zod";
import clientCompanies from "../data/clientCompanies.json";

const router: IRouter = Router();

const data = ListClientCompaniesResponse.parse(clientCompanies);

router.get("/client-companies", async (_req, res): Promise<void> => {
  res.json(data);
});

export default router;
