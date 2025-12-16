import { Router } from "express";
import { getLegacyModel } from "../../utils/legacyModel";
import request from "request";
import { getCompanyAccessToken } from "../../services/mercadoPagoService";
import { authMiddleware } from "../../middleware/authMiddleware";
import { pgQuery } from "../../utils/pgClient";

const router = Router();

async function markInvoicePaidAndExtendDueDate(params: {
  invoiceId: number;
  companyId: number;
  paymentId?: string | number;
}) {
  const { invoiceId, companyId, paymentId } = params;
  if (!invoiceId || !companyId) return { updated: false, dueDate: undefined as string | undefined };

  // Marcar fatura como paga no Postgres
  await pgQuery(
    'UPDATE "Invoices" SET status = $1, "updatedAt" = now() WHERE id = $2 AND "companyId" = $3',
    ["paid", invoiceId, companyId]
  );

  // Estender vencimento da licença/empresa em 30 dias (campo dueDate na Companies)
  let nextDue: string | undefined;
  try {
    const rows = await pgQuery<{ dueDate?: string }>(
      'SELECT "dueDate" FROM "Companies" WHERE id = $1 LIMIT 1',
      [companyId]
    );
    const current = rows && rows[0] ? rows[0].dueDate : undefined;
    const base = current ? new Date(current) : new Date();
    if (Number.isNaN(base.getTime())) {
      nextDue = undefined;
    } else {
      base.setDate(base.getDate() + 30);
      nextDue = base.toISOString().split("T")[0];
      await pgQuery('UPDATE "Companies" SET "dueDate" = $1, "updatedAt" = now() WHERE id = $2', [
        nextDue,
        companyId
      ]);
    }
  } catch {
    nextDue = undefined;
  }

  // Emit socket event para o frontend fechar o modal
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let socketLib: any;
    try {
      socketLib = require("../../libs/socket");
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require("path");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      socketLib = require(path.resolve(process.cwd(), "dist/libs/socket"));
    }
    const getIO = socketLib.getIO || socketLib.default || socketLib;
    const io = getIO();
    if (io && companyId) {
      io.emit(`company-${companyId}-payment`, {
        action: "CONCLUIDA",
        company: { id: companyId, dueDate: nextDue },
        invoiceId,
        paymentId: paymentId ?? undefined
      });
    }
  } catch {
    // ignore socket errors
  }

  return { updated: true, dueDate: nextDue };
}

router.post("/preference", async (req, res) => {
  try {
    const body = req.body || {};
    const { items = [], invoiceId, companyId, back_urls } = body;
    const token = await getCompanyAccessToken(Number(companyId || 0));
    if (!token) return res.status(400).json({ error: true, message: "missing access token" });

    const payload: any = {
      items: Array.isArray(items) && items.length
        ? items
        : [{ title: `Fatura #${invoiceId}`, quantity: 1, currency_id: "BRL", unit_price: Number(body.value || 0) }],
      notification_url:
        process.env.MERCADOPAGO_WEBHOOK_URL ||
        process.env.MP_WEBHOOK_URL ||
        `${(process.env.BACKEND_URL || "https://api.trmultichat.com.br").replace(/\/+$/, "")}/payments/mercadopago/webhook`,
      metadata: { invoiceId, companyId },
    };
    if (back_urls) payload.back_urls = back_urls;

    request.post({
      url: "https://api.mercadopago.com/checkout/preferences",
      headers: { Authorization: `Bearer ${token}` },
      json: true,
      body: payload
    }, (err, _resp, data) => {
      if (err) return res.status(500).json({ error: true, message: err.message });
      return res.json(data);
    });
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "preference error" });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    const type = String(req.query.type || req.body?.type || "");
    const dataId = req.query["data.id"] || req.body?.data?.id;
    if (!type || !dataId) {
      return res.status(200).json({ ok: true });
    }
    if (type !== "payment") {
      return res.status(200).json({ ok: true });
    }
    // We don't know companyId yet; try global token first (or store one global)
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) return res.status(200).json({ ok: true });

    request.get({
      url: `https://api.mercadopago.com/v1/payments/${dataId}`,
      headers: { Authorization: `Bearer ${token}` },
      json: true
    }, async (err, _resp, pay) => {
      if (err) return res.status(200).json({ ok: true });
      const metadata = pay?.metadata || {};
      const status = String(pay?.status || "");
      const invoiceId = Number(metadata?.invoiceId || 0);
      const companyId = Number(metadata?.companyId || 0);
      if (invoiceId && status === "approved") {
        try {
          await markInvoicePaidAndExtendDueDate({
            invoiceId,
            companyId,
            paymentId: String(pay?.id || dataId)
          });
        } catch {
          // swallow errors to avoid retry storms
        }
      }
      return res.status(200).json({ ok: true });
    });
  } catch (_e) {
    return res.status(200).json({ ok: true });
  }
});

// GET /payments/mercadopago/status/:paymentId
// Fallback para confirmar pagamento (quando webhook não chegar). Atualiza fatura e emite socket.
router.get("/status/:paymentId", authMiddleware, async (req, res) => {
  try {
    const companyId = Number((req as any).tenantId || 0);
    const paymentId = String(req.params.paymentId || "").trim();
    if (!companyId) return res.status(400).json({ error: true, message: "missing tenantId" });
    if (!paymentId) return res.status(400).json({ error: true, message: "missing paymentId" });

    const token = await getCompanyAccessToken(companyId);
    if (!token) return res.status(400).json({ error: true, message: "missing access token" });

    return request.get(
      {
        url: `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
        headers: { Authorization: `Bearer ${token}` },
        json: true
      },
      async (err, _resp, pay) => {
        if (err) return res.status(200).json({ ok: true, status: "unknown" });
        const status = String(pay?.status || "");
        const metadata = pay?.metadata || {};
        const invoiceId = Number(metadata?.invoiceId || (req.query as any)?.invoiceId || 0);
        const metaCompanyId = Number(metadata?.companyId || 0);
        const finalCompanyId = metaCompanyId || companyId;

        let updated = false;
        let dueDate: string | undefined;
        if (status === "approved" && invoiceId && finalCompanyId) {
          const r = await markInvoicePaidAndExtendDueDate({
            invoiceId,
            companyId: finalCompanyId,
            paymentId
          });
          updated = r.updated;
          dueDate = r.dueDate;
        }
        return res.json({ ok: true, status, invoiceId: invoiceId || null, updated, dueDate });
      }
    );
  } catch (e: any) {
    return res.status(400).json({ error: true, message: e?.message || "status error" });
  }
});

export default router;



