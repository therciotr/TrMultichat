import React, { useEffect, useMemo, useRef, useState } from "react";
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
    gridTemplateColumns: "1fr 180px 180px",
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

function extractYouTubeId(inputRaw) {
  const input = normalizeText(inputRaw);
  if (!input) return "";
  // If it already looks like an ID
  if (/^[a-zA-Z0-9_-]{8,20}$/.test(input) && !input.includes("http")) return input;
  // Try parsing URL
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.replace("/", "");
      return id || "";
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = url.searchParams.get("v");
      if (v) return v;
      // /embed/{id}
      const m = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return m[1];
    }
  } catch {
    // ignore
  }
  // Last resort: find v=... substring
  const match = input.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  return match?.[1] || "";
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
  videoUrl: Yup.string().nullable(),
});

export default function HelpsAdmin() {
  const classes = useStyles();
  const { list, save, update, remove } = useHelps();

  const titleRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const [query, setQuery] = useState("");
  const [videoFilter, setVideoFilter] = useState("all"); // all|with|without
  const [sortBy, setSortBy] = useState("recent"); // recent|az

  const isEditing = Boolean(selected?.id);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: selected?.title || "",
      description: selected?.description || "",
      videoUrl: selected?.video ? String(selected.video) : "",
    },
    validationSchema: schema,
    onSubmit: async (values, helpers) => {
      setLoading(true);
      try {
        const videoId = extractYouTubeId(values.videoUrl);
        const payload = {
          title: normalizeText(values.title),
          description: normalizeText(values.description),
          video: videoId || "",
        };

        if (isEditing) {
          await update({ id: selected.id, ...payload });
          toast.success("Ajuda atualizada com sucesso!");
        } else {
          await save(payload);
          toast.success("Ajuda criada com sucesso!");
        }

        helpers.resetForm();
        setSelected(null);
        await reload();
      } catch (e) {
        toast.error("Não foi possível salvar. Verifique os campos e tente novamente.");
      } finally {
        setLoading(false);
      }
    },
  });

  const videoId = useMemo(() => extractYouTubeId(formik.values.videoUrl), [formik.values.videoUrl]);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await list();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Não foi possível carregar os conteúdos de ajuda.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      return okVideo && okText;
    });

    const sorted = [...base].sort((a, b) => {
      if (sortBy === "az") return String(a.title || "").localeCompare(String(b.title || ""));
      const aT = new Date(a.updatedAt || a.createdAt || 0).getTime() || Number(a.id || 0);
      const bT = new Date(b.updatedAt || b.createdAt || 0).getTime() || Number(b.id || 0);
      return bT - aT;
    });
    return sorted;
  }, [records, query, videoFilter, sortBy]);

  const openView = (item) => {
    setViewItem(item);
    setViewOpen(true);
  };

  const startEdit = (item) => {
    setSelected(item);
    setTimeout(() => titleRef.current?.focus?.(), 50);
  };

  const resetForm = () => {
    setSelected(null);
    formik.resetForm();
    setTimeout(() => titleRef.current?.focus?.(), 50);
  };

  const askDelete = (item) => {
    setSelected(item);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setLoading(true);
    try {
      await remove(selected.id);
      toast.success("Conteúdo removido com sucesso!");
      setConfirmOpen(false);
      setSelected(null);
      await reload();
    } catch {
      toast.error("Não foi possível excluir o conteúdo.");
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = !loading && filtered.length === 0;

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
                        loading={loading}
                      >
                        Atualizar
                      </ButtonWithSpinner>
                      <ButtonWithSpinner
                        variant="outlined"
                        onClick={resetForm}
                        loading={loading}
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
                        loading={loading}
                      >
                        Salvar
                      </ButtonWithSpinner>
                      <ButtonWithSpinner
                        variant="outlined"
                        onClick={() => formik.resetForm()}
                        loading={loading}
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
              </div>

              {loading ? (
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
                      {filtered.map((row) => {
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
          {extractYouTubeId(viewItem?.video) ? (
            <div className={classes.previewWrap} style={{ marginTop: 16 }}>
              <iframe
                className={classes.iframe}
                title="Preview do vídeo"
                src={`https://www.youtube.com/embed/${extractYouTubeId(viewItem?.video)}`}
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


