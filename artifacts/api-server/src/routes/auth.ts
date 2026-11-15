import { Router, type IRouter } from "express";
import { AdminLoginBody } from "@workspace/api-zod";
import {
  checkPassword,
  clearSession,
  isAdmin,
  isAuthConfigured,
  issueSession,
  rateLimit,
} from "../lib/auth";

const router: IRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
});

router.get("/auth/me", (req, res) => {
  res.json({ isAdmin: isAdmin(req), configured: isAuthConfigured() });
});

router.post("/auth/login", loginLimiter, (req, res): void => {
  if (!isAuthConfigured()) {
    res.status(503).json({
      error: "관리자 비밀번호(ADMIN_PASSWORD)가 서버에 설정되지 않았습니다.",
    });
    return;
  }
  const body = AdminLoginBody.safeParse(req.body);
  if (!body.success || !checkPassword(body.data.password)) {
    res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
    return;
  }
  issueSession(res);
  res.json({ isAdmin: true, configured: true });
});

router.post("/auth/logout", (_req, res) => {
  clearSession(res);
  res.json({ isAdmin: false, configured: isAuthConfigured() });
});

export default router;
