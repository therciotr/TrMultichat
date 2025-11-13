import "express-async-errors";
import express from "express";
import cors from "cors";
import http from "http";
import gracefulShutdown from "http-graceful-shutdown";
import env from "./config/env";
import logger from "./config/logger";
import { errorMiddleware } from "./middleware/errorMiddleware";
import authRoutes from "./modules/auth/auth.routes";
import brandingRoutes from "./modules/branding/branding.routes";
import contactsRoutes from "./modules/contacts/contacts.routes";
import usersRoutes from "./modules/users/users.routes";
import queueRoutes from "./modules/queue/queue.routes";
import queueIntegrationRoutes from "./modules/queueIntegration/queueIntegration.routes";
import filesRoutes from "./modules/files/files.routes";
import promptRoutes from "./modules/prompt/prompt.routes";
import tagsRoutes from "./modules/tags/tags.routes";
import schedulesRoutes from "./modules/schedules/schedules.routes";
import announcementsRoutes from "./modules/announcements/announcements.routes";
import campaignsRoutes from "./modules/campaigns/campaigns.routes";
import contactListsRoutes from "./modules/contactLists/contactLists.routes";
import quickMessagesRoutes from "./modules/quickMessages/quickMessages.routes";
import chatsRoutes from "./modules/chats/chats.routes";
import messagesRoutes from "./modules/messages/messages.routes";
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import queueListRoutes from "./modules/queueList/queueList.routes";
import companiesRoutes from "./modules/companies/companies.routes";
import plansRoutes from "./modules/plans/plans.routes";
import invoicesRoutes from "./modules/invoices/invoices.routes";
import whatsappSessionRoutes from "./modules/whatsappSession/whatsappSession.routes";
import mercadoPagoRoutes from "./modules/payments/mercadopago.routes";
import redis from "./redis/redisClient";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

// Create a fresh app so we can register our routes first
const app: express.Express = express();
// Load existing compiled app to preserve legacy routes and behavior (optional)
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const compiledApp: any = (() => {
  try {
    // Attempt to require legacy compiled app; if missing, continue without it
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require("./app");
    return m?.default || m;
  } catch (e) {
    try {
      // Try requiring compiled legacy app from dist to bootstrap Sequelize models
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require("path");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const m2 = require(path.resolve(process.cwd(), "dist/app"));
      // eslint-disable-next-line no-console
      console.warn("[server] Using compiled legacy app from dist/app");
      return m2?.default || m2;
    } catch (_e2) {
      // eslint-disable-next-line no-console
      console.warn("[server] Legacy app not found (src or dist). Continuing without it; models may be unavailable.");
      return (_req: any, _res: any, next: any) => next();
    }
  }
})();

// Global middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for our new endpoints
const allowed = (process.env.FRONTEND_URL || "http://localhost:9089").split(",").map(s => s.trim());
const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
};
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

// New public routes (registered BEFORE mounting compiled app)
app.use("/auth", authRoutes);
// Serve public files (uploads/branding assets)
app.use("/", express.static(require("path").join(process.cwd(), "public")));
app.use("/branding", brandingRoutes);
app.use("/contacts", contactsRoutes);
app.use("/users", usersRoutes);
app.use("/queue", queueRoutes);
app.use("/queueIntegration", queueIntegrationRoutes);
app.use("/queue-list", queueListRoutes);
app.use("/files", filesRoutes);
app.use("/prompt", promptRoutes);
app.use("/tags", tagsRoutes);
app.use("/schedules", schedulesRoutes);
app.use("/announcements", announcementsRoutes);
app.use("/campaigns", campaignsRoutes);
app.use("/contact-lists", contactListsRoutes);
app.use("/quick-messages", quickMessagesRoutes);
app.use("/chats", chatsRoutes);
app.use("/messages", messagesRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/settings", settingsRoutes);
app.use("/companies", companiesRoutes);
app.use("/plans", plansRoutes);
app.use("/invoices", invoicesRoutes);
app.use("/whatsappsession", whatsappSessionRoutes);
app.use("/payments/mercadopago", mercadoPagoRoutes);

// Companies safe list without ORM hooks (raw SQL)
app.get("/companies-safe", async (_req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sequelize = (require("./database").default || require("./database"));
    if (!sequelize || typeof sequelize.query !== "function") {
      return res.json([]);
    }
    const [rows] = await sequelize.query('SELECT id, name, "planId", token FROM "Companies" ORDER BY id ASC LIMIT 10000;');
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.status(200).json([]);
  }
});

// Public alias to avoid any legacy collisions
app.get("/public/companies", async (_req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sequelize = (require("./database").default || require("./database"));
    if (!sequelize || typeof sequelize.query !== "function") {
      return res.json([]);
    }
    const [rows] = await sequelize.query('SELECT id, name, "planId", token FROM "Companies" ORDER BY id ASC LIMIT 10000;');
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.status(200).json([]);
  }
});

// Serve swagger.json at /api-docs
app.get("/api-docs", (_req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const spec = require("./docs/swagger.json");
  res.json(spec);
});

// Tickets endpoint (fallback seguro: sempre retorna array)
app.get("/tickets", async (_req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TicketModel = require("./models/Ticket");
    const Ticket = TicketModel.default || TicketModel;
    if (Ticket && typeof Ticket.findAll === "function") {
      const rows = await Ticket.findAll({ order: [["updatedAt", "DESC"]], limit: 200 });
      const list = Array.isArray(rows) ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r)) : [];
      return res.json(list);
    }
  } catch (e) {
    // no-op; cai no retorno seguro
  }
  return res.json([]);
});

// Alias público para evitar colisão com rotas legadas
app.get("/public/tickets", async (_req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TicketModel = require("./models/Ticket");
    const Ticket = TicketModel.default || TicketModel;
    if (Ticket && typeof Ticket.findAll === "function") {
      const rows = await Ticket.findAll({ order: [["updatedAt", "DESC"]], limit: 200 });
      const list = Array.isArray(rows) ? rows.map((r: any) => (r?.toJSON ? r.toJSON() : r)) : [];
      return res.json(list);
    }
  } catch (e) {}
  return res.json([]);
});

// DEV stubs: fallback se algum módulo/model não estiver pronto
if (String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() === "true") {
  // In-memory DEV state
  const PUBLIC_DIR = path.join(process.cwd(), "public");
  const DEV_QUEUES_FILE = path.join(PUBLIC_DIR, "dev-queues.json");
  function ensurePublicDir() {
    try { if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR); } catch (_) {}
  }
  function readDevQueues(): any[] {
    try {
      ensurePublicDir();
      if (fs.existsSync(DEV_QUEUES_FILE)) {
        const txt = fs.readFileSync(DEV_QUEUES_FILE, "utf8");
        const arr = JSON.parse(txt);
        return Array.isArray(arr) ? arr : [];
      }
    } catch (_) {}
    return [];
  }
  function writeDevQueues(list: any[]) {
    try {
      ensurePublicDir();
      fs.writeFileSync(DEV_QUEUES_FILE, JSON.stringify(list, null, 2), "utf8");
    } catch (_) {}
  }
  let devQueues: any[] = readDevQueues();
  const devSettings: Array<{ key: string; value: string }> = [
    { key: "userRating", value: "enabled" },
    { key: "scheduleType", value: "company" },
    { key: "call", value: "enabled" },
    { key: "chatBotType", value: "text" },
    { key: "CheckMsgIsGroup", value: "enabled" },
    { key: "sendGreetingAccepted", value: "enabled" },
    { key: "sendMsgTransfTicket", value: "enabled" },
    { key: "ipixc", value: "" },
    { key: "tokenixc", value: "" },
    { key: "ipmkauth", value: "" },
    { key: "clientidmkauth", value: "" },
    { key: "clientsecretmkauth", value: "" },
    { key: "asaas", value: "" }
  ];
  // Filtra e devolve [] para coleções esperadas pela UI
  app.get("/queues", (_req, res) => res.json([]));
  app.get(["/queue", "/queue/"], (_req, res) => {
    devQueues = readDevQueues();
    return res.json(devQueues);
  });
  app.get("/debug/queues", (_req, res) => {
    return res.json({ memCount: Array.isArray(devQueues) ? devQueues.length : -1, fileCount: Array.isArray(readDevQueues()) ? readDevQueues().length : -1 });
  });
  app.get("/queue-list", (_req, res) => {
    return res.json(readDevQueues());
  });
  app.get("/companies", (_req, res) => res.json([]));
  app.get("/settings", (_req, res) => res.json(devSettings));
  app.get("/settings/", (_req, res) => res.json(devSettings));
  app.get("/helps", (_req, res) => res.json([]));
  app.get("/users", (_req, res) => res.json([]));
  app.get(["/whatsapp", "/whatsapp/"], (_req, res) => res.json([]));
  app.get(["/whatsapp/:id", "/whatsapp/:id/"], (req, res) => {
    const id = Number(req.params.id);
    try {
      const PUBLIC_DIR = path.join(process.cwd(), "public");
      const SESS_FILE = path.join(PUBLIC_DIR, "dev-whatsapp-sessions.json");
      let qrcode = "";
      if (fs.existsSync(SESS_FILE)) {
        try {
          const sessions = JSON.parse(fs.readFileSync(SESS_FILE, "utf8")) || {};
          qrcode = (sessions && sessions[String(id)] && sessions[String(id)].qrcode) || "";
        } catch {}
      }
      return res.json({ id, name: "", status: qrcode ? "qrcode" : "DISCONNECTED", qrcode });
    } catch {
      return res.json({ id, name: "", status: "DISCONNECTED", qrcode: "" });
    }
  });
  // Contatos
  app.get(["/contacts", "/contacts/"], (_req, res) => res.json({ contacts: [], hasMore: false }));
  app.get(["/contacts/:id", "/contacts/:id/"], (req, res) => res.json({ id: Number(req.params.id), name: "", number: "" }));
  // Tags
  app.get(["/tags", "/tags/"], (_req, res) => res.json({ tags: [], hasMore: false }));
  app.get("/tags/kanban", (_req, res) => res.json({ lista: [] }));
  app.get("/ticket/kanban", (_req, res) => res.json({ tickets: [] }));
  app.get(["/tickets/:id", "/tickets/u/:id"], (req, res) => res.json({ id: Number(req.params.id) }));
  app.get(["/messages/:ticketId", "/chats/:id/messages"], (_req, res) => res.json({ messages: [], hasMore: false }));
  app.get("/companies/listPlan/:id", (req, res) => {
    const id = Number(req.params.id || 0);
    return res.json({ companyId: id, plans: [], current: null });
  });

  // Integrações de filas
  app.get(["/queueIntegration", "/queueIntegration/"], (_req, res) =>
    res.json({ queueIntegrations: [], hasMore: false })
  );
  app.get("/queueIntegration/:id", (_req, res) => res.json({ id: Number(_req.params.id), name: "", type: "n8n" }));

  // Arquivos
  app.get(["/files", "/files/"], (_req, res) => res.json({ files: [], hasMore: false }));
  app.get("/files/:id", (_req, res) => res.json({ id: Number(_req.params.id), name: "" }));

  // Financeiro
  app.get("/invoices/all", (_req, res) => res.json([]));
    // Plans - simple DEV stubs
    app.get("/plans/list", (_req, res) => {
      return res.json([
        { id: 1, name: "Starter", users: 3, connections: 1, campaigns: false, schedules: false, price: 0 },
        { id: 2, name: "Pro", users: 10, connections: 3, campaigns: true, schedules: true, price: 99.9 },
        { id: 3, name: "Enterprise", users: 999, connections: 50, campaigns: true, schedules: true, price: 499.9 }
      ]);
    });
    app.get("/plans/all", (_req, res) => {
      return res.json([
        { id: 1, name: "Starter", users: 3, connections: 1, campaigns: false, schedules: false, price: 0 },
        { id: 2, name: "Pro", users: 10, connections: 3, campaigns: true, schedules: true, price: 99.9 },
        { id: 3, name: "Enterprise", users: 999, connections: 50, campaigns: true, schedules: true, price: 499.9 }
      ]);
    });

  // Prompts (OpenAI)
  app.get("/prompt", (_req, res) => res.json({ prompts: [] }));
  app.get("/prompt/:id", (_req, res) => res.json({ id: Number(_req.params.id), name: "", queue: { id: 0, name: "" }, maxTokens: 0 }));

  // Usuários
  app.get(["/users", "/users/"], (_req, res) => res.json({ users: [], hasMore: false }));
  app.get("/users/list", (_req, res) => res.json([]));
  app.get(["/users/:id", "/users/:id/"], (req, res) => res.json({ id: Number(req.params.id), name: "", email: "" }));

  // Agendamentos
  app.get(["/schedules", "/schedules/"], (_req, res) => res.json({ schedules: [], hasMore: false }));

  // Avisos (announcements)
  app.get(["/announcements", "/announcements/"], (_req, res) => res.json({ records: [], hasMore: false }));

  // Campanhas
  app.get(["/campaigns", "/campaigns/"], (_req, res) => res.json({ records: [], hasMore: false }));

  // Listas de contatos e itens
  app.get(["/contact-lists", "/contact-lists/"], (_req, res) => res.json({ records: [], hasMore: false }));
  app.get(["/contact-lists/:id", "/contact-lists/:id/"], (req, res) => res.json({ id: Number(req.params.id), name: "" }));
  app.get(["/contact-list-items"], (_req, res) => res.json({ contacts: [], hasMore: false }));

  // Mensagens rápidas
  app.get(["/quick-messages", "/quick-messages/"], (_req, res) => res.json({ records: [], hasMore: false }));

  // Chats
  app.get(["/chats", "/chats/"], (_req, res) => res.json({ records: [], hasMore: false }));

  // No-ops for write operations (DEV)
  const noContent = (_req: any, res: any) => res.status(204).end();
  const okJson = (_req: any, res: any) => res.json({ ok: true });
  app.put("/settings/:key", (req, res) => {
    const key = String(req.params.key);
    const value = String((req.body && req.body.value) ?? "");
    const idx = devSettings.findIndex((s) => s.key === key);
    if (idx >= 0) {
      devSettings[idx].value = value;
    } else {
      devSettings.push({ key, value });
    }
    return res.json({ key, value });
  });
  app.post("/companies", (req, res) => {
    const body = req.body || {};
    const id = Math.floor(Math.random() * 100000) + 1;
    return res.json({ id, ...body });
  });
  // WhatsApp session DEV endpoints - emit QR and session updates
  app.post("/whatsappsession/:id", (req, res) => {
    const id = Number(req.params.id);
    const auth = (req.headers.authorization || "").split(" ");
    const bearer = auth.length === 2 && auth[0] === "Bearer" ? auth[1] : undefined;
    let tenant = 1;
    if (bearer) {
      try {
        const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
        if (payload?.tenantId) tenant = Number(payload.tenantId);
      } catch (_) {}
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let socketLib: any;
      try { socketLib = require("./libs/socket"); } catch { socketLib = require(require("path").resolve(process.cwd(), "dist/libs/socket")); }
      const getIO = socketLib.getIO || socketLib.default || socketLib;
      const io = getIO();
      // Generate a dummy QR content
      const qrcodeContent = `WA-SESSION:${id}:${Date.now()}`;
      // Persist last session QR for GET /whatsapp/:id
      try {
        const fs = require("fs");
        const path = require("path");
        const PUBLIC_DIR = path.join(process.cwd(), "public");
        const SESS_FILE = path.join(PUBLIC_DIR, "dev-whatsapp-sessions.json");
        if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
        let sessions: any = {};
        if (fs.existsSync(SESS_FILE)) {
          try { sessions = JSON.parse(fs.readFileSync(SESS_FILE, "utf8")) || {}; } catch {}
        }
        sessions[String(id)] = { id, qrcode: qrcodeContent, updatedAt: new Date().toISOString(), status: "qrcode" };
        fs.writeFileSync(SESS_FILE, JSON.stringify(sessions, null, 2), "utf8");
      } catch {}
      io.emit(`company-${tenant}-whatsappSession`, {
        action: "update",
        session: { id, status: "qrcode", qrcode: qrcodeContent, updatedAt: new Date().toISOString(), retries: 0 }
      });
    } catch (_) {}
    return res.json({ ok: true });
  });
  app.put("/whatsappsession/:id", (req, res) => {
    const id = Number(req.params.id);
    const auth = (req.headers.authorization || "").split(" ");
    const bearer = auth.length === 2 && auth[0] === "Bearer" ? auth[1] : undefined;
    let tenant = 1;
    if (bearer) {
      try {
        const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
        if (payload?.tenantId) tenant = Number(payload.tenantId);
      } catch (_) {}
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let socketLib: any;
      try { socketLib = require("./libs/socket"); } catch { socketLib = require(require("path").resolve(process.cwd(), "dist/libs/socket")); }
      const getIO = socketLib.getIO || socketLib.default || socketLib;
      const io = getIO();
      const qrcodeContent = `WA-SESSION:${id}:${Date.now()}`;
      try {
        const fs = require("fs");
        const path = require("path");
        const PUBLIC_DIR = path.join(process.cwd(), "public");
        const SESS_FILE = path.join(PUBLIC_DIR, "dev-whatsapp-sessions.json");
        if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
        let sessions: any = {};
        if (fs.existsSync(SESS_FILE)) {
          try { sessions = JSON.parse(fs.readFileSync(SESS_FILE, "utf8")) || {}; } catch {}
        }
        sessions[String(id)] = { id, qrcode: qrcodeContent, updatedAt: new Date().toISOString(), status: "qrcode" };
        fs.writeFileSync(SESS_FILE, JSON.stringify(sessions, null, 2), "utf8");
      } catch {}
      io.emit(`company-${tenant}-whatsappSession`, {
        action: "update",
        session: { id, status: "qrcode", qrcode: qrcodeContent, updatedAt: new Date().toISOString(), retries: 1 }
      });
    } catch (_) {}
    return res.json({ ok: true });
  });
  // Queues DEV stubs
  app.post("/queue", (req, res) => {
    const body = req.body || {};
    const id = Math.floor(Math.random() * 100000) + 1;
    const newQueue = { id, ...body };
    devQueues = readDevQueues();
    devQueues.push(newQueue);
    writeDevQueues(devQueues);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let socketLib: any;
      try { socketLib = require("./libs/socket"); } catch { socketLib = require(require("path").resolve(process.cwd(), "dist/libs/socket")); }
      const getIO = socketLib.getIO || socketLib.default || socketLib;
      const io = getIO();
      // extract tenantId from bearer token if present
      const auth = (req.headers.authorization || "").split(" ");
      const bearer = auth.length === 2 && auth[0] === "Bearer" ? auth[1] : undefined;
      let tenant = 1;
      if (bearer) {
        try {
          const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
          if (payload?.tenantId) tenant = Number(payload.tenantId);
        } catch (_) {}
      }
      io.emit(`company-${tenant}-queue`, { action: "create", queue: newQueue });
    } catch (_) {}
    return res.json(newQueue);
  });
  app.get("/queue/:id", (req, res) => {
    const id = Number(req.params.id);
    const found = devQueues.find((q) => q.id === id);
    if (found) return res.json(found);
    return res.json({ id, name: "Fila " + id, color: "#0B4C46", greetingMessage: "", outOfHoursMessage: "", orderQueue: "", integrationId: "", promptId: null, schedules: [] });
  });
  app.put("/queue/:id", (req, res) => {
    const id = Number(req.params.id);
    const idx = devQueues.findIndex((q) => q.id === id);
    if (idx !== -1) {
      devQueues[idx] = { ...devQueues[idx], ...(req.body || {}) };
      writeDevQueues(devQueues);
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const socketLib = require("./libs/socket");
        const getIO = socketLib.getIO || socketLib.default || socketLib;
        const io = getIO();
        const auth = (req.headers.authorization || "").split(" ");
        const bearer = auth.length === 2 && auth[0] === "Bearer" ? auth[1] : undefined;
        let tenant = 1;
        if (bearer) {
          try {
            const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
            if (payload?.tenantId) tenant = Number(payload.tenantId);
          } catch (_) {}
        }
        io.emit(`company-${tenant}-queue`, { action: "update", queue: devQueues[idx] });
      } catch (_) {}
      return res.json(devQueues[idx]);
    }
    return res.status(404).json({ error: true, message: "not found" });
  });
  app.delete("/queue/:id", (req, res) => {
    const id = Number(req.params.id);
    const idx = devQueues.findIndex((q) => q.id === id);
    if (idx !== -1) {
      devQueues.splice(idx, 1);
      writeDevQueues(devQueues);
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const socketLib = require("./libs/socket");
        const getIO = socketLib.getIO || socketLib.default || socketLib;
        const io = getIO();
        const auth = (req.headers.authorization || "").split(" ");
        const bearer = auth.length === 2 && auth[0] === "Bearer" ? auth[1] : undefined;
        let tenant = 1;
        if (bearer) {
          try {
            const payload = jwt.verify(bearer, env.JWT_SECRET) as { tenantId?: number };
            if (payload?.tenantId) tenant = Number(payload.tenantId);
          } catch (_) {}
        }
        io.emit(`company-${tenant}-queue`, { action: "delete", queueId: id });
      } catch (_) {}
      return res.status(204).end();
    }
    return res.status(404).json({ error: true, message: "not found" });
  });
  app.post("/queue/:id/media-upload", okJson);
  app.delete("/queue/:id/media-upload", noContent);
  app.post(["/contacts/import"], okJson);
  app.post(["/files/uploadList/:id"], okJson);
  app.post(["/queue-options/:id/media-upload"], okJson);
  app.post(["/tickets", "/messages/:id", "/quick-messages", "/prompt", "/chats", "/campaigns/:id/cancel", "/campaigns/:id/restart"], okJson);
  app.put(["/tickets/:id", "/users/:id", "/contacts/:id", "/quick-messages/:id", "/prompt/:id", "/whatsapp/:id", "/chats/:id", "/ticket-tags/:to/:from", "/files/:id"], okJson);
  app.post(["/whatsappsession/:id"], okJson);
  app.put(["/whatsappsession/:id"], okJson);
  app.delete([
    "/queue/:id",
    "/users/:id",
    "/contacts/:id",
    "/contact-list-items/:id",
    "/contact-lists/:id",
    "/campaigns/:id",
    "/queueIntegration/:id",
    "/announcements/:id",
    "/announcements/:id/media-upload",
    "/quick-messages/:id",
    "/quick-messages/:id/media-upload",
    "/tags/:id",
    "/schedules/:id",
    "/chats/:id",
    "/ticket-tags/:id",
    "/tickets/:id",
    "/whatsappsession/:id",
    "/whatsapp/:id"
  ], noContent);

  // /users/me compatível com a UI (usa mesmo bearer de /auth/me)
  app.get("/users/me", (req, res) => {
    try {
      const auth = req.headers.authorization || "";
      const parts = auth.split(" ");
      const bearer = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;
      if (!bearer) return res.status(401).json({ error: true, message: "missing bearer token" });
      const payload = jwt.verify(bearer, env.JWT_SECRET) as { userId: number; tenantId: number };
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const UserModel = require("./models/User");
      const User = UserModel.default || UserModel;
      User.findByPk(payload.userId)
        .then((userInstance: any) => {
          if (!userInstance) return res.status(401).json({ error: true, message: "user not found" });
          const plain = userInstance?.get ? userInstance.get({ plain: true }) : (userInstance as any);
          const isAdmin = Boolean(plain?.admin);
          const profile = String(plain?.profile || (isAdmin ? "admin" : "user"));
          return res.json({
            id: userInstance.id,
            name: userInstance.name,
            email: userInstance.email,
            companyId: userInstance.companyId,
            admin: isAdmin,
            profile
          });
        })
        .catch(() => res.status(401).json({ error: true, message: "invalid token" }));
    } catch (e: any) {
      return res.status(401).json({ error: true, message: e?.message || "invalid token" });
    }
  });
}

// Mount compiled legacy app after our routes so we keep precedence (no-op if missing)
app.use(compiledApp);

// Health endpoint (MySQL + Redis)
app.get("/health", async (_req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sequelize = (require("./database").default || require("./database"));
  const result: any = {};
  let dbUp = false;
  try {
    await sequelize.authenticate();
    result.db = "up";
    dbUp = true;
  } catch (e) {
    result.db = "down";
  }
  try {
    const pong = await redis.ping();
    result.redis = pong === "PONG" ? "up" : "down";
  } catch (e) {
    result.redis = "down";
  }
  result.ok = dbUp === true;
  result.version = env.VERSION;
  return res.json(result);
});

// Metrics endpoint (basic counts)
app.get("/metrics", async (_req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TicketModel = require("./models/Ticket");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const MessageModel = require("./models/Message");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const UserModel = require("./models/User");

    const Ticket = TicketModel.default || TicketModel;
    const Message = MessageModel.default || MessageModel;
    const User = UserModel.default || UserModel;

    const [openTickets, messagesToday, onlineAgents] = await Promise.all([
      typeof Ticket.count === "function" ? Ticket.count({ where: { status: "open" } }) : 0,
      typeof Message.count === "function" ? Message.count() : 0,
      typeof User.count === "function" ? User.count({ where: { online: true } }) : 0
    ]);

    return res.json({ openTickets, messagesToday, onlineAgents });
  } catch (e) {
    return res.json({ openTickets: 0, messagesToday: 0, onlineAgents: 0 });
  }
});

// Error handler last
app.use(errorMiddleware);

const server = http.createServer(app);

server.listen(env.PORT, async () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
  // Human-friendly console message
  // eslint-disable-next-line no-console
  console.log(`✅ Backend ativo em http://localhost:${env.PORT}`);

  // Initialize socket
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const socketLib = require("./libs/socket");
    const initIO = socketLib.initIO || socketLib.default || socketLib;
    initIO(server);
  } catch (e) {
    logger.warn("Socket initialization skipped", e);
  }

  // Start WhatsApp sessions for each company (tenant)
  if (String(process.env.DEV_MODE || env.DEV_MODE || "false").toLowerCase() !== "true") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const CompanyModel = require("./models/Company");
      const Company = CompanyModel.default || CompanyModel;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const startAll = require("./services/WbotServices/StartAllWhatsAppsSessions");
      const StartAllWhatsAppsSessions = startAll.StartAllWhatsAppsSessions || startAll.default || startAll;
      const companies = await Company.findAll();
      await Promise.all(companies.map((c: any) => StartAllWhatsAppsSessions(c.id)));
    } catch (e) {
      logger.warn("StartAllWhatsAppsSessions skipped", e);
    }
  } else {
    logger.info("DEV_MODE=true: skipping WhatsApp sessions startup");
  }

  // Start queues
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queues = require("./queues");
    const startQueueProcess = queues.startQueueProcess || queues.default || queues;
    if (typeof startQueueProcess === "function") {
      startQueueProcess();
    }
  } catch (e) {
    logger.warn("Queue start skipped", e);
  }
});

gracefulShutdown(server);


