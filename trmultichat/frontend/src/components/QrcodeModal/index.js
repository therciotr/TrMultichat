import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";

import { Dialog, DialogContent, Paper, Typography } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { socketConnection } from "../../services/socket";

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const [qrCode, setQrCode] = useState("");
  const [status, setStatus] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  const extractQr = (payload) => {
    if (!payload) return "";
    return (
      payload.qrcode ||
      payload.qrCode ||
      payload.qr ||
      payload.session?.qrcode ||
      ""
    );
  };

  const extractStatus = (payload) => {
    if (!payload) return "";
    return (
      payload.status ||
      payload.session?.status ||
      ""
    );
  };

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;

      try {
        // QR code real é exposto em /whatsappsession/:id
        const { data } = await api.get(`/whatsappsession/${whatsAppId}`);
        setQrCode(extractQr(data));
        setStatus(extractStatus(data));
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  useEffect(() => {
    if (!whatsAppId) return;
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });

    socket.on(`company-${companyId}-whatsappSession`, (data) => {
      if (data.action === "update" && data.session.id === whatsAppId) {
        setQrCode(extractQr(data));
        setStatus(extractStatus(data));
      }

      // Fecha o modal quando conectar de fato
      if (data.action === "update" && String(data.session?.status || "").toUpperCase() === "CONNECTED") {
        onClose();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [whatsAppId, onClose]);

  // Fallback polling while QR não chegou via socket/GET inicial
  useEffect(() => {
    if (!open || !whatsAppId) return;
    if (qrCode) return;

    setTimedOut(false);
    const startedAt = Date.now();
    const intervalId = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > 60_000) {
        setTimedOut(true);
        clearInterval(intervalId);
        return;
      }
      try {
        const { data } = await api.get(`/whatsappsession/${whatsAppId}`);
        const nextQr = extractQr(data);
        const nextStatus = extractStatus(data);
        if (nextStatus) setStatus(nextStatus);
        if (nextQr) {
          setQrCode(nextQr);
          clearInterval(intervalId);
          return;
        }
        if (String(nextStatus || "").toUpperCase() === "CONNECTED") {
          clearInterval(intervalId);
          onClose();
        }
      } catch (_) {}
    }, 2500);

    return () => {
      clearInterval(intervalId);
    };
  }, [open, whatsAppId, qrCode, onClose]);

  // reset state on close/open changes
  useEffect(() => {
    if (!open) {
      setQrCode("");
      setStatus("");
      setTimedOut(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" scroll="paper">
      <DialogContent>
        <Paper elevation={0}>
          <Typography style={{ color: "var(--tr-heading, var(--tr-primary))", fontWeight: 900 }} gutterBottom>
            {i18n.t("qrCode.message")}
          </Typography>
          {qrCode ? (
            <QRCode value={qrCode} size={256} />
          ) : (
            <span>
              {timedOut
                ? "Não foi possível gerar o QR Code. Tente novamente."
                : "Gerando QR Code…"}
              {status ? ` (${String(status).toUpperCase()})` : ""}
            </span>
          )}
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
