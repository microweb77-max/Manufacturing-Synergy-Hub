import { Router, type IRouter } from "express";
import healthRouter from "./health";
import companiesRouter from "./companies";
import projectsRouter from "./projects";
import matchesRouter from "./matches";
import solutionsRouter from "./solutions";
import performanceRouter from "./performance";
import talentRouter from "./talent";
import clientCompaniesRouter from "./clientCompanies";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(companiesRouter);
router.use(projectsRouter);
router.use(matchesRouter);
router.use(solutionsRouter);
router.use(performanceRouter);
router.use(talentRouter);
router.use(clientCompaniesRouter);
router.use(dashboardRouter);

export default router;
