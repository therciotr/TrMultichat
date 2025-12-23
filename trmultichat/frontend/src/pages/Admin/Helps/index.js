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
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";
import SearchIcon from "@material-ui/icons/Search";
import YouTubeIcon from "@material-ui/icons/YouTube";
import VisibilityIcon from "@material-ui/icons/Visibility";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";
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
  headerSub: { opacity: 0.85, marginTop: theme.spacing(0.5) },
  grid: { alignItems: "stretch" },
  card: { borderRadius: 14 },
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
  tableContainer: {
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
  },
  descCell: {
    maxWidth: 420,
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
  badgeYes: { backgroundColor: "#2e7d32", color: "#fff", fontWeight: 700 },
  badgeNo: { backgroundColor: "#9e9e9e", color: "#fff", fontWeight: 700 },
}));

function normalizeText(v) {
  return String(v || "").trim();
}

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function parseYouTube(inputRaw) {
  const input = normalizeText(inputRaw);
  if (!input) return { id: "", error: "" };

  // ID direto
  if (!input.includes("http") && !input.includes("/") && !input.includes("?")) {
    const idOnly = input;
    if (YT_ID_RE.test(idOnly)) return { id: idOnly, error: "" };
    return { id: "", error: "Informe uma URL do YouTube ou um ID válido (11 caracteres)." };
  }

  // Try parsing URL variants (watch, youtu.be, embed, shorts)
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = normalizeText(url.pathname.replace("/", ""));
      if (YT_ID_RE.test(id)) return { id, error: "" };
      return { id: "", error: "Link do YouTube inválido." };
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && YT_ID_RE.test(v)) return { id: v, error: "" };
      // /embed/{id}
      const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed && embed[1]) return { id: embed[1], error: "" };
      // /shorts/{id}
      const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shorts && shorts[1]) return { id: shorts[1], error: "" };
    }
  } catch {
    // ignore
  }

  // Last resort: find v=... substring
  const match = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (match?.[1]) return { id: match[1], error: "" };

  return { id: "", error: "URL/ID do YouTube inválido." };
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
    .test("youtube", "URL/ID do YouTube inválido.", (value) => {
      const v = normalizeText(value);
      if (!v) return true;
      return Boolean(parseYouTube(v).id);
    }),
  category: Yup.string().nullable(),
});

export default function HelpsAdmin() {
  const classes = useStyles();
  const { list, save, update, remove } = useHelps();
  const { user } = useContext(AuthContext);
  const history = useHistory();

  const titleRef = useRef(null);
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

  const isEditing = Boolean(editingItem?.id);

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
    },
    validationSchema: schema,
    onSubmit: async (values, helpers) => {
      setSaving(true);
      try {
        const parsed = parseYouTube(values.videoUrl);
        const videoId = parsed.id;
        const basePayload = {
          title: normalizeText(values.title),
          description: normalizeText(values.description),
          video: videoId || "",
          // Campo opcional: só persiste se o backend suportar (se não, ele será ignorado).
          category: normalizeText(values.category) || undefined,
        };

        async function persist(payload) {
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
        await reload();
      } catch (e) {
        toast.error("Não foi possível salvar. Verifique os campos e tente novamente.");
      } finally {
        setSaving(false);
      }
    },
  });

  const videoParsed = useMemo(() => parseYouTube(formik.values.videoUrl), [formik.values.videoUrl]);
  const videoId = videoParsed.id;

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
        String(r.description || "").toLowerCase().includes(q);
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
    setTimeout(() => titleRef.current?.focus?.(), 50);
  };

  const resetForm = () => {
    setEditingItem(null);
    formik.resetForm();
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
    } catch {
      toast.error("Não foi possível excluir o conteúdo.");
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
        <Title>Ajuda (Administração)</Title>
      </MainHeader>

      <Typography variant="body2" className={classes.headerSub}>
        Crie e mantenha conteúdos de ajuda (título, descrição e vídeo do YouTube).
      </Typography>

      <Grid container spacing={2} className={classes.grid} style={{ marginTop: 8 }}>
        {/* Form */}
        <Grid item xs={12} md={5}>
          <Card className={classes.card} elevation={3}>
            <CardHeader
              className={classes.cardHeader}
              title={isEditing ? "Editar Ajuda" : "Criar Ajuda"}
              subheader={isEditing ? "Atualize o conteúdo selecionado." : "Cadastre um novo conteúdo de ajuda."}
            />
            <CardContent>
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
                  label="Vídeo (YouTube) – URL ou ID"
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
                        : "Cole a URL do YouTube ou apenas o ID do vídeo."
                  }
                  placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX ou XXXXXXXX"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <YouTubeIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                {videoId ? (
                  <div className={classes.previewWrap} aria-label="Preview do vídeo">
                    <iframe
                      className={classes.iframe}
                      title="Preview do vídeo do YouTube"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
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
          <Card className={classes.card} elevation={3}>
            <CardHeader
              className={classes.cardHeader}
              title="Conteúdos cadastrados"
              subheader={`${filtered.length} item(ns)`}
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
                <Paper className={classes.tableContainer} elevation={0}>
                  <Table size="small" aria-label="Tabela de conteúdos de ajuda">
                    <TableHead>
                      <TableRow>
                        <TableCell>Título</TableCell>
                        <TableCell>Descrição</TableCell>
                        <TableCell align="center">Vídeo</TableCell>
                        <TableCell align="center">Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pageItems.map((row) => {
                        const hasVideo = Boolean(normalizeText(row.video));
                        return (
                          <TableRow key={row.id} hover>
                            <TableCell style={{ fontWeight: 700 }}>{row.title || "-"}</TableCell>
                            <TableCell className={classes.descCell}>
                              <Tooltip title={row.description || ""}>
                                <span>{row.description || "-"}</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                className={hasVideo ? classes.badgeYes : classes.badgeNo}
                                label={hasVideo ? "Sim" : "Não"}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Ver">
                                <IconButton
                                  aria-label={`Ver ${row.title}`}
                                  onClick={() => openView(row)}
                                >
                                  <VisibilityIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar">
                                <IconButton
                                  aria-label={`Editar ${row.title}`}
                                  onClick={() => startEdit(row)}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Excluir">
                                <IconButton
                                  aria-label={`Excluir ${row.title}`}
                                  onClick={() => askDelete(row)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* View dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{viewItem?.title || "Conteúdo"}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
            {viewItem?.description || "-"}
          </Typography>
          {parseYouTube(viewItem?.video).id ? (
            <div className={classes.previewWrap} style={{ marginTop: 16 }}>
              <iframe
                className={classes.iframe}
                title="Preview do vídeo"
                src={`https://www.youtube.com/embed/${parseYouTube(viewItem?.video).id}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
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


