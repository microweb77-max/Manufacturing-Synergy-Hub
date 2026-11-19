import express, { type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { createApiAuthorization } from "./middlewares/apiAuthorization";
import scheduledNewsRouter from "./jobs/newsSchedule";
import scheduledEventsRouter from "./jobs/eventsSchedule";
import { apiSecurityHeaders, createApiCors, parseApiJson, apiNotFound, apiErrorHandler } from "./middlewares/requestGuards";

const app: Express = express();
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Clerk proxy streams must remain untouched by body parsing and frame headers.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use("/api", apiSecurityHeaders);
// Machine-to-machine endpoint: independent bearer authentication, never Clerk
// cookies or browser-controlled admin flags. Keep all normal API writes protected.
app.use("/api/scheduled", scheduledNewsRouter);
app.use("/api/scheduled", scheduledEventsRouter);
// No reflected credentialed CORS: web requests use same-origin session cookies.
app.use(createApiCors());
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(req) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
})));
app.use(parseApiJson);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/api", createApiAuthorization());

app.use("/api", router);
app.use("/api", apiNotFound);
app.use(apiErrorHandler);

export default app;
