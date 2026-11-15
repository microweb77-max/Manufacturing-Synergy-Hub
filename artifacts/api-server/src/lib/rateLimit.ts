import type { RequestHandler } from "express";

// Per-instance guard, not a distributed quota. It supplements verified company
// permissions and never supplies authentication or trusts a submitted user ID.
export function rateLimit({
  windowMs, max, message, now = Date.now, maxKeys = 10_000,
}: {
  windowMs: number;
  max: number;
  message: string;
  now?: () => number;
  maxKeys?: number;
}): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const time = now();
    const key = res.locals.identity?.userId ?? req.ip ?? "unknown";
    const entry = hits.get(key);
    const reject = (resetAt: number) => {
      res.set("Retry-After", String(Math.max(1, Math.ceil((resetAt - time) / 1000))));
      res.status(429).json({ error: message });
    };
    if (!entry || entry.resetAt <= time) {
      if (!entry && hits.size >= maxKeys) {
        for (const [oldKey, value] of hits) if (value.resetAt <= time) hits.delete(oldKey);
        if (hits.size >= maxKeys) {
          reject(time + windowMs);
          return;
        }
      }
      hits.set(key, { count: 1, resetAt: time + windowMs });
      next();
      return;
    }
    if (entry.count >= max) {
      reject(entry.resetAt);
      return;
    }
    entry.count++;
    next();
  };
}
