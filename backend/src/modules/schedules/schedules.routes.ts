import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const schedules = await findAllSafe("Schedule", { offset, limit });
  return res.json({ schedules, hasMore: schedules.length === limit });
});

export default router;





