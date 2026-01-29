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
import AddOutlinedIcon from "@material-ui/icons/AddOutlined";
import DeleteOutlineOutlinedIcon from "@material-ui/icons/DeleteOutlineOutlined";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
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
  miniCard: {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
    backgroundColor: "#fff",
    padding: theme.spacing(1.5),
    height: "100%",
  },
  miniRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  miniIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(59, 130, 246, 0.10)",
    border: "1px solid rgba(59, 130, 246, 0.14)",
    color: "rgba(14, 116, 144, 1)",
    flexShrink: 0,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: 1000,
    color: "rgba(15, 23, 42, 0.55)",
    margin: 0,
  },
  miniValue: {
    fontSize: 13,
    fontWeight: 1000,
    color: "rgba(15, 23, 42, 0.90)",
    marginTop: 2,
    wordBreak: "break-word",
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
    name: "",
    mail_host: "",
    mail_port: "",
    mail_user: "",
    mail_pass: "",
    mail_from: "",
    mail_secure: false,
    isDefault: false,
  });
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [editMode, setEditMode] = useState(true);

  const applyProfileToForm = (p) => {
    setForm({
      name: String(p?.name || p?.user || p?.mail_user || "").trim(),
      mail_host: p?.host || p?.mail_host || "",
      mail_port: p?.port != null ? String(p.port) : (p?.mail_port != null ? String(p.mail_port) : ""),
      mail_user: p?.user || p?.mail_user || "",
      mail_pass: "",
      mail_from: p?.from || p?.mail_from || "",
      mail_secure: !!(p?.secure ?? p?.mail_secure),
      isDefault: !!(p?.isDefault ?? p?.is_default),
    });
    setHasPassword(!!(p?.has_password ?? p?.hasPassword));
  };

  const resetToBlank = () => {
    setForm({
      name: "",
      mail_host: "",
      mail_port: "",
      mail_user: "",
      mail_pass: "",
      mail_from: "",
      mail_secure: false,
      isDefault: false,
    });
    setHasPassword(false);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // Prefer multi-profile API
        const { data } = await api.get("/settings/email/profiles");
        if (!mounted) return;
        const list = Array.isArray(data?.profiles) ? data.profiles : [];
        setProfiles(list);
        setLastLoadedAt(new Date().toISOString());

        const def = list.find((x) => !!x?.isDefault) || list[0];
        if (def) {
          setActiveProfileId(Number(def.id || 0) || null);
          applyProfileToForm(def);
          setEditMode(false);
        } else {
          setActiveProfileId(null);
          resetToBlank();
          setEditMode(true);
        }
      } catch {
        // fallback (single-config legacy endpoint)
        try {
          const { data } = await api.get("/settings/email");
          if (!mounted) return;
          setProfiles([]);
          setActiveProfileId(null);
          applyProfileToForm({
            name: String(data?.mail_user || "SMTP").trim(),
            mail_host: data?.mail_host,
            mail_port: data?.mail_port,
            mail_user: data?.mail_user,
            mail_from: data?.mail_from,
            mail_secure: data?.mail_secure,
            has_password: data?.has_password,
            isDefault: true
          });
          setLastLoadedAt(new Date().toISOString());
          const hasAnyConfig =
            Boolean(String(data.mail_host || "").trim()) ||
            data.mail_port != null ||
            Boolean(String(data.mail_user || "").trim()) ||
            Boolean(String(data.mail_from || "").trim()) ||
            Boolean(data.has_password);
          setEditMode(!hasAnyConfig);
        } catch {
          setError("Não foi possível carregar as configurações de e-mail.");
        }
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
        name: String(form.name || form.mail_user || "SMTP").trim(),
        mail_host: form.mail_host || null,
        mail_port: form.mail_port ? Number(form.mail_port) : null,
        mail_user: form.mail_user || null,
        mail_pass: form.mail_pass || "",
        mail_from: form.mail_from || null,
        mail_secure: form.mail_secure,
        isDefault: !!form.isDefault
      };
      // Create or update profile
      if (activeProfileId) {
        await api.put(`/settings/email/profiles/${activeProfileId}`, payload);
        setMessage("Perfil SMTP atualizado com sucesso.");
      } else {
        const resp = await api.post(`/settings/email/profiles`, payload);
        const newId = Number(resp?.data?.id || 0) || null;
        setActiveProfileId(newId);
        setMessage("Perfil SMTP criado com sucesso.");
      }
      // Refresh list
      try {
        const { data } = await api.get("/settings/email/profiles");
        const list = Array.isArray(data?.profiles) ? data.profiles : [];
        setProfiles(list);
        const current = activeProfileId
          ? list.find((x) => Number(x?.id) === Number(activeProfileId))
          : (list.find((x) => Number(x?.id) === Number(resp?.data?.id)) || null);
        const def = list.find((x) => !!x?.isDefault) || list[0];
        applyProfileToForm(current || def);
        setLastLoadedAt(new Date().toISOString());
      } catch {}
      setEditMode(false);
    } catch {
      setError("Não foi possível salvar as configurações de e-mail.");
    }
    setSaving(false);
  };

  const handleDeleteProfile = async (id) => {
    const ok = window.confirm("Excluir este perfil SMTP?\n\nIsso não pode ser desfeito.");
    if (!ok) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.delete(`/settings/email/profiles/${id}`);
      const { data } = await api.get("/settings/email/profiles");
      const list = Array.isArray(data?.profiles) ? data.profiles : [];
      setProfiles(list);
      const def = list.find((x) => !!x?.isDefault) || list[0];
      if (def) {
        setActiveProfileId(Number(def.id || 0) || null);
        applyProfileToForm(def);
        setEditMode(false);
      } else {
        setActiveProfileId(null);
        resetToBlank();
        setEditMode(true);
      }
      setLastLoadedAt(new Date().toISOString());
      setMessage("Perfil removido com sucesso.");
    } catch {
      setError("Não foi possível excluir o perfil de e-mail.");
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
        {(profiles || []).length ? (
          (profiles || []).map((p) => {
            const id = Number(p?.id || 0);
            const isDef = Boolean(p?.isDefault);
            const title = String(p?.name || p?.user || "").trim() || `SMTP #${id}`;
            const hostLabel = p?.host ? `${p.host}${p?.port ? `:${p.port}` : ""}` : "—";
            const fromLabel = p?.from || "—";
            const userLabel = p?.user || "—";
            return (
              <Grid item xs={12} md={6} key={id || title}>
                <Paper className={classes.card} elevation={0}>
                  <Box display="flex" alignItems="center">
                    <div>
                      <div style={{ fontWeight: 1000, fontSize: 14, color: "rgba(15,23,42,0.92)" }}>
                        {title}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.62)", marginTop: 2 }}>
                        {hostLabel}
                      </div>
                    </div>
                    <Box flex={1} />
                    {isDef ? (
                      <Chip
                        size="small"
                        label="Padrão"
                        style={{ fontWeight: 1000, background: "rgba(16,185,129,0.12)" }}
                      />
                    ) : null}
                  </Box>

                  <Box mt={1}>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={6}>
                        <Typography style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.62)" }}>
                          Usuário
                        </Typography>
                        <Typography style={{ fontWeight: 900 }}>{userLabel}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.62)" }}>
                          Remetente (From)
                        </Typography>
                        <Typography style={{ fontWeight: 900 }}>{fromLabel}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Box display="flex" alignItems="center" gridGap={8} style={{ flexWrap: "wrap" }}>
                          <Chip
                            size="small"
                            icon={<SecurityOutlinedIcon />}
                            label={p?.secure ? "TLS/SSL" : "Sem TLS/SSL"}
                            style={{
                              fontWeight: 1000,
                              background: p?.secure ? "rgba(16,185,129,0.10)" : "rgba(15,23,42,0.06)",
                            }}
                          />
                          <Chip
                            size="small"
                            icon={<VpnKeyOutlinedIcon />}
                            label={p?.has_password ? "Senha configurada" : "Senha não configurada"}
                            style={{
                              fontWeight: 1000,
                              background: p?.has_password ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
                            }}
                          />
                          {p?.updatedAt ? (
                            <Chip
                              size="small"
                              icon={<SaveOutlinedIcon />}
                              label={`Atualizado: ${new Date(p.updatedAt).toLocaleString()}`}
                              style={{ fontWeight: 900, background: "rgba(15,23,42,0.06)" }}
                            />
                          ) : null}
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Box mt={2} display="flex" alignItems="center" gridGap={8} style={{ flexWrap: "wrap" }}>
                    {!isDef ? (
                      <TrButton
                        className={classes.saveBtn}
                        disabled={saveDisabled}
                        onClick={async () => {
                          setSaving(true);
                          setMessage("");
                          setError("");
                          try {
                            await api.post(`/settings/email/profiles/${id}/default`);
                            const { data } = await api.get("/settings/email/profiles");
                            const list = Array.isArray(data?.profiles) ? data.profiles : [];
                            setProfiles(list);
                            const def = list.find((x) => !!x?.isDefault) || list[0];
                            setActiveProfileId(def?.id ? Number(def.id) : null);
                            applyProfileToForm(def);
                            setEditMode(false);
                            setLastLoadedAt(new Date().toISOString());
                            setMessage("Perfil definido como padrão.");
                          } catch {
                            setError("Não foi possível definir como padrão.");
                          }
                          setSaving(false);
                        }}
                      >
                        Definir padrão
                      </TrButton>
                    ) : null}

                    <TrButton
                      className={classes.saveBtn}
                      disabled={saveDisabled}
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => {
                        setMessage("");
                        setError("");
                        setActiveProfileId(id);
                        applyProfileToForm(p);
                        setEditMode(true);
                      }}
                    >
                      Editar
                    </TrButton>

                    <TrButton
                      className={classes.saveBtn}
                      disabled={saveDisabled}
                      startIcon={<DeleteOutlineOutlinedIcon />}
                      onClick={() => handleDeleteProfile(id)}
                    >
                      Excluir
                    </TrButton>
                  </Box>
                </Paper>
              </Grid>
            );
          })
        ) : (
          <Grid item xs={12}>
            <Paper className={classes.card} elevation={0}>
              <Typography style={{ fontWeight: 1000, color: "rgba(15,23,42,0.85)" }}>
                Nenhum perfil SMTP cadastrado
              </Typography>
              <Typography style={{ marginTop: 6, fontSize: 13, color: "rgba(15,23,42,0.65)" }}>
                Clique em <strong>Novo</strong> para cadastrar o primeiro perfil.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {editMode ? (
        <Box mt={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card} elevation={0}>
                <div className={classes.sectionTitle}>
                  <DnsOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
                  Perfil / Servidor
                </div>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      className={classes.field}
                      label="Nome do perfil"
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={form.name}
                      onChange={handleChange("name")}
                      helperText="Ex.: No-Reply (TrMultichat), Thercio (TR Tecnologias)"
                    />
                  </Grid>
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
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(form.isDefault)}
                          onChange={handleChange("isDefault")}
                          color="primary"
                        />
                      }
                      label="Definir como padrão (usado pelo sistema para enviar e-mails)"
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
        </Box>
      ) : null}

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
              const { data } = await api.get("/settings/email/profiles");
              const list = Array.isArray(data?.profiles) ? data.profiles : [];
              setProfiles(list);
              const def = list.find((x) => !!x?.isDefault) || list[0];
              if (def) {
                setActiveProfileId(Number(def.id || 0) || null);
                applyProfileToForm(def);
                setEditMode(false);
              } else {
                setActiveProfileId(null);
                resetToBlank();
                setEditMode(true);
              }
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
          onClick={() => {
            setMessage("");
            setError("");
            resetToBlank();
            setActiveProfileId(null);
            setEditMode(true);
          }}
          disabled={saveDisabled}
          startIcon={<AddOutlinedIcon />}
        >
          Novo
        </TrButton>
        {editMode ? (
          <TrButton
            className={classes.saveBtn}
            onClick={() => {
              setMessage("");
              setError("");
              setEditMode(false);
              const def = (profiles || []).find((x) => !!x?.isDefault) || (profiles || [])[0];
              if (def) {
                setActiveProfileId(Number(def.id || 0) || null);
                applyProfileToForm(def);
              }
            }}
            disabled={saveDisabled}
          >
            Cancelar
          </TrButton>
        ) : null}
        <TrButton
          className={classes.saveBtn}
          onClick={handleSave}
          disabled={saveDisabled || !editMode}
          startIcon={<SaveOutlinedIcon />}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </TrButton>
      </div>
    </div>
  );
};

export default EmailSettings;




