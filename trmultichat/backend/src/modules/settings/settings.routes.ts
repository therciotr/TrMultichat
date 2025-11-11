import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getLegacyModel } from "../../utils/legacyModel";

const router = Router();

function extractTenantIdFromAuth(authorization?: string): number {
  try {
    const parts = (authorization || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (!bearer) return 1;
    const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
    return Number(payload?.tenantId || 1);
  } catch {
    return 1;
  }
}

router.get("/", async (req, res) => {
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
  try {
    const Setting = getLegacyModel("Setting");
    if (!Setting || typeof Setting.findAll !== "function") {
      // fallback vazio para a UI lidar
      return res.json([]);
    }
    const rows = await Setting.findAll({ where: { companyId: tenantId } });
    const list = Array.isArray(rows) ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r)) : [];
    // UI espera array [{ key, value }]
    const simplified = list.map((r: any) => ({ key: r.key, value: r.value }));
    return res.json(simplified);
  } catch (e: any) {
    return res.status(200).json([]);
  }
});

router.put("/:key", async (req, res) => {
  const key = String(req.params.key);
  const value = String((req.body && req.body.value) ?? "");
  const tenantId = extractTenantIdFromAuth(req.headers.authorization as string) || 1;
  try {
    const Setting = getLegacyModel("Setting");
    if (!Setting || typeof Setting.findOne !== "function") {
      return res.status(501).json({ error: true, message: "settings not available" });
    }
    let row = await Setting.findOne({ where: { companyId: tenantId, key } });
    if (row) {
      await row.update({ value });
    } else if (typeof Setting.create === "function") {
      row = await Setting.create({ key, value, companyId: tenantId });
    }
    const json = row?.toJSON ? row.toJSON() : row;
    return res.json({ key: json?.key ?? key, value: json?.value ?? value });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "settings error" });
  }
});

export default router;


