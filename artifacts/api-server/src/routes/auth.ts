import { Router, type IRouter } from "express";
import { resolveIdentity } from "../middlewares/apiAuthorization";
import { GetCurrentSessionResponse } from "@workspace/api-zod";

const router: IRouter = Router();
router.get("/auth/me", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  try {
    const identity = await resolveIdentity(req);
    res.json(GetCurrentSessionResponse.parse({
      userId: identity?.userId ?? null,
      isAdmin: identity?.isAdmin ?? false,
    }));
  } catch {
    req.log.error("Unable to read account permissions");
    res.status(503).json({ error: "계정 권한을 확인할 수 없습니다." });
  }
});
export default router;