import request from "request";
import { getLegacyModel } from "../utils/legacyModel";

export type MpPixLikeResponse = {
  // valor total em string já normalizada (ex.: "250.00")
  valor: { original: string };
  // qrcode.qrcode conterá o código PIX (copia e cola) ou, em fallback, o link de checkout
  qrcode: { qrcode: string };
  // Mantém a resposta original para debug/uso futuro
  raw?: any;
};

export async function getCompanyAccessToken(
  companyId: number
): Promise<string | undefined> {
  try {
    const Setting = getLegacyModel("Setting");
    if (Setting && typeof Setting.findOne === "function") {
      const row = await Setting.findOne({
        where: { companyId, key: "mpAccessToken" }
      });
      if (row) {
        const plain = row?.toJSON ? row.toJSON() : row;
        if (plain?.value) return String(plain.value);
      }
    }
  } catch {
    // ignore and fallback to env
  }
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN
  );
}

type CreateSubscriptionInput = {
  companyId: number;
  invoiceId: number;
  price: number;
  users: number;
  connections: number;
};

export async function createSubscriptionPreference(
  input: CreateSubscriptionInput
): Promise<MpPixLikeResponse> {
  const { companyId, invoiceId, price } = input;

  const token = await getCompanyAccessToken(companyId);
  if (!token) {
    throw new Error("missing access token");
  }

  const normalizedPrice = Number(price || 0);
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error("invalid price");
  }

  // Formata valor em string padrão BR "250.00"
  const priceStr =
    typeof normalizedPrice === "number"
      ? normalizedPrice
          .toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
          .replace(/\./g, "")
          .replace(",", ".")
      : String(normalizedPrice);

  // Preferência de pagamento PIX via /v1/payments (payment_method_id: "pix")
  const pixPayload: any = {
    transaction_amount: normalizedPrice,
    description: `Fatura #${invoiceId || ""}`,
    payment_method_id: "pix",
    // payer mínimo — campos podem ser preenchidos depois com dados reais
    payer: {
      email: "",
      first_name: "",
      last_name: "",
      identification: {
        type: "",
        number: ""
      },
      address: {
        zip_code: "",
        street_name: "",
        street_number: null
      }
    },
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
        url: "https://api.mercadopago.com/v1/payments",
        headers: { Authorization: `Bearer ${token}` },
        json: true,
        body: pixPayload
      },
      (err, resp, data) => {
        if (err) return reject(err);
        try {
          const txData =
            data &&
            data.point_of_interaction &&
            data.point_of_interaction.transaction_data;

          const qrCodePix: string =
            (txData && (txData.qr_code || txData.qr_code_base64)) || "";

          // Fallback: se por algum motivo não vier qr_code, tenta usar ticket_url / init_point
          const fallbackUrl: string =
            (txData && (txData.ticket_url || txData.external_resource_url)) ||
            data?.init_point ||
            data?.sandbox_init_point ||
            "";

          if (!qrCodePix && !fallbackUrl) {
            const mpMsg =
              (data && (data.message || data.error || data.description)) ||
              (resp && resp.statusCode && `status ${resp.statusCode}`) ||
              "invalid PIX response (missing qr_code)";
            return reject(new Error(`Mercado Pago PIX error: ${mpMsg}`));
          }

          const response: MpPixLikeResponse = {
            valor: { original: priceStr },
            qrcode: { qrcode: String(qrCodePix || fallbackUrl) },
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
