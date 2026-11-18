import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import cors from "cors";

export const apiSecurityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
};

// Same-origin is the default. Explicit external clients may be allowlisted;
// never reflect arbitrary Origin headers with session credentials.
export function createApiCors(origins = process.env.CORS_ORIGINS ?? ""): RequestHandler {
  const allowed = origins.split(",").map((origin) => origin.trim()).filter(Boolean);
  return allowed.length
    ? cors({ origin: allowed, credentials: true })
    : (_req, _res, next) => next();
}

const uploadRoutes = [
  /^\/api\/companies(\/\d+)?$/,
  /^\/api\/companies\/analyze-material$/,
  /^\/api\/banners(\/\d+)?$/,
  /^\/api\/solutions(\/\d+)?$/,
  /^\/api\/resume-submissions$/,
  // Company verification still accepts an uploaded business document.
  /^\/api\/membership\/claims$/,
];
const largeJson = express.json({ limit: "12mb" });
const smallJson = express.json({ limit: "1mb" });

export const parseApiJson: RequestHandler = (req, res, next) => {
  const path = req.path.toLowerCase().replace(/\/+$/, "");
  (uploadRoutes.some((route) => route.test(path)) ? largeJson : smallJson)(req, res, next);
};

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "요청한 API를 찾을 수 없습니다." });
};

export const apiErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;
  const rawStatus = typeof err === "object" && err !== null ? err.status : undefined;
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  if (status >= 500) req.log?.error({ err }, "Unhandled API error");
  res.status(status).json({
    error: status === 413 ? "요청 크기가 너무 큽니다."
      : status === 400 ? "잘못된 요청입니다."
        : "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  });
};
