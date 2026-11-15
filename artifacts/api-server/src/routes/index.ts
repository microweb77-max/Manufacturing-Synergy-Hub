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
import bannersRouter from "./banners";
import clientCompaniesRouter from "./clientCompanies";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import mediaRouter from "./media";
import { accessPolicy } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(mediaRouter);
// Everything below is subject to the central access policy (see lib/auth.ts).
router.use(accessPolicy);
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
router.use(bannersRouter);
router.use(clientCompaniesRouter);
router.use(dashboardRouter);

export default router;
