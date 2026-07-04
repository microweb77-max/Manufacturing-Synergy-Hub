import { Router, type IRouter } from "express";
import healthRouter from "./health";
import companiesRouter from "./companies";
import projectsRouter from "./projects";
import matchesRouter from "./matches";
import solutionsRouter from "./solutions";
import performanceRouter from "./performance";
import talentRouter from "./talent";
import supplyOffersRouter from "./supplyOffers";
import offerMatchesRouter from "./offerMatches";
import projectApplicationsRouter from "./applications";
import resumeSubmissionsRouter from "./resumeSubmissions";
import navRouter from "./nav";
import newsRouter from "./news";
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
router.use(supplyOffersRouter);
router.use(offerMatchesRouter);
router.use(projectApplicationsRouter);
router.use(resumeSubmissionsRouter);
router.use(navRouter);
router.use(newsRouter);
router.use(clientCompaniesRouter);
router.use(dashboardRouter);

export default router;
