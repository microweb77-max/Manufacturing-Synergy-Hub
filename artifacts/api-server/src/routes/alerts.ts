import { Router, type IRouter } from "express";
import { UnsubscribeAlertsQueryParams } from "@workspace/api-zod";
import { unsubscribeByToken } from "../lib/userItems";

const router: IRouter = Router();

const page = (title: string, body: string) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center">
<h1 style="font-size:20px">${title}</h1><p>${body}</p></body></html>`;

// Public (the token is the credential). GET so it works from a mail link.
router.get("/alerts/unsubscribe", async (req, res): Promise<void> => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  const q = UnsubscribeAlertsQueryParams.safeParse(req.query);
  if (!q.success || !(await unsubscribeByToken(q.data.token))) {
    res.status(400).type("html").send(page("유효하지 않은 링크", "해지 링크가 올바르지 않거나 만료되었습니다."));
    return;
  }
  res.type("html").send(page("주간 알림 해지 완료", "더 이상 주간 행사 알림 메일을 보내지 않습니다. 알림 설정에서 다시 켤 수 있습니다."));
});

export default router;
