import React, { useEffect, useState } from "react";
import {
  TextField,
  FormControlLabel,
  Typography,
  Grid,
  Paper,
  Box,
  Switch,
  IconButton,
  InputAdornment,
  Chip,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { TrButton } from "../ui";
import MailOutlineOutlinedIcon from "@material-ui/icons/MailOutlineOutlined";
import DnsOutlinedIcon from "@material-ui/icons/DnsOutlined";
import VpnKeyOutlinedIcon from "@material-ui/icons/VpnKeyOutlined";
import AlternateEmailOutlinedIcon from "@material-ui/icons/AlternateEmailOutlined";
import SecurityOutlinedIcon from "@material-ui/icons/SecurityOutlined";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@material-ui/icons/VisibilityOffOutlined";
import CheckCircleOutlineOutlinedIcon from "@material-ui/icons/CheckCircleOutlineOutlined";
import ErrorOutlineOutlinedIcon from "@material-ui/icons/ErrorOutlineOutlined";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: 980,
  },
  hero: {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
    background:
      "linear-gradient(135deg, rgba(14, 116, 144, 0.14), rgba(59, 130, 246, 0.08) 55%, rgba(255,255,255,0.95))",
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  heroRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(59, 130, 246, 0.12)",
    color: "rgba(14, 116, 144, 1)",
    border: "1px solid rgba(59, 130, 246, 0.16)",
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: 1000,
    margin: 0,
    color: "rgba(15, 23, 42, 0.92)",
  },
  heroSub: {
    marginTop: 4,
    marginBottom: 0,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.66)",
  },
  card: {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
    backgroundColor: "#fff",
    padding: theme.spacing(2),
    height: "100%",
  },
  sectionTitle: {
    fontWeight: 1000,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.82)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      backgroundColor: "#fff",
    },
  },
  banner: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    padding: theme.spacing(1.25, 1.5),
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: theme.spacing(1.5),
  },
  bannerOk: {
    background: "rgba(16, 185, 129, 0.10)",
    borderColor: "rgba(16, 185, 129, 0.22)",
  },
  bannerErr: {
    background: "rgba(239, 68, 68, 0.10)",
    borderColor: "rgba(239, 68, 68, 0.20)",
  },
  bannerTitle: {
    fontWeight: 1000,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.90)",
    margin: 0,
  },
  bannerText: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.70)",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
  },
  saveBtn: {
    borderRadius: 12,
    fontWeight: 1000,
    textTransform: "none",
    padding: theme.spacing(1, 2),
  },
}));

const EmailSettings = () => {
  const classes = useStyles();
  const [form, setForm] = useState({
    mail_host: "",
    mail_port: "",
    mail_user: "",
    mail_pass: "",
    mail_from: "",
    mail_secure: false
  });
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data } = await api.get("/settings/email");
        if (!mounted) return;
        setForm(prev => ({
          ...prev,
          mail_host: data.mail_host || "",
          mail_port: data.mail_port != null ? String(data.mail_port) : "",
          mail_user: data.mail_user || "",
          mail_from: data.mail_from || "",
          mail_secure: !!data.mail_secure,
          mail_pass: ""
        }));
        setHasPassword(!!data.has_password);
        setLastLoadedAt(new Date().toISOString());
      } catch {
        setError("Não foi possível carregar as configurações de e-mail.");
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = field => e => {
    const value = field === "mail_secure" ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        mail_host: form.mail_host || null,
        mail_port: form.mail_port ? Number(form.mail_port) : null,
        mail_user: form.mail_user || null,
        mail_pass: form.mail_pass || "",
        mail_from: form.mail_from || null,
        mail_secure: form.mail_secure
      };
      const resp = await api.put("/settings/email", payload);
      const data = resp?.data || {};
      // backend now returns the saved snapshot; fallback if it returns only { ok: true }
      if (data && (data.mail_host !== undefined || data.mail_port !== undefined)) {
        setForm(prev => ({
          ...prev,
          mail_host: data.mail_host || "",
          mail_port: data.mail_port != null ? String(data.mail_port) : "",
          mail_user: data.mail_user || "",
          mail_from: data.mail_from || "",
          mail_secure: !!data.mail_secure,
          mail_pass: ""
        }));
        setHasPassword(!!data.has_password);
        setLastLoadedAt(new Date().toISOString());
      } else {
        // last resort: reload
        try {
          const { data: fresh } = await api.get("/settings/email");
          setForm(prev => ({
            ...prev,
            mail_host: fresh.mail_host || "",
            mail_port: fresh.mail_port != null ? String(fresh.mail_port) : "",
            mail_user: fresh.mail_user || "",
            mail_from: fresh.mail_from || "",
            mail_secure: !!fresh.mail_secure,
            mail_pass: ""
          }));
          setHasPassword(!!fresh.has_password);
          setLastLoadedAt(new Date().toISOString());
        } catch {}
      }
      setMessage("Configurações salvas com sucesso.");
    } catch {
      setError("Não foi possível salvar as configurações de e-mail.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className={classes.root}>
        <Typography style={{ color: "rgba(15, 23, 42, 0.70)" }}>
          Carregando configurações de e-mail...
        </Typography>
      </div>
    );
  }

  const secureLabel = form.mail_secure ? "TLS/SSL (Secure)" : "Sem TLS/SSL";
  const saveDisabled = saving;
  const configuredCount = [
    Boolean(String(form.mail_host || "").trim()),
    Boolean(String(form.mail_port || "").trim()),
    Boolean(String(form.mail_user || "").trim()),
    Boolean(String(form.mail_from || "").trim()),
    Boolean(hasPassword),
  ].filter(Boolean).length;
  const isFullyConfigured = configuredCount >= 5;

  return (
    <div className={classes.root}>
      <Paper className={classes.hero} elevation={0}>
        <div className={classes.heroRow}>
          <div className={classes.heroIcon}>
            <MailOutlineOutlinedIcon />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className={classes.heroTitle}>E-mail / SMTP</p>
            <p className={classes.heroSub}>
              Configure o servidor SMTP para envio de e-mails do sistema (notificações, automações, etc.).
            </p>
          </div>
          <Box flex={1} />
          <Chip
            size="small"
            icon={<SecurityOutlinedIcon />}
            label={secureLabel}
            style={{
              fontWeight: 1000,
              background: form.mail_secure ? "rgba(16,185,129,0.12)" : "rgba(15,23,42,0.08)",
            }}
          />
        </div>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper className={classes.card} elevation={0}>
            <div className={classes.sectionTitle}>
              <DnsOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
              Servidor
            </div>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  className={classes.field}
                  label="Host SMTP"
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={form.mail_host}
                  onChange={handleChange("mail_host")}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  className={classes.field}
                  label="Porta"
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={form.mail_port}
                  onChange={handleChange("mail_port")}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(form.mail_secure)}
                      onChange={handleChange("mail_secure")}
                      color="primary"
                    />
                  }
                  label="Usar TLS/SSL (Secure)"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper className={classes.card} elevation={0}>
            <div className={classes.sectionTitle}>
              <VpnKeyOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
              Credenciais
            </div>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  className={classes.field}
                  label="Usuário"
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={form.mail_user}
                  onChange={handleChange("mail_user")}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  className={classes.field}
                  label="Senha SMTP"
                  type={showPass ? "text" : "password"}
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={form.mail_pass}
                  onChange={handleChange("mail_pass")}
                  helperText={hasPassword ? "Senha já configurada. Deixe em branco para manter." : ""}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPass((v) => !v)}
                          aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPass ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  className={classes.field}
                  label="Remetente (From)"
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={form.mail_from}
                  onChange={handleChange("mail_from")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AlternateEmailOutlinedIcon style={{ fontSize: 18, opacity: 0.7 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Box mt={2}>
        <Paper className={classes.card} elevation={0}>
          <div className={classes.sectionTitle}>
            <MailOutlineOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
            Resumo da configuração
          </div>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.62)" }}>
                Servidor
              </Typography>
              <Typography style={{ fontWeight: 900 }}>
                {form.mail_host ? `${form.mail_host}${form.mail_port ? `:${form.mail_port}` : ""}` : "—"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.62)" }}>
                Remetente (From)
              </Typography>
              <Typography style={{ fontWeight: 900 }}>
                {form.mail_from || "—"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.62)" }}>
                Usuário
              </Typography>
              <Typography style={{ fontWeight: 900 }}>
                {form.mail_user || "—"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.62)" }}>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gridGap={8} style={{ flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  icon={isFullyConfigured ? <CheckCircleOutlineOutlinedIcon /> : <ErrorOutlineOutlinedIcon />}
                  label={isFullyConfigured ? "Configuração completa" : `Parcial (${configuredCount}/5)`}
                  style={{
                    fontWeight: 1000,
                    background: isFullyConfigured ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.14)",
                  }}
                />
                <Chip
                  size="small"
                  icon={<VpnKeyOutlinedIcon />}
                  label={hasPassword ? "Senha configurada" : "Senha não configurada"}
                  style={{
                    fontWeight: 1000,
                    background: hasPassword ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
                  }}
                />
                {lastLoadedAt ? (
                  <Chip
                    size="small"
                    icon={<SaveOutlinedIcon />}
                    label={`Atualizado: ${new Date(lastLoadedAt).toLocaleString()}`}
                    style={{ fontWeight: 900, background: "rgba(15,23,42,0.06)" }}
                  />
                ) : null}
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {message ? (
        <div className={`${classes.banner} ${classes.bannerOk}`}>
          <CheckCircleOutlineOutlinedIcon style={{ color: "rgba(16,185,129,0.95)" }} />
          <div>
            <p className={classes.bannerTitle}>Configurações salvas</p>
            <div className={classes.bannerText}>{message}</div>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className={`${classes.banner} ${classes.bannerErr}`}>
          <ErrorOutlineOutlinedIcon style={{ color: "rgba(239,68,68,0.95)" }} />
          <div>
            <p className={classes.bannerTitle}>Não foi possível concluir</p>
            <div className={classes.bannerText}>{error}</div>
          </div>
        </div>
      ) : null}

      <div className={classes.actions}>
        <TrButton
          className={classes.saveBtn}
          onClick={async () => {
            setLoading(true);
            setMessage("");
            setError("");
            try {
              const { data } = await api.get("/settings/email");
              setForm(prev => ({
                ...prev,
                mail_host: data.mail_host || "",
                mail_port: data.mail_port != null ? String(data.mail_port) : "",
                mail_user: data.mail_user || "",
                mail_from: data.mail_from || "",
                mail_secure: !!data.mail_secure,
                mail_pass: ""
              }));
              setHasPassword(!!data.has_password);
              setLastLoadedAt(new Date().toISOString());
            } catch {
              setError("Não foi possível recarregar as configurações de e-mail.");
            }
            setLoading(false);
          }}
          disabled={saveDisabled}
        >
          Recarregar
        </TrButton>
        <TrButton
          className={classes.saveBtn}
          onClick={handleSave}
          disabled={saveDisabled}
          startIcon={<SaveOutlinedIcon />}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </TrButton>
      </div>
    </div>
  );
};

export default EmailSettings;




