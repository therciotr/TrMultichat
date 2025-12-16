import React, { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";
import QRCode from 'react-qr-code';
import { SuccessContent, Total } from './style';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { FaCopy, FaCheckCircle } from 'react-icons/fa';
import { socketConnection } from "../../../services/socket";
import { useDate } from "../../../hooks/useDate";
import { toast } from "react-toastify";
import api from "../../../services/api";

function CheckoutSuccess(props) {
  const { pix } = props;
  // Agora qrcode.qrcode é um código PIX (copia e cola) vindo da API de PIX do Mercado Pago
  const [pixString] = useState(pix?.qrcode?.qrcode || "");
  const [copied, setCopied] = useState(false);
  const history = useHistory();
  const paymentId = pix?.paymentId || pix?.raw?.id || null;

  const { dateToClient } = useDate();

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });
    socket.on(`company-${companyId}-payment`, (data) => {

      if (data.action === "CONCLUIDA") {
        const due = data?.company?.dueDate;
        if (due) {
          toast.success(`Pagamento confirmado! Sua licença foi renovada até ${dateToClient(due)}.`);
        } else {
          toast.success("Pagamento confirmado!");
        }
        setTimeout(() => {
          history.push("/financeiro");
        }, 4000);
      }
    });
  }, [history]);

  // Fallback: polling de status (caso webhook/socket falhe)
  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;
    let tries = 0;
    const maxTries = 60; // ~5 min (60 * 5s)

    async function poll() {
      tries += 1;
      try {
        const { data } = await api.get(`/payments/mercadopago/status/${paymentId}`);
        if (cancelled) return;
        if (data?.status === "approved") {
          const due = data?.dueDate;
          if (due) {
            toast.success(`Pagamento confirmado! Sua licença foi renovada até ${dateToClient(due)}.`);
          } else {
            toast.success("Pagamento confirmado!");
          }
          setTimeout(() => history.push("/financeiro"), 1500);
          cancelled = true;
          return;
        }
      } catch (_) {
        // ignore e tenta de novo
      }
      if (!cancelled && tries < maxTries) {
        setTimeout(poll, 5000);
      }
    }

    // inicia com um pequeno delay para dar tempo do banco processar
    const t = setTimeout(poll, 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [paymentId, history, dateToClient]);

  const handleCopyQR = () => {
    setTimeout(() => {
      setCopied(false);
    }, 1 * 1000);
    setCopied(true);
  };

  return (
    <React.Fragment>
      <Total>
        <span>TOTAL</span>
        <strong>R${pix.valor.original.toLocaleString('pt-br', { minimumFractionDigits: 2 })}</strong>
      </Total>
      <SuccessContent>
        {/* QRCode PIX: bancos reconhecem como pagamento via PIX ao escanear */}
        {pixString && <QRCode value={pixString} />}
        <CopyToClipboard text={pixString} onCopy={handleCopyQR}>
          <button className="copy-button" type="button">
            {copied ? (
              <>
                <span>PIX copiado</span>
                <FaCheckCircle size={18} />
              </>
            ) : (
              <>
                <span>Copiar código PIX (copia e cola)</span>
                <FaCopy size={18} />
              </>
            )}
          </button>
        </CopyToClipboard>
        <span>
          Você pode escanear o QR Code acima no app do seu banco ou colar o código PIX
          copiado na opção &quot;PIX copia e cola&quot; para concluir o pagamento.
        </span>
      </SuccessContent>
    </React.Fragment>
  );
}

export default CheckoutSuccess;
