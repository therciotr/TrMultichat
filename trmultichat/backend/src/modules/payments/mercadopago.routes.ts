import { Router } from "express";
import { getLegacyModel } from "../../utils/legacyModel";
import request from "request";
import { getCompanyAccessToken } from "../../services/mercadoPagoService";

const router = Router();

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
        `${process.env.BACKEND_URL || ""}/payments/mercadopago/webhook`,
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
          const Invoices = getLegacyModel("Invoices");
          const Company = getLegacyModel("Company");
          if (Invoices && typeof Invoices.update === "function") {
            await Invoices.update({ status: "paid" }, { where: { id: invoiceId } });
          }
          if (Company && typeof Company.findByPk === "function" && companyId) {
            const company = await Company.findByPk(companyId);
            if (company) {
              const plain = company?.toJSON ? company.toJSON() : company;
              const currentDue = plain?.dueDate ? new Date(plain.dueDate) : new Date();
              currentDue.setDate(currentDue.getDate() + 30);
              const nextDue = currentDue.toISOString().split("T")[0];
              if (typeof company.update === "function") {
                await company.update({ dueDate: nextDue });
              }
            }
          }
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            let socketLib: any;
            try {
              // Prefer TS libs, fallback to legacy dist
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
                company: { id: companyId }
              });
            }
          } catch {
            // ignore socket errors
          }
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

export default router;



