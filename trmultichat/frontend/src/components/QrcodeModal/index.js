import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";

import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { socketConnection } from "../../services/socket";
import { TrButton } from "../ui";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    dialogPaper: {
      borderRadius: 16,
      overflow: "hidden",
      minWidth: 680,
      maxWidth: 760,
      background: isDark
        ? "linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.92))"
        : "linear-gradient(180deg, #ffffff, #f6fafc)",
      boxShadow: isDark
        ? "0 20px 50px rgba(0,0,0,0.45)"
        : "0 20px 50px rgba(9, 30, 66, 0.18)",
    },
    titleWrap: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingBottom: 4,
    },
    content: {
      paddingTop: 12,
      paddingBottom: 20,
    },
    section: {
      borderRadius: 14,
      border: `1px solid ${theme.palette.divider}`,
      padding: theme.spacing(2),
      background: isDark ? "rgba(255,255,255,0.02)" : "rgba(17, 24, 39, 0.015)",
    },
    sectionTitle: {
      fontWeight: 800,
      marginBottom: theme.spacing(1),
    },
    pairingRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    pairingCodeBox: {
      marginTop: theme.spacing(1.5),
      padding: theme.spacing(1.4, 1.6),
      borderRadius: 12,
      border: `1px dashed ${theme.palette.divider}`,
      background: isDark ? "rgba(51, 65, 85, 0.35)" : "rgba(15, 23, 42, 0.04)",
    },
    pairingCode: {
      fontSize: 28,
      fontWeight: 900,
      letterSpacing: 1.8,
      lineHeight: 1.15,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      color: isDark ? "#7dd3fc" : "#0f4c5c",
      userSelect: "all",
    },
    qrWrap: {
      marginTop: theme.spacing(1),
      display: "flex",
      justifyContent: "center",
    },
    qrCard: {
      padding: theme.spacing(1.5),
      borderRadius: 12,
      border: `1px solid ${theme.palette.divider}`,
      background: "#fff",
      display: "inline-flex",
    },
    helpText: {
      marginTop: theme.spacing(1),
      color: theme.palette.text.secondary,
    },
  };
});

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const [qrCode, setQrCode] = useState("");
  const [status, setStatus] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const [pairingPhoneNumber, setPairingPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState("");
  const [pairingPhonePreview, setPairingPhonePreview] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);

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
        if (!extractQr(data)) {
          try {
            const { data: pairingData } = await api.get(`/whatsappsession/${whatsAppId}/pairing-status`);
            setPairingCode(pairingData?.pairingCode || "");
            setPairingExpiresAt(pairingData?.pairingExpiresAt || "");
            if (pairingData?.status) setStatus(pairingData.status);
          } catch (_) {}
        }
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

    socket.on(`company-${companyId}-whatsapp`, (payload) => {
      if (!payload || Number(payload.whatsappId) !== Number(whatsAppId)) return;
      const eventName = String(payload.event || "");
      if (eventName === "whatsapp:pairing") {
        setStatus("pairing");
        setPairingCode(String(payload.pairingCode || ""));
        setPairingExpiresAt(String(payload.pairingExpiresAt || ""));
        setQrCode("");
      }
      if (eventName === "whatsapp:connected") {
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
        if (!nextQr) {
          try {
            const { data: pairingData } = await api.get(`/whatsappsession/${whatsAppId}/pairing-status`);
            if (pairingData?.status) setStatus(pairingData.status);
            setPairingCode(pairingData?.pairingCode || "");
            setPairingExpiresAt(pairingData?.pairingExpiresAt || "");
          } catch (_) {}
        }
      } catch (_) {}
    }, 2500);

    return () => {
      clearInterval(intervalId);
    };
  }, [open, whatsAppId, qrCode, onClose]);

  const handleGeneratePairingCode = async () => {
    if (!whatsAppId) return;
    setPairingLoading(true);
    try {
      const { data } = await api.post(`/whatsappsession/${whatsAppId}/pairing-code`, {
        phoneNumber: pairingPhoneNumber,
      });
      setStatus(String(data?.status || "pairing"));
      setPairingCode(String(data?.pairingCode || ""));
      setPairingExpiresAt(String(data?.pairingExpiresAt || ""));
      setPairingPhonePreview(String(data?.phonePreview || ""));
      setQrCode("");
    } catch (err) {
      toastError(err);
    } finally {
      setPairingLoading(false);
    }
  };

  // reset state on close/open changes
  useEffect(() => {
    if (!open) {
      setQrCode("");
      setStatus("");
      setTimedOut(false);
      setPairingCode("");
      setPairingExpiresAt("");
      setPairingPhonePreview("");
      setPairingLoading(false);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      classes={{ paper: classes.dialogPaper }}
      scroll="paper"
    >
      <DialogTitle>
        <Box className={classes.titleWrap}>
          <Typography variant="h6" style={{ fontWeight: 900 }}>
            {i18n.t("qrCode.message")}
          </Typography>
          <Chip
            size="small"
            label={(status || "DISCONNECTED").toString().toUpperCase()}
            style={{ fontWeight: 800 }}
          />
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent className={classes.content}>
        <Box className={classes.section} style={{ marginBottom: 14 }}>
          <Typography className={classes.sectionTitle}>Pairing Code</Typography>
          <Box className={classes.pairingRow}>
            <TextField
              variant="outlined"
              size="small"
              fullWidth
              label="Número para parear (55 + DDD + número)"
              placeholder="Ex.: 5511999999999"
              value={pairingPhoneNumber}
              onChange={(e) => setPairingPhoneNumber(e.target.value)}
              helperText="Aceita +55 82 98133-0112, 5582981330112 ou 82981330112"
            />
            <TrButton onClick={handleGeneratePairingCode} disabled={pairingLoading || !pairingPhoneNumber}>
              {pairingLoading ? "Gerando..." : "Gerar código"}
            </TrButton>
          </Box>
          {pairingCode ? (
            <Box className={classes.pairingCodeBox}>
              <Typography variant="caption" color="textSecondary">
                Código atual
              </Typography>
              <Typography className={classes.pairingCode}>{pairingCode}</Typography>
              {pairingExpiresAt ? (
                <Typography variant="caption" color="textSecondary">
                  Expira em: {new Date(pairingExpiresAt).toLocaleString()}
                </Typography>
              ) : null}
              {pairingPhonePreview ? (
                <Typography variant="caption" color="textSecondary" display="block">
                  Número para confirmar no WhatsApp: {pairingPhonePreview}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Typography variant="body2" className={classes.helpText}>
              Informe o número do aparelho para gerar o código de pareamento.
            </Typography>
          )}
        </Box>

        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>QR Code</Typography>
          {qrCode ? (
            <Box className={classes.qrWrap}>
              <Paper elevation={0} className={classes.qrCard}>
                <QRCode value={qrCode} size={260} />
              </Paper>
            </Box>
          ) : (
            <Typography variant="body2" className={classes.helpText}>
              {String(status || "").toUpperCase() === "CONNECTED"
                ? "Conexão já está ativa."
                : timedOut
                  ? "Não foi possível gerar o QR Code. Tente novamente."
                  : "Gerando QR Code..."}
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
