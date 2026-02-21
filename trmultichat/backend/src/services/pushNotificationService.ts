import admin from "firebase-admin";
import fs from "fs";
import { pgQuery } from "../utils/pgClient";

type UpsertPushTokenInput = {
  companyId: number;
  userId: number;
  token: string;
  platform?: string;
  deviceId?: string | null;
  appVersion?: string | null;
};

let ensuredTable = false;
let ensuringTable: Promise<void> | null = null;
let cachedMessaging: admin.messaging.Messaging | null | undefined;

function normalizePlatform(v: string | undefined): "ios" | "android" | "unknown" {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "ios" || s === "iphone" || s === "ipad") return "ios";
  if (s === "android") return "android";
  return "unknown";
}

async function ensurePushTokensTable(): Promise<void> {
  if (ensuredTable) return;
  if (ensuringTable) return ensuringTable;
  ensuringTable = (async () => {
    await pgQuery(
      `
      CREATE TABLE IF NOT EXISTS "MobilePushTokens" (
        id BIGSERIAL PRIMARY KEY,
        "companyId" INTEGER NOT NULL,
        "userId" INTEGER NOT NULL,
        token TEXT NOT NULL,
        platform VARCHAR(20) NOT NULL DEFAULT 'unknown',
        "deviceId" TEXT NULL,
        "appVersion" TEXT NULL,
        "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `
    );
    await pgQuery(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS "mobile_push_tokens_company_user_token_uq"
      ON "MobilePushTokens" ("companyId", "userId", token)
    `
    );
    await pgQuery(
      `
      CREATE INDEX IF NOT EXISTS "mobile_push_tokens_company_idx"
      ON "MobilePushTokens" ("companyId")
    `
    );
    ensuredTable = true;
  })().finally(() => {
    ensuringTable = null;
  });
  return ensuringTable;
}

function tryParseServiceAccountFromEnv(): admin.ServiceAccount | null {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as admin.ServiceAccount;
  } catch {}
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded) as admin.ServiceAccount;
  } catch {}
  return null;
}

function tryParseServiceAccountFromFile(): admin.ServiceAccount | null {
  const p = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();
  if (!p) return null;
  try {
    const txt = fs.readFileSync(p, "utf8");
    return JSON.parse(txt) as admin.ServiceAccount;
  } catch {
    return null;
  }
}

function getMessaging(): admin.messaging.Messaging | null {
  if (cachedMessaging !== undefined) return cachedMessaging;
  try {
    let app: admin.app.App;
    if (admin.apps.length > 0) {
      app = admin.app();
    } else {
      const serviceAccount = tryParseServiceAccountFromEnv() || tryParseServiceAccountFromFile();
      if (!serviceAccount) {
        cachedMessaging = null;
        return null;
      }
      const projectId = String(process.env.FIREBASE_PROJECT_ID || serviceAccount.projectId || "").trim() || undefined;
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId
      });
    }
    cachedMessaging = app.messaging();
    return cachedMessaging;
  } catch {
    cachedMessaging = null;
    return null;
  }
}

export async function upsertPushToken(input: UpsertPushTokenInput): Promise<void> {
  const companyId = Number(input.companyId || 0);
  const userId = Number(input.userId || 0);
  const token = String(input.token || "").trim();
  if (!companyId || !userId || !token) return;
  await ensurePushTokensTable();
  await pgQuery(
    `
      INSERT INTO "MobilePushTokens"
        ("companyId", "userId", token, platform, "deviceId", "appVersion", "lastSeenAt", "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      ON CONFLICT ("companyId", "userId", token)
      DO UPDATE SET
        platform = EXCLUDED.platform,
        "deviceId" = EXCLUDED."deviceId",
        "appVersion" = EXCLUDED."appVersion",
        "lastSeenAt" = NOW(),
        "updatedAt" = NOW()
    `,
    [
      companyId,
      userId,
      token,
      normalizePlatform(input.platform),
      input.deviceId ? String(input.deviceId).trim() : null,
      input.appVersion ? String(input.appVersion).trim() : null
    ]
  );
}

export async function deletePushToken(opts: { companyId: number; userId: number; token?: string | null }): Promise<void> {
  const companyId = Number(opts.companyId || 0);
  const userId = Number(opts.userId || 0);
  if (!companyId || !userId) return;
  await ensurePushTokensTable();
  const token = String(opts.token || "").trim();
  if (token) {
    await pgQuery(
      `
      DELETE FROM "MobilePushTokens"
      WHERE "companyId" = $1 AND "userId" = $2 AND token = $3
    `,
      [companyId, userId, token]
    );
    return;
  }
  await pgQuery(
    `
    DELETE FROM "MobilePushTokens"
    WHERE "companyId" = $1 AND "userId" = $2
  `,
    [companyId, userId]
  );
}

function chunkTokens(tokens: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < tokens.length; i += size) {
    out.push(tokens.slice(i, i + size));
  }
  return out;
}

export async function sendInboundMessagePush(opts: {
  companyId: number;
  ticketId: number;
  title: string;
  body: string;
}): Promise<void> {
  const companyId = Number(opts.companyId || 0);
  const ticketId = Number(opts.ticketId || 0);
  const title = String(opts.title || "").trim() || "Nova mensagem";
  const body = String(opts.body || "").trim() || "Nova mensagem recebida";
  if (!companyId || !ticketId) return;

  const messaging = getMessaging();
  if (!messaging) return;

  await ensurePushTokensTable();
  const rows = await pgQuery<{ token: string; platform: string }>(
    `
      SELECT token, platform
      FROM "MobilePushTokens"
      WHERE "companyId" = $1
        AND "lastSeenAt" >= (NOW() - INTERVAL '90 days')
    `,
    [companyId]
  );
  const tokens = Array.from(
    new Set(
      (rows || [])
        .map((r) => String(r.token || "").trim())
        .filter((t) => t.length > 20)
    )
  );
  if (!tokens.length) return;

  const invalidTokens = new Set<string>();
  const groups = chunkTokens(tokens, 500);
  for (const group of groups) {
    try {
      const resp = await messaging.sendEachForMulticast({
        tokens: group,
        notification: { title, body },
        data: {
          ticketId: String(ticketId),
          companyId: String(companyId),
          type: "inbound_message"
        },
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert"
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1
            }
          }
        },
        android: {
          priority: "high",
          notification: {
            channelId: "trmultichat_messages",
            sound: "default"
          }
        }
      });
      resp.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = String((r.error as any)?.code || "").trim().toLowerCase();
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          const tk = group[idx];
          if (tk) invalidTokens.add(tk);
        }
      });
    } catch {}
  }

  if (!invalidTokens.size) return;
  try {
    await pgQuery(
      `
      DELETE FROM "MobilePushTokens"
      WHERE "companyId" = $1 AND token = ANY($2::text[])
    `,
      [companyId, Array.from(invalidTokens)]
    );
  } catch {}
}
