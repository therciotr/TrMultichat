import { Router } from "express";
import { findAllSafe, findByPkSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const queueIntegrations = await findAllSafe("QueueIntegration", { offset, limit });
  return res.json({ queueIntegrations, hasMore: queueIntegrations.length === limit });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const record = await findByPkSafe("QueueIntegration", id);
  if (!record) return res.status(404).json({ error: true, message: "not found" });
  return res.json(record);
});

export default router;





