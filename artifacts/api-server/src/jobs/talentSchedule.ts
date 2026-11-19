import { Router, type RequestHandler } from "express";
import { collectJobs, TalentCollectionError } from "../routes/talent";
import { NEWS_TIMEZONE, schedulerTokenMatches, vietnamDay } from "./newsSchedule";

// Daily 구인 (hiring) collection. Shares the news scheduler credential
// (NEWS_SCHEDULER_TOKEN); idempotent per Vietnam calendar day.
export function createScheduledTalentHandler(
  collect = collectJobs,
  getSecret = () => process.env.NEWS_SCHEDULER_TOKEN,
  now = () => new Date(),
): RequestHandler {
  return async (req, res) => {
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
    const day = vietnamDay(now());
    try {
      const result = await collect("hiring", "", day);
      req.log?.info({ day, inserted: result.inserted, alreadyCompleted: result.alreadyCompleted }, "Scheduled talent refresh completed");
      res.json({
        scheduledDay: day, timezone: NEWS_TIMEZONE, postType: "hiring",
        inserted: result.inserted, skipped: result.skipped,
        alreadyCompleted: result.alreadyCompleted,
      });
    } catch (err) {
      req.log?.error({ err, day }, "Scheduled talent refresh failed");
      const status = err instanceof TalentCollectionError ? err.status : 502;
      if (status === 429) res.set("Retry-After", "60");
      res.status(status).json({ error: "예약 구인 정보 수집에 실패했습니다. 다시 시도할 수 있습니다." });
    }
  };
}

const router = Router();
router.post("/talent", createScheduledTalentHandler());
export default router;
