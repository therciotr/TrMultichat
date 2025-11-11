import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

// Same output as GET /queue, used by UI
router.get("/", async (_req, res) => {
  const queues = await findAllSafe("Queue", { order: [["id", "ASC"]] });
  return res.json(queues);
});

export default router;


