import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";
import SearchIcon from "@material-ui/icons/Search";
import YouTubeIcon from "@material-ui/icons/YouTube";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";
import ImageOutlinedIcon from "@material-ui/icons/ImageOutlined";
import CloudUploadOutlinedIcon from "@material-ui/icons/CloudUploadOutlined";
import LinkOutlinedIcon from "@material-ui/icons/LinkOutlined";
import { makeStyles } from "@material-ui/core/styles";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";

import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import ButtonWithSpinner from "../../../components/ButtonWithSpinner";
import ConfirmationModal from "../../../components/ConfirmationModal";
import useHelps from "../../../hooks/useHelps";
import { AuthContext } from "../../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  pageIntro: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  headerSub: { opacity: 0.85, marginTop: theme.spacing(0.5) },
  grid: { alignItems: "stretch" },
  card: { borderRadius: 14 },
  softCard: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.01)",
  },
  scrollArea: {
    // Evita scroll aninhado (MainContainer já tem overflowY: auto).
    // Isso corrige "scroll travado" especialmente no mobile.
    paddingBottom: theme.spacing(2),
  },
  formContent: {
    // No mobile, o formulário pode ficar mais alto que a viewport e precisa rolar
    // sem depender de scroll aninhado de containers pais.
    [theme.breakpoints.down("sm")]: {
      maxHeight: "calc(100vh - 220px)",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    },
  },
  cardHeader: {
    paddingBottom: theme.spacing(1),
  },
  formActions: {
    display: "flex",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
  },
  previewWrap: {
    marginTop: theme.spacing(2),
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },
  iframe: {
    width: "100%",
    height: 240,
    border: 0,
    display: "block",
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) 180px 180px 180px",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },
  cardsGrid: {
    marginTop: theme.spacing(1),
  },
  helpCard: {
    height: "100%",
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: theme.shadows[4],
      borderColor: theme.palette.primary.main,
    },
  },
  helpCardBody: {
    padding: theme.spacing(2),
  },
  thumb: {
    position: "relative",
    width: "100%",
    height: 140,
    background: theme.palette.type === "dark" ? "#0f172a" : "#f3f4f6",
    overflow: "hidden",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(to bottom, rgba(0,0,0,0.10), rgba(0,0,0,0.45))",
    pointerEvents: "none",
  },
  playIcon: {
    fontSize: 54,
    color: "rgba(255,255,255,0.92)",
    filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.35))",
  },
  placeholderIcon: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  helpTitleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  helpTitle: { fontWeight: 800, lineHeight: 1.2 },
  helpDesc: {
    marginTop: theme.spacing(1),
    opacity: 0.9,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  helpMeta: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(1.5),
  },
  helpActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.25, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(0,0,0,0.02)",
  },
  iconBtn: {
    borderRadius: 10,
  },
  uploadRow: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: theme.spacing(1.5),
  },
  fileName: {
    opacity: 0.75,
    maxWidth: 260,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  emptyWrap: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  emptyIcon: {
    fontSize: 44,
    opacity: 0.35,
    marginBottom: theme.spacing(1),
  },
  badgeYes: { backgroundColor: theme.palette.primary.main, color: "#fff", fontWeight: 800 },
  badgeNo: { backgroundColor: theme.palette.grey[600], color: "#fff", fontWeight: 800 },
}));

function normalizeText(v) {
  return String(v || "").trim();
}

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function extractYouTubeId(inputRaw) {
  const input = normalizeText(inputRaw);
  if (!input) return "";
  if (YT_ID_RE.test(input)) return input;

  const normalized = input.startsWith("http://") || input.startsWith("https://")
    ? input
    : `https://${input.replace(/^\/+/, "")}`;

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = normalizeText((url.pathname || "").split("/").filter(Boolean)[0] || "");
      return YT_ID_RE.test(id) ? id : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = normalizeText(url.searchParams.get("v"));
      if (YT_ID_RE.test(v)) return v;

      const path = url.pathname || "";
      const patterns = [
        /\/embed\/([a-zA-Z0-9_-]{11})/i,
        /\/shorts\/([a-zA-Z0-9_-]{11})/i,
        /\/live\/([a-zA-Z0-9_-]{11})/i,
        /\/v\/([a-zA-Z0-9_-]{11})/i,
      ];
      for (const re of patterns) {
        const m = path.match(re);
        if (m?.[1] && YT_ID_RE.test(m[1])) return m[1];
      }
    }

    const generic = normalized.match(/(?:[?&]v=|\/(?:embed|shorts|live|v)\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return generic?.[1] && YT_ID_RE.test(generic[1]) ? generic[1] : "";
  } catch {
    const fallback = input.match(/(?:[?&]v=|\/(?:embed|shorts|live|v)\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return fallback?.[1] && YT_ID_RE.test(fallback[1]) ? fallback[1] : "";
  }
}

function parseYouTube(inputRaw) {
  const input = normalizeText(inputRaw);
  if (!input) return { id: "", error: "", externalUrl: "", type: "none", embedUrl: "" };
  const lower = input.toLowerCase();

  if (lower.includes("instagram.com")) {
    try {
      const normalized = input.startsWith("http://") || input.startsWith("https://")
        ? input
        : `https://${input.replace(/^\/+/, "")}`;
      const url = new URL(normalized);
      const path = url.pathname || "/";
      const match = path.match(/\/(reel|p|tv)\/([^/]+)/i);
      const embedUrl = match?.[1] && match?.[2]
        ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`
        : `https://www.instagram.com${path.endsWith("/") ? path : `${path}/`}embed/captioned/`;
      return { id: "", error: "", externalUrl: normalized, type: "instagram", embedUrl };
    } catch {
      return { id: "", error: "URL do Instagram inválida.", externalUrl: "", type: "invalid", embedUrl: "" };
    }
  }

  // ID direto
  if (!input.includes("http") && !input.includes("/") && !input.includes("?")) {
    const idOnly = input;
    if (YT_ID_RE.test(idOnly)) {
      return {
        id: idOnly,
        error: "",
        externalUrl: "",
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${idOnly}`,
      };
    }
    return {
      id: "",
      error: "Informe uma URL válida do YouTube/Instagram ou um ID do YouTube (11 caracteres).",
      externalUrl: "",
      type: "invalid",
      embedUrl: "",
    };
  }

  // Try parsing URL variants (watch, youtu.be, embed, shorts, live, v)
  try {
    const extracted = extractYouTubeId(input);
    if (extracted) {
      return {
        id: extracted,
        error: "",
        externalUrl: "",
        type: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${extracted}?rel=0&modestbranding=1`,
      };
    }

    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host.endsWith("instagram.com")) {
      const path = url.pathname || "/";
      const match = path.match(/\/(reel|p|tv)\/([^/]+)/i);
      const embedUrl = match?.[1] && match?.[2]
        ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`
        : `https://www.instagram.com${path.endsWith("/") ? path : `${path}/`}embed/captioned/`;
      return { id: "", error: "", externalUrl: input, type: "instagram", embedUrl };
    }
    return { id: "", error: "", externalUrl: input, type: "external", embedUrl: input };
  } catch {
    // ignore
  }

  // Last resort: find v=... substring
  const match = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (match?.[1]) {
    return {
      id: match[1],
      error: "",
      externalUrl: "",
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0&modestbranding=1`,
    };
  }

  return { id: "", error: "URL/ID inválido. Use YouTube ou Instagram.", externalUrl: "", type: "invalid", embedUrl: "" };
}

function resolveApiBaseUrl() {
  const resolvedEnvBase =
    process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE_URL;
  if (resolvedEnvBase) return String(resolvedEnvBase).replace(/\/$/, "");
  if (typeof window !== "undefined" && /app\.trmultichat\.com\.br$/i.test(window.location.host)) {
    return "https://api.trmultichat.com.br";
  }
  return "http://localhost:4004";
}

function resolveAssetUrl(urlRaw) {
  const url = normalizeText(urlRaw);
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = resolveApiBaseUrl();
  return base + (url.startsWith("/") ? url : "/" + url);
}

function parseAttachmentLinks(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeText(item)).filter(Boolean);
  }
  const value = normalizeText(raw);
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeText(item)).filter(Boolean);
      }
    } catch (_) {}
  }
  return [value];
}

function HelpListSkeleton() {
  return (
    <div style={{ padding: 16 }}>
      <Skeleton variant="rect" height={36} style={{ borderRadius: 10, marginBottom: 12 }} />
      <Skeleton variant="rect" height={36} style={{ borderRadius: 10, marginBottom: 12 }} />
      <Skeleton variant="rect" height={240} style={{ borderRadius: 12 }} />
    </div>
  );
}

const schema = Yup.object().shape({
  title: Yup.string().trim().required("Título é obrigatório"),
  description: Yup.string().trim().required("Descrição é obrigatória").max(1000, "Máximo de 1000 caracteres"),
  videoUrl: Yup.string()
    .nullable()
    .test("youtube", "URL/ID inválido. Use YouTube ou Instagram.", (value) => {
      const v = normalizeText(value);
      if (!v) return true;
      return !parseYouTube(v).error;
    }),
  category: Yup.string().nullable(),
  imageLink: Yup.string()
    .nullable()
    .test("url", "Link de imagem inválido.", (value) => {
      const v = normalizeText(value);
      if (!v) return true;
      // allow relative (/uploads/...) and absolute URLs
      if (v.startsWith("/")) return true;
      try {
        // eslint-disable-next-line no-new
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }),
});

export default function HelpsAdmin() {
  const classes = useStyles();
  const { list, save, update, remove } = useHelps();
  const { user } = useContext(AuthContext);
  const history = useHistory();

  const titleRef = useRef(null);
  const fileInputRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const [query, setQuery] = useState("");
  const [videoFilter, setVideoFilter] = useState("all"); // all|with|without
  const [sortBy, setSortBy] = useState("recent"); // recent|az
  const [categoryFilter, setCategoryFilter] = useState("all"); // all|<value>
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categoryUnsupported, setCategoryUnsupported] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const isEditing = Boolean(editingItem?.id);
  const editingAttachments = useMemo(
    () => parseAttachmentLinks(editingItem?.link),
    [editingItem]
  );

  // Guard simples: rota /admin/helps deve ser só para admin/super (padrão do painel)
  useEffect(() => {
    const email = String(user?.email || "").toLowerCase();
    const isMasterEmail = email === "thercio@trtecnologias.com.br";
    const ok = Boolean(user?.admin || user?.super || isMasterEmail || user?.profile === "admin");
    if (user && !ok) history.replace("/");
  }, [history, user]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: editingItem?.title || "",
      description: editingItem?.description || "",
      videoUrl: editingItem?.video ? String(editingItem.video) : "",
      category: editingItem?.category || editingItem?.categoria || editingItem?.tag || "",
      imageLink: "",
    },
    validationSchema: schema,
    onSubmit: async (values, helpers) => {
      setSaving(true);
      try {
        const parsed = parseYouTube(values.videoUrl);
        const videoId = parsed.id;
        const videoValue = videoId || normalizeText(values.videoUrl);
        const basePayload = {
          title: normalizeText(values.title),
          description: normalizeText(values.description),
          video: videoValue || "",
          // Campo opcional: só persiste se o backend suportar (se não, ele será ignorado).
          category: normalizeText(values.category) || undefined,
          link: normalizeText(values.imageLink) || undefined,
        };

        async function persist(payload) {
          // If image file is provided, we must use multipart/form-data.
          if (imageFile) {
            const form = new FormData();
            Object.entries(payload || {}).forEach(([k, v]) => {
              if (v === undefined || v === null) return;
              form.append(k, String(v));
            });
            form.append("image", imageFile);
            if (isEditing) {
              form.append("id", String(editingItem.id));
              return await update(Object.assign(form, { id: editingItem.id }));
            }
            return await save(form);
          }
          if (isEditing) return await update({ id: editingItem.id, ...payload });
          return await save(payload);
        }

        let resp;
        try {
          resp = await persist(basePayload);
        } catch (e) {
          // Fallback seguro: se o backend rejeitar "category", tenta de novo sem ela
          if (basePayload.category) {
            try {
              const retryPayload = { ...basePayload };
              delete retryPayload.category;
              resp = await persist(retryPayload);
              setCategoryUnsupported(true);
              toast.info("Categoria não foi salva (servidor ainda não suporta esse campo).");
            } catch (e2) {
              throw e2;
            }
          } else {
            throw e;
          }
        }

        toast.success(isEditing ? "Ajuda atualizada com sucesso!" : "Ajuda criada com sucesso!");
        if (basePayload.category && resp && !resp?.category && !resp?.categoria && !resp?.tag) {
          setCategoryUnsupported(true);
          toast.info("Categoria não foi salva (servidor ainda não suporta esse campo).");
        }

        helpers.resetForm();
        setEditingItem(null);
        setImageFile(null);
        setImagePreviewUrl("");
        await reload();
      } catch (e) {
        const status = e?.response?.status;
        if (status === 403) {
          toast.error("Sem permissão para criar/editar conteúdos de ajuda (apenas admin/super).");
        } else {
          toast.error("Não foi possível salvar. Verifique os campos e tente novamente.");
        }
      } finally {
        setSaving(false);
      }
    },
  });

  const videoParsed = useMemo(() => parseYouTube(formik.values.videoUrl), [formik.values.videoUrl]);
  const videoId = videoParsed.id;
  const videoExternalUrl = videoParsed.externalUrl || "";
  const videoEmbedUrl = videoParsed.embedUrl || "";
  const imageLink = normalizeText(formik.values.imageLink);
  const viewAttachments = useMemo(
    () => parseAttachmentLinks(viewItem?.link),
    [viewItem]
  );

  const setFile = (file) => {
    try {
      if (imagePreviewUrl?.startsWith?.("blob:")) URL.revokeObjectURL(imagePreviewUrl);
    } catch (_) {}
    if (!file) {
      setImageFile(null);
      setImagePreviewUrl("");
      return;
    }
    setImageFile(file);
    try {
      setImagePreviewUrl(URL.createObjectURL(file));
    } catch {
      setImagePreviewUrl("");
    }
  };

  const reload = async () => {
    setLoadingList(true);
    try {
      const data = await list();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Não foi possível carregar os conteúdos de ajuda.");
      setRecords([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryKey = useMemo(() => {
    const keys = ["category", "categoria", "tag"];
    for (const k of keys) {
      if (records.some((r) => normalizeText(r?.[k]))) return k;
    }
    return null;
  }, [records]);

  const categories = useMemo(() => {
    if (!categoryKey) return [];
    const set = new Set();
    records.forEach((r) => {
      const v = normalizeText(r?.[categoryKey]);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [categoryKey, records]);

  const filtered = useMemo(() => {
    const q = normalizeText(query).toLowerCase();
    const base = records.filter((r) => {
      const hasVideo = Boolean(normalizeText(r.video));
      const okVideo =
        videoFilter === "all" ||
        (videoFilter === "with" && hasVideo) ||
        (videoFilter === "without" && !hasVideo);
      const okText =
        !q ||
        String(r.title || "").toLowerCase().includes(q) ||
        String(r.description || "").toLowerCase().includes(q) ||
        parseAttachmentLinks(r.link).join(" ").toLowerCase().includes(q);
      const okCategory =
        !categoryKey ||
        categoryFilter === "all" ||
        normalizeText(r?.[categoryKey]) === categoryFilter;
      return okVideo && okText && okCategory;
    });

    const sorted = [...base].sort((a, b) => {
      if (sortBy === "az") return String(a.title || "").localeCompare(String(b.title || ""));
      const aT = new Date(a.updatedAt || a.createdAt || 0).getTime() || Number(a.id || 0);
      const bT = new Date(b.updatedAt || b.createdAt || 0).getTime() || Number(b.id || 0);
      return bT - aT;
    });
    return sorted;
  }, [records, query, videoFilter, sortBy, categoryFilter, categoryKey]);

  useEffect(() => {
    setPage(1);
  }, [query, videoFilter, sortBy, categoryFilter]);

  const openView = (item) => {
    setViewItem(item);
    setViewOpen(true);
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setFile(null);
    setTimeout(() => titleRef.current?.focus?.(), 50);
  };

  const resetForm = () => {
    setEditingItem(null);
    formik.resetForm();
    setFile(null);
    setTimeout(() => titleRef.current?.focus?.(), 50);
  };

  const askDelete = (item) => {
    setDeleteTarget(item);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setSaving(true);
    try {
      await remove(deleteTarget.id);
      toast.success("Conteúdo removido com sucesso!");
      setConfirmOpen(false);
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) {
        toast.error("Sem permissão para excluir conteúdos de ajuda (apenas admin/super).");
      } else {
        toast.error("Não foi possível excluir o conteúdo.");
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, pageSize, safePage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const isEmpty = !loadingList && filtered.length === 0;

  return (
    <MainContainer>
      <MainHeader>
        <div className={classes.pageIntro}>
          <Title>Ajuda (Administração)</Title>
          <Typography variant="body2" style={{ opacity: 0.75 }}>
            {filtered.length} item(ns)
          </Typography>
        </div>
      </MainHeader>

      <div className={classes.scrollArea}>
        <Typography variant="body2" className={classes.headerSub}>
          Crie e mantenha conteúdos de ajuda (título, descrição, vídeo e anexos).
        </Typography>

        <Grid container spacing={2} className={classes.grid} style={{ marginTop: 8 }}>
          {/* Form */}
          <Grid item xs={12} md={5}>
            <Card className={`${classes.card} ${classes.softCard}`} elevation={0}>
              <CardHeader
                className={classes.cardHeader}
                title={isEditing ? "Editar Ajuda" : "Criar Ajuda"}
                subheader={isEditing ? "Atualize o conteúdo selecionado." : "Cadastre um novo conteúdo de ajuda."}
              />
              <CardContent className={classes.formContent}>
                <form onSubmit={formik.handleSubmit}>
                  <TextField
                    inputRef={titleRef}
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Título *"
                    name="title"
                    value={formik.values.title}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={Boolean(formik.touched.title && formik.errors.title)}
                    helperText={formik.touched.title && formik.errors.title ? formik.errors.title : " "}
                    placeholder="Ex.: Como conectar WhatsApp"
                  />

                  <TextField
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Categoria (opcional)"
                    name="category"
                    value={formik.values.category}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={Boolean(formik.touched.category && formik.errors.category)}
                    helperText={
                      formik.touched.category && formik.errors.category
                        ? formik.errors.category
                        : categoryUnsupported
                          ? "Seu servidor ainda não suporta categoria (campo não será salvo)."
                          : "Opcional. Será salva apenas se o servidor suportar."
                    }
                    placeholder="Ex.: Conexões, Usuários, Atendimento..."
                  />

                  <TextField
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Vídeo (YouTube/Instagram) – URL ou ID"
                    name="videoUrl"
                    value={formik.values.videoUrl}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={Boolean(formik.touched.videoUrl && formik.errors.videoUrl)}
                    helperText={
                      formik.touched.videoUrl && formik.errors.videoUrl
                        ? formik.errors.videoUrl
                        : videoId
                          ? "Preview disponível abaixo."
                          : "Cole URL do YouTube/Instagram ou ID do YouTube."
                    }
                    placeholder="https://youtube.com/... ou https://instagram.com/... ou ID"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <YouTubeIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Imagem (link opcional)"
                    name="imageLink"
                    value={formik.values.imageLink}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={Boolean(formik.touched.imageLink && formik.errors.imageLink)}
                    helperText={
                      formik.touched.imageLink && formik.errors.imageLink
                        ? formik.errors.imageLink
                        : "Opcional. Use um link (https://...) ou deixe vazio e envie um arquivo."
                    }
                    placeholder="https://... ou /uploads/helps/..."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkOutlinedIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e?.target?.files?.[0] || null;
                      setFile(f);
                    }}
                  />
                  <div className={classes.uploadRow}>
                    <ButtonWithSpinner
                      variant="outlined"
                      onClick={() => fileInputRef.current?.click?.()}
                      loading={saving}
                    >
                      <CloudUploadOutlinedIcon style={{ marginRight: 8 }} />
                      Anexar arquivo
                    </ButtonWithSpinner>
                    {imageFile ? (
                      <>
                        <Typography variant="caption" className={classes.fileName}>
                          {imageFile.name}
                        </Typography>
                        <ButtonWithSpinner
                          variant="text"
                          onClick={() => {
                            setFile(null);
                            try {
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            } catch (_) {}
                          }}
                          loading={saving}
                        >
                          Remover
                        </ButtonWithSpinner>
                      </>
                    ) : (
                      <Typography variant="caption" className={classes.fileName}>
                        Nenhum arquivo selecionado
                      </Typography>
                    )}
                  </div>
                  {isEditing && editingAttachments.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {editingAttachments.map((_, index) => (
                        <Chip key={`edit-attachment-${index}`} size="small" label={`Anexo atual ${index + 1}`} />
                      ))}
                    </div>
                  ) : null}

                  {videoId || videoExternalUrl || imagePreviewUrl || imageLink ? (
                    <div className={classes.previewWrap} aria-label="Preview do conteúdo">
                      {videoEmbedUrl ? (
                        <iframe
                          className={classes.iframe}
                          title="Preview do vídeo"
                          src={videoEmbedUrl}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : videoExternalUrl ? (
                        <div style={{ padding: 14 }}>
                          <Typography variant="body2" style={{ marginBottom: 10 }}>
                            Link de vídeo detectado:
                          </Typography>
                          <a href={videoExternalUrl} target="_blank" rel="noreferrer">
                            {videoExternalUrl}
                          </a>
                        </div>
                      ) : (
                        <img
                          alt="Preview da imagem"
                          className={classes.thumbImg}
                          style={{ height: 240 }}
                          src={imagePreviewUrl || resolveAssetUrl(imageLink)}
                        />
                      )}
                    </div>
                  ) : null}

                  <TextField
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Descrição *"
                    name="description"
                    value={formik.values.description}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={Boolean(formik.touched.description && formik.errors.description)}
                    helperText={
                      formik.touched.description && formik.errors.description
                        ? formik.errors.description
                        : `${String(formik.values.description || "").length}/1000`
                    }
                    placeholder="Descreva o passo a passo..."
                    multiline
                    rows={5}
                  />

                  <div className={classes.formActions}>
                    {isEditing ? (
                      <>
                        <ButtonWithSpinner
                          type="submit"
                          variant="contained"
                          color="primary"
                          loading={saving}
                        >
                          Atualizar
                        </ButtonWithSpinner>
                        <ButtonWithSpinner
                          variant="outlined"
                          onClick={resetForm}
                          loading={saving}
                        >
                          Cancelar
                        </ButtonWithSpinner>
                      </>
                    ) : (
                      <>
                        <ButtonWithSpinner
                          type="submit"
                          variant="contained"
                          color="primary"
                          loading={saving}
                        >
                          Salvar
                        </ButtonWithSpinner>
                        <ButtonWithSpinner
                          variant="outlined"
                          onClick={() => formik.resetForm()}
                          loading={saving}
                        >
                          Limpar
                        </ButtonWithSpinner>
                      </>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </Grid>

          {/* List */}
          <Grid item xs={12} md={7}>
            <Card className={`${classes.card} ${classes.softCard}`} elevation={0}>
              <CardHeader
                className={classes.cardHeader}
                title="Conteúdos cadastrados"
                subheader="Busque, filtre e gerencie seus cards de ajuda."
              />
              <CardContent>
                <div className={classes.toolbar}>
                  <TextField
                    variant="outlined"
                    size="small"
                    label="Buscar"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Título ou descrição"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <FormControl variant="outlined" size="small">
                    <InputLabel id="video-filter-label">Vídeo</InputLabel>
                    <Select
                      labelId="video-filter-label"
                      value={videoFilter}
                      onChange={(e) => setVideoFilter(e.target.value)}
                      label="Vídeo"
                    >
                      <MenuItem value="all">Todos</MenuItem>
                      <MenuItem value="with">Com vídeo</MenuItem>
                      <MenuItem value="without">Sem vídeo</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl variant="outlined" size="small">
                    <InputLabel id="sort-label">Ordenação</InputLabel>
                    <Select
                      labelId="sort-label"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      label="Ordenação"
                    >
                      <MenuItem value="recent">Mais recente</MenuItem>
                      <MenuItem value="az">A–Z</MenuItem>
                    </Select>
                  </FormControl>
                  {categories.length > 0 ? (
                    <FormControl variant="outlined" size="small">
                      <InputLabel id="category-filter-label">Categoria</InputLabel>
                      <Select
                        labelId="category-filter-label"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        label="Categoria"
                      >
                        <MenuItem value="all">Todas</MenuItem>
                        {categories.map((c) => (
                          <MenuItem key={c} value={c}>
                            {c}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <div />
                  )}
                </div>

              {loadingList ? (
                <HelpListSkeleton />
              ) : isEmpty ? (
                <div className={classes.emptyWrap}>
                  <YouTubeIcon className={classes.emptyIcon} />
                  <Typography variant="h6" style={{ fontWeight: 800 }}>
                    Nenhum conteúdo de ajuda cadastrado ainda.
                  </Typography>
                  <Typography variant="body2" style={{ marginTop: 6 }}>
                    Crie o primeiro conteúdo para orientar seus usuários.
                  </Typography>
                  <div style={{ marginTop: 14 }}>
                    <ButtonWithSpinner
                      variant="contained"
                      color="primary"
                      onClick={() => titleRef.current?.focus?.()}
                    >
                      Criar primeiro conteúdo
                    </ButtonWithSpinner>
                  </div>
                </div>
              ) : (
                <>
                  <Grid container spacing={2} className={classes.cardsGrid}>
                    {pageItems.map((row) => {
                      const rawVideo = normalizeText(row.video);
                      const parsedVideo = parseYouTube(rawVideo);
                      const hasVideo = Boolean(rawVideo);
                      const videoThumbId = parsedVideo.id;
                      const firstAttachment = parseAttachmentLinks(row.link)[0] || "";
                      const thumbUrl = videoThumbId
                        ? `https://img.youtube.com/vi/${videoThumbId}/mqdefault.jpg`
                        : normalizeText(firstAttachment)
                          ? resolveAssetUrl(firstAttachment)
                          : "";
                      const categoryValue = normalizeText(row?.[categoryKey]) || "";
                      const dateStr = row?.updatedAt || row?.createdAt || "";
                      const when = dateStr ? new Date(dateStr) : null;
                      const whenLabel =
                        when && !Number.isNaN(when.getTime())
                          ? when.toLocaleDateString("pt-BR")
                          : "";

                      return (
                        <Grid item xs={12} sm={6} key={row.id}>
                          <Card className={classes.helpCard} elevation={0}>
                            <div className={classes.thumb}>
                              {thumbUrl ? (
                                <img className={classes.thumbImg} src={thumbUrl} alt="Capa" />
                              ) : (
                                <div className={classes.placeholderIcon}>
                                  <ImageOutlinedIcon />
                                </div>
                              )}
                              {hasVideo ? (
                                <div className={classes.thumbOverlay}>
                                  <PlayCircleFilledWhiteIcon className={classes.playIcon} />
                                </div>
                              ) : null}
                            </div>
                            <div className={classes.helpCardBody}>
                              <div className={classes.helpTitleRow}>
                                <Typography variant="subtitle1" className={classes.helpTitle}>
                                  {row.title || "-"}
                                </Typography>
                                <Chip
                                  size="small"
                                  className={hasVideo ? classes.badgeYes : classes.badgeNo}
                                  label={hasVideo ? (videoThumbId ? "Vídeo" : "Link vídeo") : "Imagem/Texto"}
                                />
                              </div>

                              {row.description ? (
                                <Typography variant="body2" className={classes.helpDesc}>
                                  {row.description}
                                </Typography>
                              ) : (
                                <Typography variant="body2" className={classes.helpDesc} style={{ opacity: 0.7 }}>
                                  Sem descrição.
                                </Typography>
                              )}

                              <div className={classes.helpMeta}>
                                {categoryValue ? (
                                  <Chip size="small" variant="outlined" label={categoryValue} />
                                ) : null}
                                {whenLabel ? (
                                  <Typography variant="caption" style={{ opacity: 0.75 }}>
                                    Atualizado: {whenLabel}
                                  </Typography>
                                ) : null}
                              </div>
                            </div>

                            <div className={classes.helpActions}>
                              <Tooltip title="Ver">
                                <IconButton className={classes.iconBtn} aria-label={`Ver ${row.title}`} onClick={() => openView(row)} size="small" color="primary">
                                  <VisibilityOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar">
                                <IconButton className={classes.iconBtn} aria-label={`Editar ${row.title}`} onClick={() => startEdit(row)} size="small" color="primary">
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Excluir">
                                <IconButton className={classes.iconBtn} aria-label={`Excluir ${row.title}`} onClick={() => askDelete(row)} size="small" style={{ color: "#d32f2f" }}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </div>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 12,
                      borderTop: "1px solid rgba(0,0,0,0.08)",
                      gap: 12,
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ButtonWithSpinner
                        variant="outlined"
                        disabled={saving || safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </ButtonWithSpinner>
                      <Typography variant="body2" style={{ opacity: 0.85 }}>
                        Página {safePage} de {totalPages}
                      </Typography>
                      <ButtonWithSpinner
                        variant="outlined"
                        disabled={saving || safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Próximo
                      </ButtonWithSpinner>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Typography variant="body2" style={{ opacity: 0.85 }}>
                        Itens por página:
                      </Typography>
                      <FormControl variant="outlined" size="small">
                        <Select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          disabled={saving}
                        >
                          <MenuItem value={10}>10</MenuItem>
                          <MenuItem value={20}>20</MenuItem>
                          <MenuItem value={50}>50</MenuItem>
                        </Select>
                      </FormControl>
                    </div>
                  </div>
                </>
              )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </div>

      {/* View dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{viewItem?.title || "Conteúdo"}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
            {viewItem?.description || "-"}
          </Typography>
          {parseYouTube(viewItem?.video).embedUrl ? (
            <div className={classes.previewWrap} style={{ marginTop: 16 }}>
              <iframe
                className={classes.iframe}
                title="Preview do vídeo"
                src={parseYouTube(viewItem?.video).embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : parseYouTube(viewItem?.video).externalUrl ? (
            <div style={{ marginTop: 14 }}>
              <a href={parseYouTube(viewItem?.video).externalUrl} target="_blank" rel="noreferrer">
                Abrir vídeo
              </a>
            </div>
          ) : null}
          {viewAttachments.length ? (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {viewAttachments.map((raw, index) => (
                <a key={`${raw}-${index}`} href={resolveAssetUrl(raw)} target="_blank" rel="noopener noreferrer">
                  {viewAttachments.length > 1 ? `Abrir/Baixar anexo ${index + 1}` : "Abrir/Baixar anexo"}
                </a>
              ))}
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <ButtonWithSpinner variant="outlined" onClick={() => setViewOpen(false)}>
            Fechar
          </ButtonWithSpinner>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmationModal
        title="Excluir conteúdo"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
      >
        Tem certeza que deseja excluir este conteúdo?
      </ConfirmationModal>
    </MainContainer>
  );
}


