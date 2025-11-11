import { Router } from "express";
import { findAllSafe, findByPkSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (req, res) => {
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  // Model name in legacy compiled app is QueueIntegrations
  const queueIntegrations = await findAllSafe("QueueIntegrations", { offset, limit });
  return res.json({ queueIntegrations, hasMore: queueIntegrations.length === limit });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const record = await findByPkSafe("QueueIntegrations", id);
  if (!record) return res.status(404).json({ error: true, message: "not found" });
  return res.json(record);
});

export default router;





