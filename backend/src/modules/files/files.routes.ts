import { Router } from "express";
import { findAllSafe, findByPkSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const files = await findAllSafe("File", { offset, limit });
  return res.json({ files, hasMore: files.length === limit });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const record = await findByPkSafe("File", id);
  if (!record) return res.status(404).json({ error: true, message: "not found" });
  return res.json(record);
});

export default router;





