import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { findAllSafe, getLegacyModel } from "../../utils/legacyModel";

const router = Router();

// Protege todas as rotas de ajuda (o frontend já envia Bearer token)
router.use(authMiddleware);

// GET /helps - lista ajudas
router.get("/", async (_req, res) => {
  try {
    const rows = await findAllSafe("Help", { order: [["id", "ASC"]] });
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// GET /helps/list - compat (front antigo)
router.get("/list", async (_req, res) => {
  try {
    const rows = await findAllSafe("Help", { order: [["id", "ASC"]] });
    return res.json(Array.isArray(rows) ? rows : []);
  } catch {
    return res.json([]);
  }
});

// POST /helps - cria help
router.post("/", async (req, res) => {
  try {
    const Help = getLegacyModel("Help");
    if (!Help || typeof Help.create !== "function") {
      return res.status(501).json({ error: true, message: "helps create not available" });
    }

    const body = req.body || {};
    const payload = {
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      video: String(body.video || "").trim()
    };

    if (!payload.title) {
      return res.status(400).json({ error: true, message: "title is required" });
    }

    const created = await Help.create(payload);
    const json = created?.toJSON ? created.toJSON() : created;
    return res.status(201).json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "create error" });
  }
});

// PUT /helps/:id - atualiza help
router.put("/:id", async (req, res) => {
  try {
    const Help = getLegacyModel("Help");
    if (!Help || typeof Help.findByPk !== "function") {
      return res.status(501).json({ error: true, message: "helps update not available" });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: true, message: "invalid help id" });
    }

    const instance = await Help.findByPk(id);
    if (!instance) return res.status(404).json({ error: true, message: "not found" });

    const body = req.body || {};
    const up: any = {};
    if (body.title !== undefined) up.title = String(body.title || "").trim();
    if (body.description !== undefined) up.description = String(body.description || "").trim();
    if (body.video !== undefined) up.video = String(body.video || "").trim();

    await instance.update(up);
    const json = instance?.toJSON ? instance.toJSON() : instance;
    return res.json(json);
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "update error" });
  }
});

// DELETE /helps/:id - remove help
router.delete("/:id", async (req, res) => {
  try {
    const Help = getLegacyModel("Help");
    if (!Help || typeof Help.destroy !== "function") {
      return res.status(501).json({ error: true, message: "helps delete not available" });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: true, message: "invalid help id" });
    }

    const count = await Help.destroy({ where: { id } });
    if (!count) return res.status(404).json({ error: true, message: "not found" });
    return res.status(204).end();
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "delete error" });
  }
});

export default router;


