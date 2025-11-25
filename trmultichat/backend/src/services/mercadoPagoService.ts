import { getLegacyModel } from "../utils/legacyModel";
import request from "request";

export type MpPixLikeResponse = {
  valor: { original: string };
  qrcode: { qrcode: string };
  // Mantém a resposta original para debug/uso futuro
  raw?: any;
};

export async function getCompanyAccessToken(companyId: number): Promise<string | undefined> {
  try {
    const Setting = getLegacyModel("Setting");
    if (Setting && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({ where: { companyId, key: "mpAccessToken" } });
      if (row) {
        const plain = row?.toJSON ? row.toJSON() : row;
        if (plain?.value) return String(plain.value);
      }
    }
  } catch {
    // ignore and fallback to env
  }
  return process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
}

type CreateSubscriptionInput = {
  companyId: number;
  invoiceId: number;
  price: number;
  users: number;
  connections: number;
};

export async function createSubscriptionPreference(input: CreateSubscriptionInput): Promise<MpPixLikeResponse> {
  const { companyId, invoiceId, price } = input;

  const token = await getCompanyAccessToken(companyId);
  if (!token) {
    throw new Error("missing access token");
  }

  const normalizedPrice = Number(price || 0);
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error("invalid price");
  }

  const payload: any = {
    items: [
      {
        title: `Fatura #${invoiceId || ""}`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: normalizedPrice
      }
    ],
    // metadata será usada no webhook para localizar fatura/empresa
    metadata: {
      invoiceId: invoiceId || null,
      companyId: companyId || null,
      kind: "subscription"
    },
    notification_url:
      process.env.MERCADOPAGO_WEBHOOK_URL ||
      process.env.MP_WEBHOOK_URL ||
      `${process.env.BACKEND_URL || ""}/payments/mercadopago/webhook`
  };

  return new Promise<MpPixLikeResponse>((resolve, reject) => {
    request.post(
      {
        url: "https://api.mercadopago.com/checkout/preferences",
        headers: { Authorization: `Bearer ${token}` },
        json: true,
        body: payload
      },
      (err, _resp, data) => {
        if (err) return reject(err);
        try {
          const initPoint: string =
            (data && (data.init_point || data.sandbox_init_point || data.external_resource_url)) || "";
          if (!initPoint) {
            return reject(new Error("invalid Mercado Pago response (missing init_point)"));
          }
          const priceStr =
            typeof normalizedPrice === "number"
              ? normalizedPrice.toLocaleString("pt-br", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).replace(/\./g, "").replace(",", ".")
              : String(normalizedPrice);

          const response: MpPixLikeResponse = {
            valor: { original: priceStr },
            qrcode: { qrcode: String(initPoint) },
            raw: data
          };
          return resolve(response);
        } catch (e) {
          return reject(e);
        }
      }
    );
  });
}



