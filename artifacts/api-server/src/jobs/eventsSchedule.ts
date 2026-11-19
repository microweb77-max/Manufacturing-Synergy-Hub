import { Router, type RequestHandler } from "express";
import { collectEvents, EventCollectionError } from "../routes/events";
import { sendWeeklyEventAlerts } from "../lib/userItems";
import { schedulerTokenMatches } from "./newsSchedule";

// Same bearer-token scheme as the hourly news job (NEWS_SCHEDULER_TOKEN).
function guard(handler: RequestHandler, getSecret = () => process.env.NEWS_SCHEDULER_TOKEN): RequestHandler {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const secret = getSecret();
    if (!secret || secret.length < 32) {
      res.status(503).json({ error: "예약 호출 인증이 설정되지 않았습니다." });
      return;
    }
    if (!schedulerTokenMatches(req.get("authorization"), secret)) {
      res.status(401).json({ error: "예약 호출 인증에 실패했습니다." });
      return;
    }
    await handler(req, res, next);
  };
}

export function createScheduledEventsCollectHandler(collect = collectEvents, getSecret?: () => string | undefined): RequestHandler {
  return guard(async (req, res) => {
    try {
      const result = await collect("");
      req.log?.info({ inserted: result.inserted, skipped: result.skipped }, "Scheduled events collection completed");
      res.json({ inserted: result.inserted, skipped: result.skipped });
    } catch (err) {
      req.log?.error({ err }, "Scheduled events collection failed");
      const status = err instanceof EventCollectionError ? err.status : 502;
      if (status === 429) res.set("Retry-After", "60");
      res.status(status).json({ error: "예약 행사 수집에 실패했습니다. 다시 시도할 수 있습니다." });
    }
  }, getSecret);
}

export function unsubscribeUrlBuilder(headers: { host?: string; "x-forwarded-host"?: string | string[] }) {
  const base = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "");
  const forwarded = headers["x-forwarded-host"];
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || headers.host;
  const origin = base ?? (host ? `${/^(localhost|127\.)/.test(host) ? "http" : "https"}://${host}` : "");
  return (token: string) => `${origin}/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function createWeeklyAlertsHandler(send = sendWeeklyEventAlerts, getSecret?: () => string | undefined): RequestHandler {
  return guard(async (req, res) => {
    try {
      const result = await send(unsubscribeUrlBuilder(req.headers));
      req.log?.info(result, "Weekly alerts processed");
      res.json(result);
    } catch (err) {
      req.log?.error({ err }, "Weekly alerts failed");
      res.status(502).json({ error: "주간 알림 처리에 실패했습니다." });
    }
  }, getSecret);
}

const router = Router();
router.post("/events-collect", createScheduledEventsCollectHandler());
router.post("/weekly-alerts", createWeeklyAlertsHandler());
export default router;
