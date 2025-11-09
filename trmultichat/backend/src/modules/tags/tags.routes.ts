import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const tags = await findAllSafe("Tag", { offset, limit });
  return res.json({ tags, hasMore: tags.length === limit });
});

router.get("/kanban", async (_req, res) => {
  return res.json({ lista: [] });
});

export default router;





