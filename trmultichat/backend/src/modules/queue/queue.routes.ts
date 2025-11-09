import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (_req, res) => {
  const queues = await findAllSafe("Queue", { order: [["id", "ASC"]] });
  return res.json(queues);
});

export default router;





