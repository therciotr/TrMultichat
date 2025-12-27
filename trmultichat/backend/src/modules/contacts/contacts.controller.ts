import { Request, Response } from "express";
import { pgQuery } from "../../utils/pgClient";
import { getSessionStore } from "../../libs/baileysManager";

export async function list(req: Request, res: Response) {
  const companyId = Number((req as any).tenantId || 0);
  if (!companyId) return res.status(401).json({ error: true, message: "missing tenantId" });
  const pageNumber = Number(req.query.pageNumber || 1);
  const limit = 50;
  const offset = (pageNumber - 1) * limit;
  const contacts = await pgQuery<any>(
    `
      SELECT id, name, number, "profilePicUrl", "createdAt", "updatedAt", email, "isGroup", "companyId", "whatsappId"
      FROM "Contacts"
      WHERE "companyId" = $1
      ORDER BY "updatedAt" DESC
      LIMIT $2 OFFSET $3
    `,
    [companyId, limit, offset]
  );
  return res.json({ contacts, hasMore: contacts.length === limit });
}

export async function find(req: Request, res: Response) {
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
    const number = jid.split("@")[0] || jid;
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





