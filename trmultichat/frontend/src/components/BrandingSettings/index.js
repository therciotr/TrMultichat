import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import ColorLensOutlinedIcon from "@material-ui/icons/ColorLensOutlined";
import ImageOutlinedIcon from "@material-ui/icons/ImageOutlined";
import PublicOutlinedIcon from "@material-ui/icons/PublicOutlined";
import TitleOutlinedIcon from "@material-ui/icons/TitleOutlined";
import CloudUploadOutlinedIcon from "@material-ui/icons/CloudUploadOutlined";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";
import RefreshOutlinedIcon from "@material-ui/icons/RefreshOutlined";
import BusinessOutlinedIcon from "@material-ui/icons/BusinessOutlined";

import { TrButton } from "../ui";
import api from "../../services/api";
import useCompanies from "../../hooks/useCompanies";
import { useThemeBranding } from "../../context/ThemeContext";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: 1100,
  },
  hero: {
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.06)",
    background:
      "linear-gradient(135deg, rgba(16, 185, 129, 0.10), rgba(59, 130, 246, 0.08) 52%, rgba(255,255,255,0.96))",
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
    border: "1px solid rgba(59, 130, 246, 0.16)",
    color: "rgba(14, 116, 144, 1)",
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
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
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
  preview: {
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
    overflow: "hidden",
  },
  previewTop: {
    padding: theme.spacing(1.2, 1.6),
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#fff",
  },
  previewBody: {
    padding: theme.spacing(2),
    minHeight: 240,
    display: "grid",
    gap: theme.spacing(1.25),
  },
  previewCard: {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(255,255,255,0.92)",
    padding: theme.spacing(1.4),
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },
  logoPreview: {
    height: 26,
    width: "auto",
    objectFit: "contain",
    filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.18))",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
    flexWrap: "wrap",
  },
}));

const normalizeBranding = (b) => ({
  appTitle: b?.appTitle || "TR Multichat",
  faviconUrl: b?.faviconUrl || "/favicon.ico",
  primaryColor: b?.primaryColor || "#0B4C46",
  secondaryColor: b?.secondaryColor || "#2BA9A5",
  buttonColor: b?.buttonColor || b?.secondaryColor || "#2BA9A5",
  textColor: b?.textColor || "#1F2937",
  backgroundType: b?.backgroundType || "color",
  backgroundColor: b?.backgroundColor || "#F4F7F7",
  backgroundImage: b?.backgroundImage || "",
  logoUrl: b?.logoUrl || "",
  fontFamily: b?.fontFamily || "Inter, sans-serif",
  borderRadius: Number(b?.borderRadius ?? 12),
  sidebarVariant: b?.sidebarVariant || "gradient",
  loginBackgroundType: b?.loginBackgroundType || "image",
});

export default function BrandingSettings({ currentUser }) {
  const classes = useStyles();
  const { list: listCompanies } = useCompanies();
  const { refreshBranding } = useThemeBranding();

  const isSuper = Boolean(currentUser?.super) || String(currentUser?.profile || "").toLowerCase() === "super";
  const currentCompanyId = Number(localStorage.getItem("companyId") || 0);

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(currentCompanyId || 0);
  const [form, setForm] = useState(normalizeBranding({}));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canPickCompany = isSuper;

  useEffect(() => {
    (async () => {
      if (!canPickCompany) return;
      const arr = await listCompanies();
      setCompanies(Array.isArray(arr) ? arr : []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPickCompany]);

  const fetchBranding = async (cid) => {
    setLoading(true);
    try {
      const { data } = await api.get("/branding", { params: cid ? { companyId: cid } : {} });
      setForm(normalizeBranding(data || {}));
    } catch {
      setForm(normalizeBranding({}));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBranding(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleUpload = async (file, key) => {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    const res = await api.post("/branding/upload", data, {
      params: companyId ? { companyId } : {},
      headers: { "Content-Type": "multipart/form-data" },
    });
    const url = res?.data?.url;
    if (url) setForm((f) => ({ ...f, [key]: url }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/branding", form, { params: companyId ? { companyId } : {} });
      // Apply immediately if editing current company
      if (Number(companyId) === Number(currentCompanyId)) {
        await refreshBranding();
      }
    } finally {
      setSaving(false);
    }
  };

  const bgStyle = useMemo(() => {
    if (form.backgroundType === "image" && form.backgroundImage) {
      return { background: `url(${form.backgroundImage}) center/cover no-repeat` };
    }
    return { background: form.backgroundColor };
  }, [form.backgroundColor, form.backgroundImage, form.backgroundType]);

  const topBarStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})`,
      fontFamily: form.fontFamily,
    }),
    [form.fontFamily, form.primaryColor, form.secondaryColor]
  );

  return (
    <div className={classes.root}>
      <Paper className={classes.hero} elevation={0}>
        <div className={classes.heroRow}>
          <div className={classes.heroIcon}>
            <ColorLensOutlinedIcon />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className={classes.heroTitle}>Identidade visual (por empresa)</p>
            <p className={classes.heroSub}>
              Defina cores, logomarca, favicon e título do painel. As mudanças aplicam-se em todo o sistema.
            </p>
          </div>
          <Box flex={1} />
          <Chip size="small" icon={<PublicOutlinedIcon />} label="Aplicação global" style={{ fontWeight: 1000 }} />
        </div>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper className={classes.card} elevation={0}>
            <div className={classes.sectionTitle}>
              <BusinessOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
              Empresa e identidade
            </div>

            <Grid container spacing={2}>
              {canPickCompany ? (
                <Grid item xs={12}>
                  <FormControl fullWidth variant="outlined" size="small" className={classes.field}>
                    <InputLabel id="companyId-label">Empresa</InputLabel>
                    <Select
                      labelId="companyId-label"
                      label="Empresa"
                      value={companyId}
                      onChange={(e) => setCompanyId(Number(e.target.value))}
                    >
                      {(companies || []).map((c) => (
                        <MenuItem key={c.id} value={Number(c.id)}>
                          {c.name || `Empresa #${c.id}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ) : null}

              <Grid item xs={12} sm={6}>
                <TextField
                  className={classes.field}
                  label="Título do painel"
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={form.appTitle}
                  onChange={(e) => setForm((f) => ({ ...f, appTitle: e.target.value }))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <TitleOutlinedIcon style={{ fontSize: 18, opacity: 0.7 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  className={classes.field}
                  label="Fonte"
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={form.fontFamily}
                  onChange={(e) => setForm((f) => ({ ...f, fontFamily: e.target.value }))}
                  helperText="Ex.: Inter, sans-serif"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TrButton variant="outlined" startIcon={<CloudUploadOutlinedIcon />} component="label">
                  Enviar logo
                  <input type="file" hidden accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0], "logoUrl")} />
                </TrButton>
                {form.logoUrl ? (
                  <div style={{ marginTop: 8 }}>
                    <img alt="logo" src={form.logoUrl} className={classes.logoPreview} />
                  </div>
                ) : null}
              </Grid>

              <Grid item xs={12} sm={6}>
                <TrButton variant="outlined" startIcon={<CloudUploadOutlinedIcon />} component="label">
                  Enviar favicon
                  <input type="file" hidden accept="image/*,.ico" onChange={(e) => handleUpload(e.target.files?.[0], "faviconUrl")} />
                </TrButton>
                {form.faviconUrl ? (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    {String(form.faviconUrl)}
                  </div>
                ) : null}
              </Grid>
            </Grid>
          </Paper>

          <Box mt={2}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.sectionTitle}>
                <ColorLensOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
                Cores e layout
              </div>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    type="color"
                    label="Cor primária"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    type="color"
                    label="Cor secundária"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.secondaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    type="color"
                    label="Cor do botão"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.buttonColor}
                    onChange={(e) => setForm((f) => ({ ...f, buttonColor: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    type="color"
                    label="Cor do texto"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.textColor}
                    onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    select
                    label="Fundo"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.backgroundType}
                    onChange={(e) => setForm((f) => ({ ...f, backgroundType: e.target.value }))}
                  >
                    <MenuItem value="color">Cor sólida</MenuItem>
                    <MenuItem value="image">Imagem</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  {form.backgroundType === "image" ? (
                    <TrButton variant="outlined" startIcon={<ImageOutlinedIcon />} component="label">
                      Enviar imagem de fundo
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={(e) => handleUpload(e.target.files?.[0], "backgroundImage")}
                      />
                    </TrButton>
                  ) : (
                    <TextField
                      className={classes.field}
                      type="color"
                      label="Cor de fundo"
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={form.backgroundColor}
                      onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                    />
                  )}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography style={{ fontWeight: 1000, fontSize: 12, color: "rgba(15,23,42,0.70)" }}>
                    Raio dos cards/botões
                  </Typography>
                  <Slider
                    value={Number(form.borderRadius || 12)}
                    min={6}
                    max={20}
                    step={1}
                    onChange={(_, val) => setForm((f) => ({ ...f, borderRadius: Number(val) }))}
                    valueLabelDisplay="auto"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={String(form.sidebarVariant || "gradient") === "gradient"}
                        onChange={(e) => setForm((f) => ({ ...f, sidebarVariant: e.target.checked ? "gradient" : "solid" }))}
                        color="primary"
                      />
                    }
                    label="Menu lateral com gradiente"
                  />
                </Grid>
              </Grid>

              <div className={classes.actions}>
                <TrButton
                  className={classes.saveBtn}
                  variant="outlined"
                  startIcon={<RefreshOutlinedIcon />}
                  disabled={saving}
                  onClick={() => fetchBranding(companyId)}
                >
                  Recarregar
                </TrButton>
                <TrButton
                  className={classes.saveBtn}
                  startIcon={<SaveOutlinedIcon />}
                  disabled={saving || loading}
                  onClick={handleSave}
                >
                  {saving ? "Salvando..." : "Salvar identidade"}
                </TrButton>
              </div>
            </Paper>
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper className={classes.preview} elevation={0}>
            <div className={classes.previewTop} style={topBarStyle}>
              {form.logoUrl ? <img src={form.logoUrl} alt="logo" className={classes.logoPreview} /> : null}
              <div style={{ fontWeight: 900, fontSize: 13 }}>{form.appTitle || "TR Multichat"}</div>
              <Box flex={1} />
              <Chip size="small" label={loading ? "Carregando..." : "Pré-visualização"} style={{ fontWeight: 900 }} />
            </div>
            <div className={classes.previewBody} style={{ ...bgStyle, fontFamily: form.fontFamily }}>
              <div className={classes.previewCard} style={{ borderRadius: Number(form.borderRadius || 12) }}>
                <div style={{ fontWeight: 1000, color: form.primaryColor }}>Cards & textos</div>
                <div style={{ marginTop: 6, fontSize: 12, color: form.textColor, opacity: 0.85 }}>
                  Exemplo de conteúdo usando as cores e tipografia definidas.
                </div>
                <div style={{ marginTop: 10 }}>
                  <button
                    style={{
                      border: "none",
                      borderRadius: Number(form.borderRadius || 12),
                      padding: "10px 12px",
                      width: "100%",
                      cursor: "pointer",
                      color: "#fff",
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${form.buttonColor}, ${form.secondaryColor})`,
                    }}
                  >
                    Botão principal
                  </button>
                </div>
              </div>
            </div>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

