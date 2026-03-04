import { Request, Response } from "express";
import { pgQuery } from "../../utils/pgClient";
import { getSessionStore } from "../../libs/baileysManager";
import { getIO } from "../../libs/socket";

const SQL_ACCENT_FROM =
  "ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝŸýÿ";
const SQL_ACCENT_TO =
  "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYYyy";

function setNoCache(res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    // Avoid 304/etag-related issues on some clients/proxies
    res.removeHeader?.("ETag");
  } catch {}
}

function normalizeSearchText(v: string): string {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sqlNormalized(column: string): string {
  return `LOWER(translate(COALESCE(${column}, ''), '${SQL_ACCENT_FROM}', '${SQL_ACCENT_TO}'))`;
}

function userIdFromReq(req: any): number {
  return Number(req?.userId || 0);
}

function normalizeContactNumber(raw: any): string {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  const withCountry =
    digits.startsWith("55") || digits.length > 11 ? digits : `55${digits}`;
  if (withCountry.startsWith("55")) {
    let normalized = withCountry.length > 13 ? `55${withCountry.slice(-11)}` : withCountry;
    // Legacy BR contacts sometimes arrived as 55 + DDD + 8 digits (missing mobile 9).
    // User requested to normalize all these to 55 + DDD + 9 + 8 digits.
    if (normalized.length === 12) {
      normalized = `${normalized.slice(0, 4)}9${normalized.slice(4)}`;
    }
    return normalized;
  }
  return withCountry;
}

function sanitizeContactPayload(body: any) {
  const name = String(body?.name || "").trim();
  const number = normalizeContactNumber(body?.number);
  const email = String(body?.email || "").trim();
  const profilePicUrlRaw = body?.profilePicUrl;
  const profilePicUrl =
    profilePicUrlRaw === null || profilePicUrlRaw === undefined
      ? null
      : String(profilePicUrlRaw).trim() || null;
  const isGroup = body?.isGroup === true;
  const whatsappId =
    body?.whatsappId === null || body?.whatsappId === undefined
      ? null
      : Number(body?.whatsappId || 0) || null;
  return { name, number, email, profilePicUrl, isGroup, whatsappId };
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const companyId = Number((req as any).tenantId || 0);
  const userId = userIdFromReq(req as any);
  if (!companyId || !userId) {
    res.status(401).json({ error: true, message: "missing auth context" });
    return false;
  }
  try {
    const rows = await pgQuery<any>(
      `SELECT id, LOWER(COALESCE(profile,'')) as profile FROM "Users" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [userId, companyId]
    );
    const profile = String(rows?.[0]?.profile || "");
    if (profile === "admin" || profile === "super") return true;
  } catch {}
  res.status(403).json({ error: true, message: "forbidden" });
  return false;
}

export async function list(req: Request, res: Response) {
  setNoCache(res);
  const companyId = Number((req as any).tenantId || 0);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const pageNumber = Number(req.query.pageNumber || 1);
  const rawSearch = String((req.query as any).searchParam || "").trim();
  const normalizedSearch = normalizeSearchText(rawSearch);
  const q = normalizedSearch ? `%${normalizedSearch}%` : "";
  const digits = rawSearch ? rawSearch.replace(/\D+/g, "") : "";
  const digitsLike = digits ? `%${digits}%` : "";
  const digitsPrefixLike = digits ? `${digits}%` : "";
  const limit = 50;
  const offset = (pageNumber - 1) * limit;

  const whereParts: string[] = [`"companyId" = $1`];
  const params: any[] = [companyId];

  if (rawSearch) {
    // name/email search (case-insensitive)
    params.push(q);
    const qIdx = params.length;

    const orParts: string[] = [
      `${sqlNormalized("name")} LIKE $${qIdx}`,
      `LOWER(COALESCE(email, '')) LIKE $${qIdx}`,
    ];

    // number search: normalize digits to match stored formats (with or without symbols)
    if (digitsLike) {
      params.push(digitsLike);
      const dIdx = params.length;
      orParts.push(`COALESCE(number,'') LIKE $${dIdx}`);
      orParts.push(`regexp_replace(COALESCE(number,''), '\\\\D', '', 'g') LIKE $${dIdx}`);
    }

    whereParts.push(`(${orParts.join(" OR ")})`);
  }

  const orderParts: string[] = [];
  if (rawSearch) {
    // Improve contact discoverability while typing by ranking stronger matches first.
    params.push(normalizedSearch);
    const rawLowerIdx = params.length;
    if (digitsPrefixLike) {
      params.push(digitsPrefixLike);
      const digitsPrefixIdx = params.length;
      orderParts.push(
        `CASE
          WHEN regexp_replace(COALESCE(number,''), '\\\\D', '', 'g') LIKE $${digitsPrefixIdx} THEN 0
          WHEN ${sqlNormalized("name")} LIKE $${rawLowerIdx} || '%' THEN 1
          WHEN ${sqlNormalized("name")} LIKE '%' || $${rawLowerIdx} || '%' THEN 2
          ELSE 3
        END`
      );
    } else {
      orderParts.push(
        `CASE
          WHEN ${sqlNormalized("name")} LIKE $${rawLowerIdx} || '%' THEN 0
          WHEN ${sqlNormalized("name")} LIKE '%' || $${rawLowerIdx} || '%' THEN 1
          ELSE 2
        END`
      );
    }
  }
  orderParts.push(`"updatedAt" DESC`);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const contacts = await pgQuery<any>(
    `
      SELECT id, name, number, "profilePicUrl", "createdAt", "updatedAt", email, "isGroup", "companyId", "whatsappId"
      FROM "Contacts"
      WHERE ${whereParts.join(" AND ")}
      ORDER BY ${orderParts.join(", ")}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    params
  );
  return res.json({ contacts, hasMore: contacts.length === limit });
}

export async function find(req: Request, res: Response) {
  setNoCache(res);
  const id = Number(req.params.id);
  const companyId = Number((req as any).tenantId || 0);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const rows = await pgQuery<any>(
    `
      SELECT id, name, number, "profilePicUrl", "createdAt", "updatedAt", email, "isGroup", "companyId", "whatsappId"
      FROM "Contacts"
      WHERE id = $1 AND "companyId" = $2
      LIMIT 1
    `,
    [id, companyId]
  );
  const contact = rows[0] || null;
  if (!contact) return res.status(404).json({ error: true, message: "not found" });
  return res.json(contact);
}

export async function create(req: Request, res: Response) {
  setNoCache(res);
  const companyId = Number((req as any).tenantId || 0);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  const { name, number, email, profilePicUrl, isGroup, whatsappId } =
    sanitizeContactPayload((req as any).body || {});
  if (!name) return res.status(400).json({ error: true, message: "name is required" });
  if (!number) return res.status(400).json({ error: true, message: "number is required" });

  try {
    const existing = await pgQuery<any>(
      `
        SELECT id, name, number, "profilePicUrl", "createdAt", "updatedAt", email, "isGroup", "companyId", "whatsappId"
        FROM "Contacts"
        WHERE "companyId" = $1
          AND regexp_replace(COALESCE(number, ''), '\\D', '', 'g') = $2
        LIMIT 1
      `,
      [companyId, number]
    );
    if (existing?.[0]) {
      return res.status(200).json(existing[0]);
    }

    const inserted = await pgQuery<any>(
      `
        INSERT INTO "Contacts"
          (name, number, email, "profilePicUrl", "createdAt", "updatedAt", "isGroup", "companyId", "whatsappId")
        VALUES
          ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7)
        RETURNING id, name, number, "profilePicUrl", "createdAt", "updatedAt", email, "isGroup", "companyId", "whatsappId"
      `,
      [name, number, email, profilePicUrl, isGroup, companyId, whatsappId]
    );
    const contact = inserted?.[0];
    if (!contact) return res.status(500).json({ error: true, message: "failed to create contact" });
    try {
      getIO().emit(`company-${companyId}-contact`, { action: "create", contact });
    } catch {}
    return res.status(201).json(contact);
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || "create failed" });
  }
}

export async function update(req: Request, res: Response) {
  setNoCache(res);
  const id = Number(req.params.id || 0);
  const companyId = Number((req as any).tenantId || 0);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  const { name, number, email, profilePicUrl, isGroup, whatsappId } =
    sanitizeContactPayload((req as any).body || {});
  if (!name) return res.status(400).json({ error: true, message: "name is required" });
  if (!number) return res.status(400).json({ error: true, message: "number is required" });

  try {
    const updated = await pgQuery<any>(
      `
        UPDATE "Contacts"
        SET
          name = $1,
          number = $2,
          email = $3,
          "profilePicUrl" = $4,
          "isGroup" = $5,
          "whatsappId" = $6,
          "updatedAt" = NOW()
        WHERE id = $7 AND "companyId" = $8
        RETURNING id, name, number, "profilePicUrl", "createdAt", "updatedAt", email, "isGroup", "companyId", "whatsappId"
      `,
      [name, number, email, profilePicUrl, isGroup, whatsappId, id, companyId]
    );
    const contact = updated?.[0];
    if (!contact) return res.status(404).json({ error: true, message: "not found" });
    try {
      getIO().emit(`company-${companyId}-contact`, { action: "update", contact });
    } catch {}
    return res.json(contact);
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || "update failed" });
  }
}

export async function remove(req: Request, res: Response) {
  setNoCache(res);
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const companyId = Number((req as any).tenantId || 0);
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: true, message: "invalid id" });

  try {
    const exists = await pgQuery<any>(
      `SELECT id FROM "Contacts" WHERE id = $1 AND "companyId" = $2 LIMIT 1`,
      [id, companyId]
    );
    if (!exists?.[0]?.id) return res.status(404).json({ error: true, message: "not found" });

    await pgQuery(`DELETE FROM "Contacts" WHERE id = $1 AND "companyId" = $2`, [id, companyId]);

    try {
      getIO().emit(`company-${companyId}-contact`, { action: "delete", contactId: id });
    } catch {}

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || "delete failed" });
  }
}

export async function removeAll(req: Request, res: Response) {
  setNoCache(res);
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const companyId = Number((req as any).tenantId || 0);

  try {
    const rows = await pgQuery<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM "Contacts" WHERE "companyId" = $1`,
      [companyId]
    );
    const total = Number(rows?.[0]?.count || 0);

    await pgQuery(`DELETE FROM "Contacts" WHERE "companyId" = $1`, [companyId]);

    try {
      getIO().emit(`company-${companyId}-contact`, { action: "deleteAll", deleted: total });
    } catch {}

    return res.json({ ok: true, deleted: total });
  } catch (e: any) {
    // If some environments have FK restrictions, return a clearer error to the UI.
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("foreign key")) {
      return res.status(409).json({
        error: true,
        message:
          "Não foi possível excluir todos os contatos porque existem registros vinculados (ex.: atendimentos)."
      });
    }
    return res.status(500).json({ error: true, message: e?.message || "delete all failed" });
  }
}

export async function removeMany(req: Request, res: Response) {
  setNoCache(res);
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const companyId = Number((req as any).tenantId || 0);
  const body: any = (req as any).body || {};
  const idsRaw: any[] = Array.isArray(body?.ids) ? body.ids : [];
  const ids = Array.from(
    new Set(
      idsRaw
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );

  if (!ids.length) return res.status(400).json({ error: true, message: "ids is required" });

  try {
    // Only delete contacts from this company
    const rows = await pgQuery<{ id: number }>(
      `SELECT id FROM "Contacts" WHERE "companyId" = $1 AND id = ANY($2::int[])`,
      [companyId, ids]
    );
    const foundIds = (rows || []).map((r) => Number(r.id));
    if (!foundIds.length) return res.json({ ok: true, deleted: 0, ids: [] });

    await pgQuery(`DELETE FROM "Contacts" WHERE "companyId" = $1 AND id = ANY($2::int[])`, [companyId, foundIds]);

    try {
      const io = getIO();
      for (const id of foundIds) {
        io.emit(`company-${companyId}-contact`, { action: "delete", contactId: id });
      }
      io.emit(`company-${companyId}-contact`, { action: "deleteMany", deleted: foundIds.length, ids: foundIds });
    } catch {}

    return res.json({ ok: true, deleted: foundIds.length, ids: foundIds });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("foreign key")) {
      return res.status(409).json({
        error: true,
        message:
          "Não foi possível excluir alguns contatos porque existem registros vinculados (ex.: atendimentos)."
      });
    }
    return res.status(500).json({ error: true, message: e?.message || "bulk delete failed" });
  }
}

export async function importContacts(req: Request, res: Response) {
  const companyId = Number((req as any).tenantId || 0);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });

  // Pick a connected whatsapp for this company (or any whatsapp if status unknown)
  const whats = await pgQuery<any>(
    `SELECT id, status FROM "Whatsapps" WHERE "companyId" = $1 ORDER BY id ASC`,
    [companyId]
  );
  const preferred = whats.find((w: any) => String(w.status || "").toUpperCase() === "CONNECTED") || whats[0];
  const whatsappId = Number(preferred?.id || 0);
  if (!whatsappId) return res.status(400).json({ error: true, message: "no whatsapp found for company" });

  const store: any = getSessionStore(whatsappId);
  if (!store) {
    // Session is not in memory (needs a fresh backend restart or reconnect)
    return res.status(202).json({ ok: true, imported: 0, message: "session not ready yet, try again in a few seconds" });
  }

  const contactsMap: any = store?.contacts || {};
  const chatsArr: any[] = typeof store?.chats?.all === "function" ? store.chats.all() : [];

  // build candidates from contacts + chats
  const candidates: Array<{ jid: string; name?: string }> = [];
  for (const [jid, c] of Object.entries<any>(contactsMap)) {
    const s = String(jid || "");
    if (!s) continue;
    if (s.endsWith("@s.whatsapp.net") || s.endsWith("@g.us")) {
      candidates.push({ jid: s, name: c?.name || c?.notify || undefined });
    }
  }
  for (const ch of chatsArr) {
    const jid = String(ch?.id || "");
    if (!jid) continue;
    if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@g.us")) {
      candidates.push({ jid, name: ch?.name || ch?.notify || undefined });
    }
  }

  const seen = new Set<string>();
  let imported = 0;

  for (const cand of candidates) {
    const jid = String(cand.jid || "");
    if (!jid || seen.has(jid)) continue;
    seen.add(jid);

    const isGroup = jid.endsWith("@g.us");
    const localPart = (jid.split("@")[0] || jid).split(":")[0] || "";
    const number = normalizeContactNumber(localPart);
    const name = String(cand.name || number).trim() || number;

    const created = await pgQuery<any>(
      `
        INSERT INTO "Contacts"
          (name, number, email, "profilePicUrl", "createdAt", "updatedAt", "isGroup", "companyId", "whatsappId")
        VALUES
          ($1, $2, '', NULL, NOW(), NOW(), $3, $4, $5)
        ON CONFLICT (number, "companyId") DO NOTHING
        RETURNING id
      `,
      [name, number, isGroup, companyId, whatsappId]
    );
    if (created && created[0]?.id) imported += 1;
  }

  return res.json({ ok: true, imported, whatsappId });
}





