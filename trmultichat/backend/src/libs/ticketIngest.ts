import { pgQuery } from "../utils/pgClient";
import { getIO } from "./socket";

type ContactRow = {
  id: number;
  name: string;
  number: string;
  profilePicUrl?: string | null;
  companyId: number | null;
  whatsappId: number | null;
};

type TicketRow = {
  id: number;
  status: string;
  lastMessage: string;
  contactId: number | null;
  userId: number | null;
  whatsappId: number | null;
  isGroup: boolean;
  unreadMessages: number | null;
  queueId: number | null;
  companyId: number | null;
  updatedAt: string;
  createdAt: string;
  fromMe: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeNumberFromJid(jid: string): { number: string; isGroup: boolean } {
  const raw = String(jid || "");
  const isGroup = raw.endsWith("@g.us");
  const number = raw.split("@")[0] || raw;
  return { number, isGroup };
}

export function extractTextBody(msg: any): string {
  const m = msg?.message || {};
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    m?.buttonsResponseMessage?.selectedDisplayText ||
    m?.listResponseMessage?.title ||
    ""
  );
}

async function findOrCreateContact(opts: {
  companyId: number;
  whatsappId: number;
  jid: string;
  name?: string;
  profilePicUrl?: string | null;
}): Promise<ContactRow> {
  const { number, isGroup } = normalizeNumberFromJid(opts.jid);
  const name = String(opts.name || number).trim() || number;

  const existing = await pgQuery<ContactRow>(
    'SELECT id, name, number, "profilePicUrl", "companyId", "whatsappId" FROM "Contacts" WHERE number = $1 AND "companyId" = $2 LIMIT 1',
    [number, opts.companyId]
  );
  if (existing[0]) return existing[0];

  const created = await pgQuery<ContactRow>(
    `
      INSERT INTO "Contacts"
        (name, number, email, "profilePicUrl", "createdAt", "updatedAt", "isGroup", "companyId", "whatsappId")
      VALUES
        ($1, $2, '', $3, NOW(), NOW(), $4, $5, $6)
      RETURNING id, name, number, "profilePicUrl", "companyId", "whatsappId"
    `,
    [name, number, opts.profilePicUrl || null, isGroup, opts.companyId, opts.whatsappId]
  );
  return created[0];
}

async function findOrCreateTicket(opts: {
  companyId: number;
  whatsappId: number;
  contactId: number;
  isGroup: boolean;
}): Promise<TicketRow> {
  const existing = await pgQuery<TicketRow>(
    `
      SELECT id, status, "lastMessage", "contactId", "userId", "whatsappId", "isGroup",
             "unreadMessages", "queueId", "companyId", "updatedAt", "createdAt", "fromMe"
      FROM "Tickets"
      WHERE "contactId" = $1 AND "companyId" = $2 AND "whatsappId" = $3
      LIMIT 1
    `,
    [opts.contactId, opts.companyId, opts.whatsappId]
  );
  if (existing[0]) return existing[0];

  const created = await pgQuery<TicketRow>(
    `
      INSERT INTO "Tickets"
        (status, "lastMessage", "contactId", "createdAt", "updatedAt", "whatsappId", "isGroup", "unreadMessages", "companyId")
      VALUES
        ('pending', '', $1, NOW(), NOW(), $2, $3, 0, $4)
      RETURNING id, status, "lastMessage", "contactId", "userId", "whatsappId", "isGroup",
                "unreadMessages", "queueId", "companyId", "updatedAt", "createdAt", "fromMe"
    `,
    [opts.contactId, opts.whatsappId, opts.isGroup, opts.companyId]
  );
  return created[0];
}

async function loadTicketWithContact(ticketId: number) {
  const rows = await pgQuery<any>(
    `
      SELECT
        t.*,
        c.id as "contact_id",
        c.name as "contact_name",
        c.number as "contact_number",
        c."profilePicUrl" as "contact_profilePicUrl"
      FROM "Tickets" t
      JOIN "Contacts" c ON c.id = t."contactId"
      WHERE t.id = $1
      LIMIT 1
    `,
    [ticketId]
  );
  const r = rows[0];
  if (!r) return null;
  const ticket: any = { ...r };
  delete ticket.contact_id;
  delete ticket.contact_name;
  delete ticket.contact_number;
  delete ticket.contact_profilePicUrl;
  ticket.contact = {
    id: r.contact_id,
    name: r.contact_name,
    number: r.contact_number,
    profilePicUrl: r.contact_profilePicUrl
  };
  return ticket;
}

export async function ingestBaileysMessage(opts: {
  companyId: number;
  whatsappId: number;
  msg: any;
}): Promise<void> {
  const { companyId, whatsappId, msg } = opts;

  // ignore empty or protocol/status messages
  const remoteJid = String(msg?.key?.remoteJid || "");
  if (!remoteJid || remoteJid === "status@broadcast") return;

  const messageId = String(msg?.key?.id || "");
  if (!messageId) return;

  const fromMe = Boolean(msg?.key?.fromMe);
  const participant = msg?.key?.participant ? String(msg.key.participant) : null;
  const pushName = String(msg?.pushName || "").trim();
  const body = extractTextBody(msg);

  const contact = await findOrCreateContact({
    companyId,
    whatsappId,
    jid: remoteJid,
    name: pushName || undefined
  });

  const { isGroup } = normalizeNumberFromJid(remoteJid);
  const ticket = await findOrCreateTicket({
    companyId,
    whatsappId,
    contactId: contact.id,
    isGroup
  });

  // insert message idempotently
  await pgQuery(
    `
      INSERT INTO "Messages"
        (id, body, ack, read, "ticketId", "createdAt", "updatedAt", "fromMe", "isDeleted",
         "contactId", "companyId", "remoteJid", "dataJson", participant)
      VALUES
        ($1, $2, 0, false, $3, NOW(), NOW(), $4, false, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      messageId,
      body || "",
      ticket.id,
      fromMe,
      contact.id,
      companyId,
      remoteJid,
      JSON.stringify(msg || {}),
      participant
    ]
  );

  // update ticket last message + unread count
  await pgQuery(
    `
      UPDATE "Tickets"
      SET
        "lastMessage" = $1,
        "updatedAt" = NOW(),
        "fromMe" = $2,
        "unreadMessages" = COALESCE("unreadMessages", 0) + $3
      WHERE id = $4
    `,
    [body || "", fromMe, fromMe ? 0 : 1, ticket.id]
  );

  // emit socket events to refresh ticket list
  const payloadTicket = await loadTicketWithContact(ticket.id);
  if (!payloadTicket) return;

  try {
    const io = getIO();
    io.emit(`company-${companyId}-ticket`, { action: "update", ticket: payloadTicket });
    io.emit(`company-${companyId}-appMessage`, { action: "create", ticket: payloadTicket });
    io.emit(`company-${companyId}-contact`, { action: "update", contact: payloadTicket.contact });
  } catch {}

  // keep Typescript happy; used for debugging if needed
  void nowIso();
}


