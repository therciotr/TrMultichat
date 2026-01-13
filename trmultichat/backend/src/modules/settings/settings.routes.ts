import { Router } from "express";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { getLegacyModel } from "../../utils/legacyModel";
import { getCompanyMailSettings, saveCompanyMailSettings } from "../../utils/settingsMail";

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

function setNoCache(res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("ETag", `W/\"${Date.now()}\"`);
  } catch {}
}

router.get("/", async (req, res) => {
  setNoCache(res);
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

router.get("/email", async (req, res) => {
  try {
    const userHeader = req.headers.authorization as string;
    const tenantId = extractTenantIdFromAuth(userHeader) || 1;
    const settings = await getCompanyMailSettings(tenantId);
    return res.json({
      mail_host: settings.mail_host,
      mail_port: settings.mail_port,
      mail_user: settings.mail_user,
      mail_from: settings.mail_from,
      mail_secure: settings.mail_secure,
      has_password: settings.hasPassword
    });
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "get email settings error" });
  }
});

router.put("/email", async (req, res) => {
  try {
    const auth = req.headers.authorization as string;
    const tenantId = extractTenantIdFromAuth(auth) || 1;

    // ensure user is admin or super
    const parts = (auth || "").split(" ");
    const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
    if (bearer) {
      try {
        const payload = jwt.verify(bearer, env.JWT_SECRET) as { userId?: number };
        const User = getLegacyModel("User");
        if (User && typeof User.findByPk === "function" && payload?.userId) {
          const instance = await User.findByPk(payload.userId);
          const plain = instance?.get ? instance.get({ plain: true }) : instance;
          const isAdmin = !!plain?.admin;
          const isSuper = !!plain?.super;
          if (!isAdmin && !isSuper) {
            return res.status(403).json({ error: true, message: "forbidden" });
          }
        }
      } catch {
        return res.status(401).json({ error: true, message: "invalid token" });
      }
    }

    const { mail_host, mail_port, mail_user, mail_pass, mail_from, mail_secure } = req.body || {};

    await saveCompanyMailSettings(tenantId, {
      mail_host,
      mail_port,
      mail_user,
      mail_pass,
      mail_from,
      mail_secure
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res
      .status(400)
      .json({ error: true, message: e?.message || "update email settings error" });
  }
});

export default router;


