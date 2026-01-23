import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";
import { getIO } from "../../libs/socket";

const router = Router();

function tenantIdFromReq(req: any): number {
  return Number(req?.tenantId || 0);
}

function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function resolveTableName(candidates: string[]): Promise<string> {
  for (const c of candidates) {
    try {
      const rows = await pgQuery<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND LOWER(table_name)=LOWER($1) LIMIT 1`,
        [c]
      );
      const t = rows?.[0]?.table_name;
      if (t) return quoteIdent(t);
    } catch {}
  }
  // default to first candidate (quoted)
  return quoteIdent(candidates[0]);
}

async function resolveColumnsMap(tableNameQuoted: string): Promise<Map<string, string>> {
  const table = String(tableNameQuoted).replace(/"/g, "");
  const rows = await pgQuery<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  const map = new Map<string, string>();
  for (const r of rows || []) {
    if (r?.column_name) map.set(String(r.column_name).toLowerCase(), String(r.column_name));
  }
  return map;
}

function pickColumn(cols: Map<string, string>, candidates: string[], fallback: string): string {
  for (const c of candidates) {
    const found = cols.get(String(c).toLowerCase());
    if (found) return found;
  }
  return fallback;
}

router.get("/", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const promptsTable = await resolveTableName(["Prompts", "Prompt"]);
  const queuesTable = await resolveTableName(["Queues", "Queue"]);

  const pCols = await resolveColumnsMap(promptsTable);
  const qCols = await resolveColumnsMap(queuesTable);

  const pId = pickColumn(pCols, ["id"], "id");
  const pCompanyId = pickColumn(pCols, ["companyId", "tenantId"], "companyId");
  const pQueueId = pickColumn(pCols, ["queueId"], "queueId");
  const pName = pickColumn(pCols, ["name"], "name");
  const pPrompt = pickColumn(pCols, ["prompt"], "prompt");
  const pVoice = pickColumn(pCols, ["voice"], "voice");
  const pVoiceKey = pickColumn(pCols, ["voiceKey"], "voiceKey");
  const pVoiceRegion = pickColumn(pCols, ["voiceRegion"], "voiceRegion");
  const pMaxTokens = pickColumn(pCols, ["maxTokens", "max_tokens"], "maxTokens");
  const pTemperature = pickColumn(pCols, ["temperature"], "temperature");
  const pApiKey = pickColumn(pCols, ["apiKey", "apikey"], "apiKey");
  const pMaxMessages = pickColumn(pCols, ["maxMessages", "max_messages"], "maxMessages");

  const qId = pickColumn(qCols, ["id"], "id");
  const qName = pickColumn(qCols, ["name"], "name");

  const rows = await pgQuery<any>(
    `SELECT 
      p.${quoteIdent(pId)} as "id",
      p.${quoteIdent(pName)} as "name",
      p.${quoteIdent(pPrompt)} as "prompt",
      p.${quoteIdent(pVoice)} as "voice",
      p.${quoteIdent(pVoiceKey)} as "voiceKey",
      p.${quoteIdent(pVoiceRegion)} as "voiceRegion",
      p.${quoteIdent(pMaxTokens)} as "maxTokens",
      p.${quoteIdent(pTemperature)} as "temperature",
      p.${quoteIdent(pApiKey)} as "apiKey",
      p.${quoteIdent(pQueueId)} as "queueId",
      p.${quoteIdent(pMaxMessages)} as "maxMessages",
      q.${quoteIdent(qId)} as "queue_id",
      q.${quoteIdent(qName)} as "queue_name"
    FROM ${promptsTable} p
    LEFT JOIN ${queuesTable} q ON q.${quoteIdent(qId)} = p.${quoteIdent(pQueueId)}
    WHERE p.${quoteIdent(pCompanyId)} = $1
    ORDER BY p.${quoteIdent(pId)} ASC`,
    [companyId]
  );

  const prompts = (rows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    prompt: r.prompt,
    voice: r.voice,
    voiceKey: r.voiceKey,
    voiceRegion: r.voiceRegion,
    maxTokens: Number(r.maxTokens ?? 0),
    temperature: Number(r.temperature ?? 0),
    apiKey: r.apiKey ?? "",
    queueId: r.queueId ?? null,
    maxMessages: Number(r.maxMessages ?? 0),
    queue: { id: r.queue_id ?? r.queueId ?? null, name: r.queue_name ?? "" }
  }));

  return res.json({ prompts });
});

router.get("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const promptsTable = await resolveTableName(["Prompts", "Prompt"]);
  const pCols = await resolveColumnsMap(promptsTable);
  const pId = pickColumn(pCols, ["id"], "id");
  const pCompanyId = pickColumn(pCols, ["companyId", "tenantId"], "companyId");

  const rows = await pgQuery<any>(
    `SELECT * FROM ${promptsTable} WHERE ${quoteIdent(pId)} = $1 AND ${quoteIdent(pCompanyId)} = $2 LIMIT 1`,
    [id, companyId]
  );
  const prompt = rows?.[0];
  if (!prompt) return res.status(404).json({ error: true, message: "not found" });
  return res.json(prompt);
});

router.post("/", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const body = req.body || {};
  const promptsTable = await resolveTableName(["Prompts", "Prompt"]);
  const cols = await resolveColumnsMap(promptsTable);

  const cCompanyId = pickColumn(cols, ["companyId", "tenantId"], "companyId");
  const cName = pickColumn(cols, ["name"], "name");
  const cPrompt = pickColumn(cols, ["prompt"], "prompt");
  const cVoice = pickColumn(cols, ["voice"], "voice");
  const cVoiceKey = pickColumn(cols, ["voiceKey"], "voiceKey");
  const cVoiceRegion = pickColumn(cols, ["voiceRegion"], "voiceRegion");
  const cMaxTokens = pickColumn(cols, ["maxTokens", "max_tokens"], "maxTokens");
  const cTemperature = pickColumn(cols, ["temperature"], "temperature");
  const cApiKey = pickColumn(cols, ["apiKey", "apikey"], "apiKey");
  const cQueueId = pickColumn(cols, ["queueId"], "queueId");
  const cMaxMessages = pickColumn(cols, ["maxMessages", "max_messages"], "maxMessages");
  const cCreatedAt = pickColumn(cols, ["createdAt"], "createdAt");
  const cUpdatedAt = pickColumn(cols, ["updatedAt"], "updatedAt");

  const name = String(body.name || "").trim();
  const prompt = String(body.prompt || "").trim();
  const queueId = body.queueId === undefined || body.queueId === null || String(body.queueId).trim() === "" ? null : Number(body.queueId);
  if (!name) return res.status(400).json({ error: true, message: "name is required" });
  if (!prompt) return res.status(400).json({ error: true, message: "prompt is required" });
  if (!queueId || Number.isNaN(queueId)) return res.status(400).json({ error: true, message: "queueId is required" });

  const now = new Date();
  const rows = await pgQuery<any>(
    `INSERT INTO ${promptsTable}
      (${quoteIdent(cName)},${quoteIdent(cPrompt)},${quoteIdent(cVoice)},${quoteIdent(cVoiceKey)},${quoteIdent(cVoiceRegion)},${quoteIdent(cMaxTokens)},${quoteIdent(cTemperature)},${quoteIdent(cApiKey)},${quoteIdent(cQueueId)},${quoteIdent(cMaxMessages)},${quoteIdent(cCompanyId)},${quoteIdent(cCreatedAt)},${quoteIdent(cUpdatedAt)})
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      name,
      prompt,
      String(body.voice || "texto"),
      String(body.voiceKey || ""),
      String(body.voiceRegion || ""),
      Number(body.maxTokens ?? 100),
      Number(body.temperature ?? 1),
      String(body.apiKey || ""),
      queueId,
      Number(body.maxMessages ?? 10),
      companyId,
      now,
      now
    ]
  );

  const created = rows?.[0];
  try {
    const io = getIO();
    io.emit("prompt", { action: "create", prompt: created });
  } catch {}
  return res.json(created);
});

router.put("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const body = req.body || {};
  const promptsTable = await resolveTableName(["Prompts", "Prompt"]);
  const cols = await resolveColumnsMap(promptsTable);

  const cId = pickColumn(cols, ["id"], "id");
  const cCompanyId = pickColumn(cols, ["companyId", "tenantId"], "companyId");
  const cName = pickColumn(cols, ["name"], "name");
  const cPrompt = pickColumn(cols, ["prompt"], "prompt");
  const cVoice = pickColumn(cols, ["voice"], "voice");
  const cVoiceKey = pickColumn(cols, ["voiceKey"], "voiceKey");
  const cVoiceRegion = pickColumn(cols, ["voiceRegion"], "voiceRegion");
  const cMaxTokens = pickColumn(cols, ["maxTokens", "max_tokens"], "maxTokens");
  const cTemperature = pickColumn(cols, ["temperature"], "temperature");
  const cApiKey = pickColumn(cols, ["apiKey", "apikey"], "apiKey");
  const cQueueId = pickColumn(cols, ["queueId"], "queueId");
  const cMaxMessages = pickColumn(cols, ["maxMessages", "max_messages"], "maxMessages");
  const cUpdatedAt = pickColumn(cols, ["updatedAt"], "updatedAt");

  const name = String(body.name || "").trim();
  const prompt = String(body.prompt || "").trim();
  const queueId = body.queueId === undefined || body.queueId === null || String(body.queueId).trim() === "" ? null : Number(body.queueId);
  if (!name) return res.status(400).json({ error: true, message: "name is required" });
  if (!prompt) return res.status(400).json({ error: true, message: "prompt is required" });
  if (!queueId || Number.isNaN(queueId)) return res.status(400).json({ error: true, message: "queueId is required" });

  const now = new Date();
  const rows = await pgQuery<any>(
    `UPDATE ${promptsTable} SET
      ${quoteIdent(cName)} = $1,
      ${quoteIdent(cPrompt)} = $2,
      ${quoteIdent(cVoice)} = $3,
      ${quoteIdent(cVoiceKey)} = $4,
      ${quoteIdent(cVoiceRegion)} = $5,
      ${quoteIdent(cMaxTokens)} = $6,
      ${quoteIdent(cTemperature)} = $7,
      ${quoteIdent(cApiKey)} = $8,
      ${quoteIdent(cQueueId)} = $9,
      ${quoteIdent(cMaxMessages)} = $10,
      ${quoteIdent(cUpdatedAt)} = $11
     WHERE ${quoteIdent(cId)} = $12 AND ${quoteIdent(cCompanyId)} = $13
     RETURNING *`,
    [
      name,
      prompt,
      String(body.voice || "texto"),
      String(body.voiceKey || ""),
      String(body.voiceRegion || ""),
      Number(body.maxTokens ?? 100),
      Number(body.temperature ?? 1),
      String(body.apiKey || ""),
      queueId,
      Number(body.maxMessages ?? 10),
      now,
      id,
      companyId
    ]
  );

  const updated = rows?.[0];
  if (!updated) return res.status(404).json({ error: true, message: "not found" });
  try {
    const io = getIO();
    io.emit("prompt", { action: "update", prompt: updated });
  } catch {}
  return res.json(updated);
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const companyId = tenantIdFromReq(req);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const promptsTable = await resolveTableName(["Prompts", "Prompt"]);
  const cols = await resolveColumnsMap(promptsTable);
  const cId = pickColumn(cols, ["id"], "id");
  const cCompanyId = pickColumn(cols, ["companyId", "tenantId"], "companyId");

  const rows = await pgQuery<any>(
    `DELETE FROM ${promptsTable} WHERE ${quoteIdent(cId)} = $1 AND ${quoteIdent(cCompanyId)} = $2 RETURNING ${quoteIdent(cId)} as id`,
    [id, companyId]
  );
  if (!rows?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

  try {
    const io = getIO();
    io.emit("prompt", { action: "delete", promptId: id });
  } catch {}

  return res.json({ message: "prompt deleted" });
});

export default router;





