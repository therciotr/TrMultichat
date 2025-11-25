import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const records = await findAllSafe("QuickMessage", { offset, limit });
  return res.json({ records, hasMore: records.length === limit });
});

export default router;





