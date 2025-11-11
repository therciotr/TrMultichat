import { Router } from "express";
import { findAllSafe } from "../../utils/legacyModel";

const router = Router();

// GET /plans/list - lista de planos disponíveis
router.get("/list", async (_req, res) => {
  try {
    const plans = await findAllSafe("Plan", { order: [["id", "ASC"]] });
    return res.json(plans);
  } catch {
    return res.json([]);
  }
});

// Opcional: GET /plans/all (algumas UIs consultam)
router.get("/all", async (_req, res) => {
  try {
    const plans = await findAllSafe("Plan", { order: [["id", "ASC"]] });
    return res.json(plans);
  } catch {
    return res.json([]);
  }
});

export default router;


