import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import StarsIcon from "@material-ui/icons/Stars";
import UndoIcon from "@material-ui/icons/Undo";
import PaletteIcon from "@material-ui/icons/Palette";

import { TrButton } from "../ui";
import api from "../../services/api";
import useCompanies from "../../hooks/useCompanies";
import { useThemeBranding } from "../../context/ThemeContext";
import { toast } from "react-toastify";
import { Vibrant } from "node-vibrant/browser";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: 1100,
  },
  hero: {
    borderRadius: 18,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.type === "dark" ? "0 18px 46px rgba(0,0,0,0.45)" : "0 14px 36px rgba(15, 23, 42, 0.06)",
    background: theme.palette.type === "dark"
      ? "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(59,130,246,0.10) 52%, rgba(15,23,42,0.92))"
      : "linear-gradient(135deg, rgba(16, 185, 129, 0.10), rgba(59, 130, 246, 0.08) 52%, rgba(255,255,255,0.96))",
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
    color: theme.palette.text.primary,
  },
  heroSub: {
    marginTop: 4,
    marginBottom: 0,
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  card: {
    borderRadius: 18,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.type === "dark" ? "0 18px 46px rgba(0,0,0,0.45)" : "0 14px 34px rgba(15, 23, 42, 0.05)",
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
    height: "100%",
  },
  sectionTitle: {
    fontWeight: 1000,
    fontSize: 13,
    color: theme.palette.text.primary,
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      backgroundColor: theme.palette.background.paper,
    },
  },
  preview: {
    borderRadius: 18,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.type === "dark" ? "0 18px 46px rgba(0,0,0,0.45)" : "0 16px 40px rgba(15, 23, 42, 0.06)",
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
  previewShell: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: theme.spacing(1.25),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
    },
  },
  previewSidebar: {
    borderRadius: 16,
    padding: theme.spacing(1.25),
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
  },
  previewMenuItem: {
    height: 34,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
    marginTop: 8,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    background: "rgba(255,255,255,0.85)",
    opacity: 0.9,
  },
  previewContent: {
    display: "grid",
    gap: theme.spacing(1.25),
  },
  previewCard: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    padding: theme.spacing(1.4),
    boxShadow: theme.palette.type === "dark" ? "0 16px 38px rgba(0,0,0,0.45)" : "0 10px 24px rgba(15,23,42,0.08)",
  },
  previewLoginCard: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    padding: theme.spacing(1.4),
    boxShadow: theme.palette.type === "dark" ? "0 18px 46px rgba(0,0,0,0.45)" : "0 12px 28px rgba(15,23,42,0.10)",
  },
  previewLoginField: {
    height: 34,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.default,
  },
  logoPreview: {
    height: 44,
    width: "auto",
    objectFit: "contain",
    filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.18))",
  },
  logoPreviewBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: theme.spacing(1, 1.25),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(15,23,42,0.55)" : "rgba(15,23,42,0.03)",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
    flexWrap: "wrap",
  },
  paletteRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: theme.spacing(1.25),
  },
  paletteChip: {
    fontWeight: 1000,
    borderRadius: 999,
  },
  uploadHint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.palette.text.secondary,
    lineHeight: 1.35,
    borderRadius: 14,
    padding: theme.spacing(1, 1.25),
    background: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
  },
  muted: {
    color: theme.palette.text.secondary,
  },
}));

const normalizeBranding = (b) => ({
  appTitle: b?.appTitle || "TR Multichat",
  faviconUrl: b?.faviconUrl || "/favicon.ico",
  primaryColor: b?.primaryColor || "#0B4C46",
  secondaryColor: b?.secondaryColor || "#2BA9A5",
  headingColor: b?.headingColor || b?.primaryColor || "#0B4C46",
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
  menuIconColor: b?.menuIconColor || "#FFFFFF",
  menuIconActiveColor: b?.menuIconActiveColor || b?.menuIconColor || "#FFFFFF",
});

function toAbsoluteUrlFromApi(url) {
  try {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const base = String(api?.defaults?.baseURL || "").replace(/\/+$/, "");
    const p = String(url).startsWith("/") ? url : `/${url}`;
    return base ? `${base}${p}` : url;
  } catch {
    return url;
  }
}

function normalizeHex(hex) {
  const h = String(hex || "").trim();
  if (!h) return "";
  if (h[0] !== "#") return `#${h}`;
  return h;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function relLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(rgb.r);
  const g = toLin(rgb.g);
  const b = toLin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function smartTextForBg(bgHex) {
  // Choose between near-black and white
  const black = "#111827";
  const white = "#FFFFFF";
  const cBlack = contrastRatio(bgHex, black);
  const cWhite = contrastRatio(bgHex, white);
  return cWhite >= cBlack ? white : black;
}

function clamp01(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => {
    const h = Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return h;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  const tt = clamp01(t);
  return rgbToHex({
    r: A.r + (B.r - A.r) * tt,
    g: A.g + (B.g - A.g) * tt,
    b: A.b + (B.b - A.b) * tt,
  });
}

function adjustForWhiteText(baseHex, minRatio = 4.5) {
  // Darken towards black until contrast with white meets minRatio
  const white = "#FFFFFF";
  if (contrastRatio(baseHex, white) >= minRatio) return baseHex;
  for (let t = 0.08; t <= 1; t += 0.08) {
    const darker = mixHex(baseHex, "#000000", t);
    if (contrastRatio(darker, white) >= minRatio) return darker;
  }
  return baseHex;
}

function swatchHex(sw) {
  if (!sw) return "";
  try {
    if (typeof sw.getHex === "function") return sw.getHex();
    if (typeof sw.hex === "string") return sw.hex;
  } catch {}
  return "";
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

const PREMIUM_PALETTES = [
  {
    id: "emerald",
    name: "Emerald Premium",
    primaryColor: "#0B4C46",
    secondaryColor: "#2BA9A5",
    buttonColor: "#2BA9A5",
    backgroundColor: "#F4F7F7",
    textColor: "#0F172A",
    sidebarVariant: "gradient",
  },
  {
    id: "royal",
    name: "Royal Blue",
    primaryColor: "#0B2A5B",
    secondaryColor: "#2563EB",
    buttonColor: "#2563EB",
    backgroundColor: "#F5F7FF",
    textColor: "#0F172A",
    sidebarVariant: "gradient",
  },
  {
    id: "midnight",
    name: "Midnight Dark",
    primaryColor: "#0B1220",
    secondaryColor: "#334155",
    buttonColor: "#3B82F6",
    backgroundColor: "#0B1220",
    textColor: "#E5E7EB",
    sidebarVariant: "solid",
  },
  {
    id: "luxury",
    name: "Luxury Black/Gold",
    primaryColor: "#0B0B0F",
    secondaryColor: "#D4AF37",
    buttonColor: "#D4AF37",
    backgroundColor: "#0F1115",
    textColor: "#F8FAFC",
    sidebarVariant: "solid",
  },
  {
    id: "sunset",
    name: "Sunset Coral",
    primaryColor: "#7C2D12",
    secondaryColor: "#F97316",
    buttonColor: "#F97316",
    backgroundColor: "#FFF7ED",
    textColor: "#0F172A",
    sidebarVariant: "gradient",
  },
];

const FONT_OPTIONS = [
  { id: "inter", label: "Inter (recomendado)", value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  { id: "system", label: "System UI (nativo)", value: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  { id: "roboto", label: "Roboto", value: "Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif" },
  { id: "poppins", label: "Poppins", value: "Poppins, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  { id: "montserrat", label: "Montserrat", value: "Montserrat, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  { id: "nunito", label: "Nunito", value: "Nunito, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  { id: "opensans", label: "Open Sans", value: "\"Open Sans\", Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
];

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
  const [logoPalette, setLogoPalette] = useState(null);
  const [logoPaletteLoading, setLogoPaletteLoading] = useState(false);
  const [beforeAutoPalette, setBeforeAutoPalette] = useState(null);

  // IMPORTANT: React (v16) pools events. Never read e.target.value inside setState updaters.
  const setFormKey = (key, normalize) => (e) => {
    const raw = e?.target?.value;
    const value = normalize ? normalize(raw) : raw;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const applyPaletteToForm = useCallback((palette, mode = "auto") => {
    const dark = swatchHex(palette?.DarkVibrant) || swatchHex(palette?.DarkMuted) || swatchHex(palette?.Vibrant);
    const vivid = swatchHex(palette?.Vibrant) || swatchHex(palette?.LightVibrant) || swatchHex(palette?.Muted) || dark;
    const light = swatchHex(palette?.LightMuted) || swatchHex(palette?.LightVibrant) || "";

    if (!dark && !vivid) return;

    setForm((f) => {
      if (mode === "auto" && !beforeAutoPalette) setBeforeAutoPalette(f);

      const next = { ...f };
      const primaryBase = normalizeHex(dark || next.primaryColor);
      const secondaryBase = normalizeHex(vivid || next.secondaryColor);

      next.primaryColor = adjustForWhiteText(primaryBase, 4.5);
      next.secondaryColor = secondaryBase || next.secondaryColor;
      next.buttonColor = adjustForWhiteText(normalizeHex(secondaryBase || next.buttonColor), 4.5);

      // Only adjust background when using solid color (keeps user image backgrounds intact)
      if (String(next.backgroundType || "color") !== "image") {
        const baseBg = normalizeHex(light || mixHex(secondaryBase || primaryBase, "#FFFFFF", 0.90) || next.backgroundColor);
        next.backgroundType = "color";
        next.backgroundColor = baseBg || next.backgroundColor;
      }

      // Ensure readable text on background
      if (next.backgroundColor && contrastRatio(next.backgroundColor, next.textColor) < 4.5) {
        next.textColor = smartTextForBg(next.backgroundColor);
      }

      // Keep premium layout
      next.sidebarVariant = "gradient";
      return next;
    });

    toast.success("Cores da logo aplicadas automaticamente.");
  }, [beforeAutoPalette]);

  const handleRevertPalette = () => {
    if (!beforeAutoPalette) return;
    setForm(beforeAutoPalette);
    setBeforeAutoPalette(null);
    toast.info("Cores revertidas.");
  };

  const detectPaletteFromLogoFile = useCallback(async (file) => {
    if (!file) return;
    setLogoPaletteLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const palette = await Vibrant.from(dataUrl).getPalette();
      setLogoPalette(palette || null);
      if (palette) applyPaletteToForm(palette, "auto");
    } catch (e) {
      setLogoPalette(null);
      // eslint-disable-next-line no-console
      console.error("[branding] palette detection failed", e);
      toast.error("Não foi possível detectar as cores da logo. Tente uma imagem .png/.jpg.");
    } finally {
      setLogoPaletteLoading(false);
    }
  }, [applyPaletteToForm]);

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
      // companyId=0 (sem seletor) significa "minha empresa atual"
      if (!canPickCompany || Number(companyId) === Number(currentCompanyId)) {
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

  const sidebarBg = useMemo(() => {
    const solid = `linear-gradient(180deg, ${form.primaryColor} 0%, ${form.primaryColor} 100%)`;
    const gradient = `linear-gradient(180deg, ${form.primaryColor} 0%, rgba(0,0,0,0.25) 100%)`;
    return String(form.sidebarVariant || "gradient") === "solid" ? solid : gradient;
  }, [form.primaryColor, form.sidebarVariant]);

  const topBarStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})`,
      fontFamily: form.fontFamily,
    }),
    [form.fontFamily, form.primaryColor, form.secondaryColor]
  );

  const contrastBgText = useMemo(() => contrastRatio(form.backgroundColor, form.textColor), [form.backgroundColor, form.textColor]);
  const contrastPrimaryWhite = useMemo(() => contrastRatio(form.primaryColor, "#FFFFFF"), [form.primaryColor]);
  const contrastButtonWhite = useMemo(() => contrastRatio(form.buttonColor, "#FFFFFF"), [form.buttonColor]);

  const contrastOkBgText = contrastBgText >= 4.5;
  const contrastOkPrimary = contrastPrimaryWhite >= 4.5;
  const contrastOkButton = contrastButtonWhite >= 4.5;

  const handleAutoFixContrast = () => {
    setForm((f) => {
      const next = { ...f };
      // Ensure readable text on background
      if (contrastRatio(next.backgroundColor, next.textColor) < 4.5) {
        next.textColor = smartTextForBg(next.backgroundColor);
      }
      // Ensure white text is readable on primary/button (common UI)
      if (contrastRatio(next.primaryColor, "#FFFFFF") < 4.5) {
        next.primaryColor = adjustForWhiteText(next.primaryColor, 4.5);
      }
      if (contrastRatio(next.buttonColor, "#FFFFFF") < 4.5) {
        next.buttonColor = adjustForWhiteText(next.buttonColor, 4.5);
      }
      return next;
    });
  };

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
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card} elevation={0}>
                <div className={classes.sectionTitle}>
                  <BusinessOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
                  Identidade
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

                  <Grid item xs={12}>
                    <TextField
                      className={classes.field}
                      label="Título do painel"
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={form.appTitle}
                      onChange={setFormKey("appTitle", (v) => String(v ?? ""))}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <TitleOutlinedIcon style={{ fontSize: 18, opacity: 0.7 }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      className={classes.field}
                      select
                      label="Fonte"
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={form.fontFamily}
                      onChange={setFormKey("fontFamily", (v) => String(v ?? ""))}
                      helperText="Selecione uma fonte compatível com o sistema."
                    >
                      {FONT_OPTIONS.map((opt) => (
                        <MenuItem key={opt.id} value={opt.value} style={{ fontFamily: opt.value }}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TrButton variant="outlined" startIcon={<CloudUploadOutlinedIcon />} component="label" fullWidth>
                      Enviar logo
                      <input
                        type="file"
                        hidden
                        accept="image/png,image/svg+xml,image/jpeg"
                        onChange={(e) => {
                          const file = e?.target?.files?.[0];
                          detectPaletteFromLogoFile(file);
                          handleUpload(file, "logoUrl");
                        }}
                      />
                    </TrButton>
                    <div className={classes.uploadHint}>
                      <div>
                        <strong>Logo:</strong> 240×64px
                      </div>
                      <div>
                        <strong>Ext.:</strong> .png / .svg / .jpg
                      </div>
                    </div>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TrButton variant="outlined" startIcon={<CloudUploadOutlinedIcon />} component="label" fullWidth>
                      Enviar favicon
                      <input type="file" hidden accept=".ico,image/png" onChange={(e) => handleUpload(e.target.files?.[0], "faviconUrl")} />
                    </TrButton>
                    <div className={classes.uploadHint}>
                      <div>
                        <strong>Favicon:</strong> 32×32px
                      </div>
                      <div>
                        <strong>Ext.:</strong> .ico / .png
                      </div>
                    </div>
                  </Grid>

                  {(form.logoUrl || form.faviconUrl) && (
                    <Grid item xs={12}>
                      <div className={classes.logoPreviewBox}>
                        {form.logoUrl ? (
                          <>
                            <img
                              alt="logo"
                              src={toAbsoluteUrlFromApi(form.logoUrl)}
                              className={classes.logoPreview}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 1000, fontSize: 12, marginBottom: 2 }}>
                                Logo carregada
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.78, wordBreak: "break-word" }}>
                                {String(form.logoUrl)}
                              </div>
                            </div>
                            <TrButton
                              variant="outlined"
                              size="small"
                              onClick={() =>
                                window.open(
                                  toAbsoluteUrlFromApi(form.logoUrl),
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                            >
                              Abrir
                            </TrButton>
                          </>
                        ) : null}
                        {form.faviconUrl && !form.logoUrl ? (
                          <div style={{ fontSize: 12, opacity: 0.78, wordBreak: "break-word" }}>
                            {String(form.faviconUrl)}
                          </div>
                        ) : null}
                      </div>
                    </Grid>
                  )}

                  <Grid item xs={12}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                      <PaletteIcon style={{ fontSize: 18, opacity: 0.75 }} />
                      <Typography style={{ fontWeight: 1000, fontSize: 12, color: "inherit" }}>
                        Cores detectadas da logo
                      </Typography>
                      <Box flex={1} />
                      {beforeAutoPalette ? (
                        <TrButton
                          variant="outlined"
                          size="small"
                          startIcon={<UndoIcon />}
                          onClick={handleRevertPalette}
                        >
                          Reverter
                        </TrButton>
                      ) : null}
                    </div>

                    <Typography className={classes.muted} style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}>
                      Ao enviar a logo, o sistema identifica automaticamente as cores principais e ajusta o tema da empresa para ficar padronizado.
                    </Typography>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {logoPaletteLoading ? (
                        <Chip size="small" label="Detectando cores..." style={{ fontWeight: 1000 }} />
                      ) : logoPalette ? (
                        <>
                          <Chip
                            size="small"
                            icon={<StarsIcon />}
                            label={`Primária: ${form.primaryColor}`}
                            style={{ fontWeight: 1000, background: form.primaryColor, color: "#fff" }}
                          />
                          <Chip
                            size="small"
                            label={`Secundária: ${form.secondaryColor}`}
                            style={{ fontWeight: 1000, background: form.secondaryColor, color: "#fff" }}
                          />
                          <Chip
                            size="small"
                            label={`Botão: ${form.buttonColor}`}
                            style={{ fontWeight: 1000, background: form.buttonColor, color: "#fff" }}
                          />
                          {String(form.backgroundType || "color") !== "image" ? (
                            <Chip
                              size="small"
                              label={`Fundo: ${form.backgroundColor}`}
                              style={{
                                fontWeight: 1000,
                                background: form.backgroundColor,
                                color: smartTextForBg(form.backgroundColor),
                                border: "1px solid rgba(15,23,42,0.12)",
                              }}
                            />
                          ) : (
                            <Chip size="small" label="Fundo: imagem (mantido)" style={{ fontWeight: 1000 }} />
                          )}
                        </>
                      ) : (
                        <Chip size="small" label="Envie uma logo para detectar as cores." style={{ fontWeight: 1000 }} />
                      )}
                    </div>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper className={classes.card} elevation={0}>
                <div className={classes.sectionTitle}>
                  <ColorLensOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
                  Cores e layout
                </div>

              <div className={classes.paletteRow}>
                <Typography className={classes.muted} style={{ fontWeight: 1000, fontSize: 12, marginRight: 6 }}>
                  Paletas premium
                </Typography>
                {PREMIUM_PALETTES.map((p) => (
                  <Chip
                    key={p.id}
                    className={classes.paletteChip}
                    size="small"
                    clickable
                    label={p.name}
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        primaryColor: p.primaryColor,
                        secondaryColor: p.secondaryColor,
                        buttonColor: p.buttonColor,
                        backgroundType: "color",
                        backgroundColor: p.backgroundColor,
                        textColor: p.textColor,
                        sidebarVariant: p.sidebarVariant,
                      }));
                    }}
                    style={{
                      background: `linear-gradient(135deg, ${p.primaryColor}, ${p.secondaryColor})`,
                      color: "#fff",
                    }}
                  />
                ))}
              </div>

              <div className={classes.paletteRow} style={{ marginTop: 2 }}>
                <Typography className={classes.muted} style={{ fontWeight: 1000, fontSize: 12, marginRight: 6 }}>
                  Contraste (acessibilidade)
                </Typography>
                <Chip
                  size="small"
                  label={`Texto x Fundo: ${contrastBgText.toFixed(2)}${contrastOkBgText ? " ✓" : " ⚠"}`}
                  style={{
                    fontWeight: 1000,
                    background: contrastOkBgText ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.14)",
                  }}
                />
                <Chip
                  size="small"
                  label={`AppBar x Branco: ${contrastPrimaryWhite.toFixed(2)}${contrastOkPrimary ? " ✓" : " ⚠"}`}
                  style={{
                    fontWeight: 1000,
                    background: contrastOkPrimary ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.14)",
                  }}
                />
                <Chip
                  size="small"
                  label={`Botão x Branco: ${contrastButtonWhite.toFixed(2)}${contrastOkButton ? " ✓" : " ⚠"}`}
                  style={{
                    fontWeight: 1000,
                    background: contrastOkButton ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.14)",
                  }}
                />
                {!contrastOkBgText ? (
                  <Chip
                    size="small"
                    clickable
                    label="Sugerir cor do texto"
                    onClick={() => setForm((f) => ({ ...f, textColor: smartTextForBg(f.backgroundColor) }))}
                    style={{ fontWeight: 1000, background: "rgba(59,130,246,0.12)" }}
                  />
                ) : null}
                {!contrastOkBgText || !contrastOkPrimary || !contrastOkButton ? (
                  <Chip
                    size="small"
                    clickable
                    label="Auto-ajustar contraste"
                    onClick={handleAutoFixContrast}
                    style={{ fontWeight: 1000, background: "rgba(16,185,129,0.14)" }}
                  />
                ) : null}
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
                    onChange={setFormKey("primaryColor", normalizeHex)}
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
                    onChange={setFormKey("secondaryColor", normalizeHex)}
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
                    onChange={setFormKey("buttonColor", normalizeHex)}
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
                    onChange={setFormKey("textColor", normalizeHex)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    type="color"
                    label="Títulos e destaques (Indicadores/Rankings)"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.headingColor}
                    onChange={setFormKey("headingColor", normalizeHex)}
                    helperText="Cor dos títulos de seções e cabeçalhos (não interfere na cor primária do sistema)."
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
                    onChange={setFormKey("backgroundType", (v) => String(v ?? ""))}
                  >
                    <MenuItem value="color">Cor sólida</MenuItem>
                    <MenuItem value="image">Imagem</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  {form.backgroundType === "image" ? (
                    <TrButton variant="outlined" startIcon={<ImageOutlinedIcon />} component="label" fullWidth>
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
                      onChange={setFormKey("backgroundColor", normalizeHex)}
                    />
                  )}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    type="color"
                    label="Ícones do menu (normal)"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.menuIconColor}
                    onChange={setFormKey("menuIconColor", normalizeHex)}
                    helperText="Cor padrão dos ícones no menu lateral."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    type="color"
                    label="Ícones do menu (ativo)"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={form.menuIconActiveColor}
                    onChange={setFormKey("menuIconActiveColor", normalizeHex)}
                    helperText="Cor do ícone do item selecionado."
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography className={classes.muted} style={{ fontWeight: 1000, fontSize: 12 }}>
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
                        onChange={(e) => {
                          const checked = Boolean(e?.target?.checked);
                          setForm((f) => ({ ...f, sidebarVariant: checked ? "gradient" : "solid" }));
                        }}
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
            </Grid>
          </Grid>
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
              <div className={classes.previewShell}>
                <div className={classes.previewSidebar} style={{ background: sidebarBg, borderRadius: Number(form.borderRadius || 12) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.14)" }} />
                    <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.95 }}>Menu</div>
                  </div>
                  <div className={classes.previewMenuItem}>
                    <span className={classes.previewDot} /> Atendimento
                  </div>
                  <div className={classes.previewMenuItem} style={{ opacity: 0.92 }}>
                    <span className={classes.previewDot} style={{ opacity: 0.7 }} /> Chat - Interno
                  </div>
                  <div className={classes.previewMenuItem} style={{ opacity: 0.86 }}>
                    <span className={classes.previewDot} style={{ opacity: 0.6 }} /> Configurações
                  </div>
                </div>

                <div className={classes.previewContent}>
                  <div className={classes.previewCard} style={{ borderRadius: Number(form.borderRadius || 12) }}>
                    <div style={{ fontWeight: 1000, color: form.primaryColor }}>Cards & textos</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: form.textColor, opacity: 0.88 }}>
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

                  <div className={classes.previewLoginCard} style={{ borderRadius: Number(form.borderRadius || 12) }}>
                    <div style={{ fontWeight: 1000, color: form.primaryColor }}>Tela de login (preview)</div>
                    <div style={{ marginTop: 6, display: "grid", gap: 8 }}>
                      <div className={classes.previewLoginField} />
                      <div className={classes.previewLoginField} />
                      <button
                        style={{
                          border: "none",
                          borderRadius: Number(form.borderRadius || 12),
                          padding: "10px 12px",
                          width: "100%",
                          cursor: "pointer",
                          color: "#fff",
                          fontWeight: 900,
                          background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})`,
                        }}
                      >
                        Entrar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

