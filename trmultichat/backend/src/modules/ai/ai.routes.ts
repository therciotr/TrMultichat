import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { Configuration, OpenAIApi } from "openai";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function setNoCache(res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("ETag", "0");
    res.setHeader("Last-Modified", "0");
  } catch {}
}

async function getSettingValue(companyId: number, key: string): Promise<string | null> {
  const tables = ['"Settings"', '"Setting"', '"settings"', '"setting"'];
  for (const t of tables) {
    try {
      const rows = await pgQuery<{ value: any }>(
        `SELECT value FROM ${t} WHERE "companyId" = $1 AND key = $2 LIMIT 1`,
        [companyId, key]
      );
      const v = rows?.[0]?.value;
      if (v === undefined || v === null) return null;
      return String(v);
    } catch {}
  }
  return null;
}

type Provider = "openai" | "cursor";

async function resolveProviderConfig(companyId: number, provider: Provider) {
  if (provider === "openai") {
    const apiKey = (await getSettingValue(companyId, "openaiApiKey")) || "";
    const model = (await getSettingValue(companyId, "openaiModel")) || "gpt-3.5-turbo";
    const baseUrl = (await getSettingValue(companyId, "openaiBaseUrl")) || "https://api.openai.com/v1";
    return { apiKey, model, baseUrl };
  }

  const apiKey = (await getSettingValue(companyId, "cursorApiKey")) || "";
  const model = (await getSettingValue(companyId, "cursorModel")) || "gpt-3.5-turbo";
  const baseUrl = (await getSettingValue(companyId, "cursorBaseUrl")) || "";
  return { apiKey, model, baseUrl };
}

async function runChatCompletion(params: { apiKey: string; model: string; baseUrl?: string; message: string }) {
  const apiKey = String(params.apiKey || "").trim();
  if (!apiKey) throw new Error("missing apiKey");
  const model = String(params.model || "gpt-3.5-turbo").trim() || "gpt-3.5-turbo";
  const basePath =
    params.baseUrl && String(params.baseUrl).trim()
      ? String(params.baseUrl).trim().replace(/\/+$/, "")
      : undefined;

  const cfg = new Configuration({
    apiKey,
    basePath
  } as any);
  const openai = new OpenAIApi(cfg);

  const resp = await openai.createChatCompletion({
    model,
    messages: [{ role: "user", content: params.message }]
  } as any);

  const text =
    (resp as any)?.data?.choices?.[0]?.message?.content ??
    (resp as any)?.data?.choices?.[0]?.text ??
    "";
  return String(text || "").trim();
}

router.post("/test", authMiddleware, async (req, res) => {
  setNoCache(res);
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const provider = String(req?.body?.provider || "openai") as Provider;
  const message = String(req?.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: true, message: "message is required" });
  if (provider !== "openai" && provider !== "cursor") {
    return res.status(400).json({ error: true, message: "invalid provider" });
  }

  try {
    const cfg = await resolveProviderConfig(companyId, provider);
    if (!String(cfg.apiKey || "").trim()) {
      return res.status(400).json({ error: true, message: `missing ${provider} apiKey` });
    }
    if (provider === "cursor" && !String(cfg.baseUrl || "").trim()) {
      return res.status(400).json({ error: true, message: "missing cursor baseUrl" });
    }

    const response = await runChatCompletion({
      apiKey: cfg.apiKey,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      message
    });
    return res.json({ ok: true, provider, response });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || "ai test failed" });
  }
});

export default router;


