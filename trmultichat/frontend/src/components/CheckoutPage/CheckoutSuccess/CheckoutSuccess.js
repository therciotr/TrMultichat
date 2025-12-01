import React, { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";
import QRCode from 'react-qr-code';
import { SuccessContent, Total } from './style';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { FaCopy, FaCheckCircle } from 'react-icons/fa';
import { socketConnection } from "../../../services/socket";
import { useDate } from "../../../hooks/useDate";
import { toast } from "react-toastify";

function CheckoutSuccess(props) {
  const { pix } = props;
  // Em vez de tratar como código PIX, tratamos como link de pagamento (init_point do Mercado Pago)
  const [pixString] = useState(pix?.qrcode?.qrcode || "");
  const [copied, setCopied] = useState(false);
  const history = useHistory();

  const { dateToClient } = useDate();

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });
    socket.on(`company-${companyId}-payment`, (data) => {

      if (data.action === "CONCLUIDA") {
        toast.success(`Sua licença foi renovada até ${dateToClient(data.company.dueDate)}!`);
        setTimeout(() => {
          history.push("/");
        }, 4000);
      }
    });
  }, [history]);

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
        {/* QRCode com o link de checkout do Mercado Pago */}
        {pixString && <QRCode value={pixString} />}
        <CopyToClipboard text={pixString} onCopy={handleCopyQR}>
          <button className="copy-button" type="button">
            {copied ? (
              <>
                <span>Link copiado</span>
                <FaCheckCircle size={18} />
              </>
            ) : (
              <>
                <span>Copiar link de pagamento</span>
                <FaCopy size={18} />
              </>
            )}
          </button>
        </CopyToClipboard>
        {pixString && (
          <a
            href={pixString}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 12, fontWeight: 500 }}
          >
            Abrir página de pagamento (Mercado Pago)
          </a>
        )}
        <span>
          Para finalizar, basta abrir o link de pagamento acima (ou escanear o QRCode)
          e concluir o pagamento pelo Mercado Pago. Não é um código PIX direto, é um
          checkout seguro do Mercado Pago.
        </span>
      </SuccessContent>
    </React.Fragment>
  );
}

export default CheckoutSuccess;
