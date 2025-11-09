import { Router } from "express";
import { findAllSafe, findByPkSafe } from "../../utils/legacyModel";

const router = Router();

router.get("/", async (_req, res) => {
  const prompts = await findAllSafe("Prompt", { order: [["id", "ASC"]] });
  return res.json({ prompts });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const prompt = await findByPkSafe("Prompt", id);
  if (!prompt) return res.status(404).json({ error: true, message: "not found" });
  return res.json(prompt);
});

export default router;





