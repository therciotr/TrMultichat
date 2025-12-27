import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import env from "../config/env";
import logger from "../config/logger";

let io: Server | null = null;

function parseAllowedOrigins(): string[] {
  const raw = String(process.env.FRONTEND_URL || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function initIO(httpServer: HttpServer) {
  if (io) return io;

  const allowedOrigins = parseAllowedOrigins();
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : true,
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    try {
      logger.info("Socket client connected");
    } catch {}

    // Client rooms (used across the app)
    socket.on("joinChatBox", (companyId: string | number) => {
      try {
        const room = `company-${companyId}-chat`;
        socket.join(room);
      } catch {}
    });

    socket.on("joinTicket", (ticketId: string | number) => {
      try {
        socket.join(`ticket-${ticketId}`);
      } catch {}
    });

    socket.on("joinNotification", (companyId: string | number) => {
      try {
        socket.join(`company-${companyId}-notification`);
      } catch {}
    });

    socket.on("disconnect", () => {
      try {
        logger.info("Socket client disconnected");
      } catch {}
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    // Keep message aligned with legacy clients expecting init first
    throw new Error("Socket IO not initialized");
  }
  return io;
}


