import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind Replit's proxy: use X-Forwarded-For for req.ip (rate limiting).
app.set("trust proxy", 1);

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
app.disable("x-powered-by");

// Basic security headers for API responses.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// The web app is served from the same origin (Replit path router), so CORS is
// only enabled for explicitly listed origins (comma-separated CORS_ORIGINS).
const corsOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}

app.use(cookieParser());

// Large bodies only where files (base64) are uploaded; small everywhere else.
const UPLOAD_ROUTES = [
  /^\/api\/companies(\/\d+)?$/,
  /^\/api\/companies\/analyze-material$/,
  /^\/api\/banners(\/\d+)?$/,
  /^\/api\/solutions(\/\d+)?$/,
  /^\/api\/resume-submissions$/,
];
const largeJson = express.json({ limit: "12mb" });
const smallJson = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  const path = req.path;
  (UPLOAD_ROUTES.some((re) => re.test(path)) ? largeJson : smallJson)(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "요청한 API를 찾을 수 없습니다." });
});

// Central error handler: log details, return a generic JSON error.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;
  if (status >= 500) {
    req.log.error({ err }, "Unhandled error");
  }
  if (res.headersSent) return;
  const message =
    status === 413
      ? "요청 크기가 너무 큽니다."
      : status === 400
        ? "잘못된 요청입니다."
        : "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  res.status(status).json({ error: message });
});

export default app;
