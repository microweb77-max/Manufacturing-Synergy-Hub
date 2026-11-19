import { Router, type RequestHandler } from "express";
import { collectTenders, TenderCollectionError } from "../routes/tenders";
import { schedulerTokenMatches } from "./newsSchedule";

// Same bearer-token scheme as the news/events jobs (NEWS_SCHEDULER_TOKEN).
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

export function createScheduledTendersCollectHandler(collect = collectTenders, getSecret?: () => string | undefined): RequestHandler {
  return guard(async (req, res) => {
    try {
      const result = await collect();
      req.log?.info({ inserted: result.inserted, skipped: result.skipped }, "Scheduled tenders collection completed");
      res.json({ inserted: result.inserted, skipped: result.skipped });
    } catch (err) {
      req.log?.error({ err }, "Scheduled tenders collection failed");
      const status = err instanceof TenderCollectionError ? err.status : 502;
      if (status === 429) res.set("Retry-After", "60");
      res.status(status).json({ error: "예약 공고 수집에 실패했습니다. 다시 시도할 수 있습니다." });
    }
  }, getSecret);
}

const router = Router();
router.post("/tenders-collect", createScheduledTendersCollectHandler());
export default router;
