import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { collectNews, NewsCollectionError } from "../routes/news";

export const NEWS_TIMEZONE = "Asia/Ho_Chi_Minh";

// Vietnam is UTC+07:00 year-round (no daylight-saving transitions).
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function vietnamDay(now = new Date()): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

// Hourly collection slot in Vietnam time, e.g. "2026-10-07T00".
export function vietnamSlot(now = new Date()): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 13);
}

export function schedulerTokenMatches(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  if (!token || token.length > 1024) return false;
  return timingSafeEqual(
    createHash("sha256").update(token).digest(),
    createHash("sha256").update(secret).digest(),
  );
}

export function createScheduledNewsHandler(
  collect = collectNews,
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
    const at = now();
    const slot = vietnamSlot(at);
    const day = vietnamDay(at);
    try {
      const result = await collect("", slot);
      req.log?.info({ slot, inserted: result.inserted, alreadyCompleted: result.alreadyCompleted }, "Scheduled news refresh completed");
      res.json({
        scheduledDay: day, scheduledSlot: slot, timezone: NEWS_TIMEZONE,
        inserted: result.inserted, skipped: result.skipped,
        alreadyCompleted: result.alreadyCompleted,
      });
    } catch (err) {
      req.log?.error({ err, slot }, "Scheduled news refresh failed");
      const status = err instanceof NewsCollectionError ? err.status : 502;
      if (status === 429) res.set("Retry-After", "60");
      res.status(status).json({ error: "예약 뉴스 수집에 실패했습니다. 다시 시도할 수 있습니다." });
    }
  };
}

const router = Router();
router.post("/news", createScheduledNewsHandler());
export default router;
