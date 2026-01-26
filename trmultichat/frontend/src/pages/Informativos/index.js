import React, { useContext, useEffect, useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import Divider from "@material-ui/core/Divider";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Skeleton from "@material-ui/lab/Skeleton";

import SearchOutlinedIcon from "@material-ui/icons/SearchOutlined";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import SendOutlinedIcon from "@material-ui/icons/SendOutlined";
import NotificationsOutlinedIcon from "@material-ui/icons/NotificationsOutlined";
import AddOutlinedIcon from "@material-ui/icons/AddOutlined";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import DeleteOutlineOutlinedIcon from "@material-ui/icons/DeleteOutlineOutlined";
import AttachFileOutlinedIcon from "@material-ui/icons/AttachFileOutlined";
import MoodOutlinedIcon from "@material-ui/icons/MoodOutlined";
import ChatBubbleOutlineOutlinedIcon from "@material-ui/icons/ChatBubbleOutlineOutlined";
import AccessTimeOutlinedIcon from "@material-ui/icons/AccessTimeOutlined";
import CloseOutlinedIcon from "@material-ui/icons/CloseOutlined";
import ZoomInOutlinedIcon from "@material-ui/icons/ZoomInOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TrSectionTitle, TrButton } from "../../components/ui";
import { socketConnection } from "../../services/socket";
import moment from "moment";
import AnnouncementModal from "../../components/AnnouncementModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

const useStyles = makeStyles((theme) => ({
  page: {
    padding: theme.spacing(2),
  },
  shell: {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  left: {
    borderRight: "1px solid rgba(15, 23, 42, 0.08)",
    height: "calc(100vh - 190px)",
    overflow: "auto",
    ...theme.scrollbarStyles,
  },
  right: {
    height: "calc(100vh - 190px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  listHeader: {
    padding: theme.spacing(1.5),
    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(11, 76, 70, 0.04)",
  },
  listItem: {
    padding: theme.spacing(1.5),
    borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
    cursor: "pointer",
    transition: "background 150ms ease",
    "&:hover": { background: "rgba(15, 23, 42, 0.03)" },
  },
  listItemActive: {
    background: "rgba(59, 130, 246, 0.06)",
  },
  detailHeader: {
    padding: theme.spacing(2),
    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(15, 23, 42, 0.02)",
  },
  detailBody: {
    padding: theme.spacing(2),
    overflow: "auto",
    flex: 1,
    ...theme.scrollbarStyles,
  },
  bubble: {
    padding: theme.spacing(1.25),
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "#fff",
    marginBottom: theme.spacing(1),
  },
  bubbleMeta: {
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.60)",
    marginTop: 6,
  },
  replyBar: {
    borderTop: "1px solid rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(1.5),
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(15, 23, 42, 0.03)",
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(15, 23, 42, 0.70)",
  },
  attachmentsRow: {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 6,
    ...theme.scrollbarStylesSoft,
  },
  thumb: {
    width: 86,
    height: 64,
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(15, 23, 42, 0.03)",
    objectFit: "cover",
    cursor: "pointer",
  },
}));

export default function Informativos() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const isAdmin = String(user?.profile || "").toLowerCase() === "admin" || Boolean(user?.admin) || Boolean(user?.super);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  const canReply = useMemo(() => {
    if (!selected) return false;
    if (isAdmin) return true; // admin can always reply as internal note
    return Boolean(selected.allowReply);
  }, [selected, isAdmin]);

  const currentUserId = Number(user?.id || 0);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/announcements/", { params: { pageNumber: 1, searchParam: search } });
      const list = Array.isArray(data?.records) ? data.records : [];
      setAnnouncements(list);
      if (!selected && list.length) setSelected(list[0]);
      if (selected?.id) {
        const still = list.find((a) => Number(a.id) === Number(selected.id));
        if (still) setSelected(still);
      }
    } catch (e) {
      toastError(e);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReplies = async (announcementId) => {
    if (!announcementId) return;
    setRepliesLoading(true);
    try {
      const { data } = await api.get(`/announcements/${announcementId}/replies`);
      setReplies(Array.isArray(data?.records) ? data.records : []);
    } catch (e) {
      setReplies([]);
    } finally {
      setRepliesLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchAnnouncements(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (selected?.id) fetchReplies(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });
    socket.on("company-announcement", (data) => {
      if (data?.action === "create" || data?.action === "update") {
        // refresh list (server filters visibility)
        fetchAnnouncements();
      }
      if (data?.action === "delete") {
        fetchAnnouncements();
      }
      if (data?.action === "reply") {
        if (selected?.id && Number(data.announcementId) === Number(selected.id)) {
          fetchReplies(selected.id);
        }
      }
    });
    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const handleSendReply = async () => {
    const text = String(replyText || "").trim();
    if ((!text && !file) || !selected?.id) return;
    setSending(true);
    try {
      if (file) {
        const formData = new FormData();
        formData.append("text", text || "");
        formData.append("file", file);
        await api.post(`/announcements/${selected.id}/replies`, formData);
      } else {
        await api.post(`/announcements/${selected.id}/replies`, { text });
      }
      setReplyText("");
      setFile(null);
      setEmojiOpen(false);
      await fetchReplies(selected.id);
    } catch (e) {
      toastError(e);
    } finally {
      setSending(false);
    }
  };

  const baseURL = String(process.env.REACT_APP_BACKEND_URL || api?.defaults?.baseURL || "").replace(/\/$/, "");

  const renderReplyMedia = (r) => {
    if (!r?.mediaPath) return null;
    const url = r?.mediaPath ? `${baseURL}/${String(r.mediaPath).replace(/^\//, "")}` : "";
    const name = r.mediaName || "arquivo";
    const type = String(r.mediaType || "");
    const isImg = type.startsWith("image/") || String(name).toLowerCase().endsWith(".gif");
    if (isImg) {
      return (
        <div style={{ marginTop: 10 }}>
          <img
            src={url}
            alt={name}
            style={{ maxWidth: 360, width: "100%", borderRadius: 12, border: "1px solid rgba(15, 23, 42, 0.10)" }}
            onClick={() => {
              setPreviewItem({ url, name, type });
              setPreviewOpen(true);
            }}
          />
          <div style={{ marginTop: 6 }}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {name}
            </a>
          </div>
        </div>
      );
    }
    if (type.startsWith("video/")) {
      return (
        <div style={{ marginTop: 10 }}>
          <video src={url} controls style={{ width: "100%", maxWidth: 420, borderRadius: 12 }} />
          <div style={{ marginTop: 6 }}>
            <a href={url} target="_blank" rel="noopener noreferrer">{name}</a>
          </div>
        </div>
      );
    }
    if (type.startsWith("audio/")) {
      return (
        <div style={{ marginTop: 10 }}>
          <audio src={url} controls style={{ width: "100%" }} />
          <div style={{ marginTop: 6 }}>
            <a href={url} target="_blank" rel="noopener noreferrer">{name}</a>
          </div>
        </div>
      );
    }
    return (
      <div style={{ marginTop: 10 }}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      </div>
    );
  };

  const attachments = useMemo(() => {
    return (Array.isArray(replies) ? replies : [])
      .filter((r) => Boolean(r?.mediaPath))
      .map((r) => ({
        id: r.id,
        url: r?.mediaPath ? `${baseURL}/${String(r.mediaPath).replace(/^\//, "")}` : "",
        name: r.mediaName,
        type: r.mediaType,
      }));
  }, [replies, baseURL]);

  const handleOpenCreate = () => {
    setEditingAnnouncementId(null);
    setAnnouncementModalOpen(true);
  };

  const handleOpenEdit = (id) => {
    setEditingAnnouncementId(id);
    setAnnouncementModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selected?.id) return;
    try {
      await api.delete(`/announcements/${selected.id}`);
      setConfirmDeleteOpen(false);
      setSelected(null);
      await fetchAnnouncements();
    } catch (e) {
      toastError(e);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className={classes.page}>
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontWeight: 900 }}>{previewItem?.name || "Preview"}</span>
          <IconButton onClick={() => setPreviewOpen(false)} size="small">
            <CloseOutlinedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {previewItem?.type?.startsWith("image/") ? (
            <img src={previewItem.url} alt={previewItem.name} style={{ width: "100%", borderRadius: 12 }} />
          ) : previewItem?.type?.startsWith("video/") ? (
            <video src={previewItem.url} controls style={{ width: "100%", borderRadius: 12 }} />
          ) : previewItem?.type?.startsWith("audio/") ? (
            <audio src={previewItem.url} controls style={{ width: "100%" }} />
          ) : (
            <a href={previewItem?.url || "#"} target="_blank" rel="noopener noreferrer">
              Abrir arquivo
            </a>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        title="Excluir informativo?"
        open={confirmDeleteOpen}
        onClose={setConfirmDeleteOpen}
        onConfirm={handleDelete}
      >
        Essa ação é permanente.
      </ConfirmationModal>

      <AnnouncementModal
        open={announcementModalOpen}
        onClose={() => setAnnouncementModalOpen(false)}
        announcementId={editingAnnouncementId}
        reload={() => fetchAnnouncements()}
      />

      <TrSectionTitle
        title="Chat - Interno"
        subtitle="Acompanhe comunicados e converse diretamente pelo painel."
        icon={<NotificationsOutlinedIcon />}
      />

      <Paper className={classes.shell} elevation={0}>
        <Grid container spacing={0}>
          <Grid item xs={12} md={4} className={classes.left}>
            <div className={classes.listHeader}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Buscar informativo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon />
                    </InputAdornment>
                  ),
                  endAdornment: isAdmin ? (
                    <InputAdornment position="end">
                      <IconButton onClick={handleOpenCreate} size="small" title="Novo informativo">
                        <AddOutlinedIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </div>

            {loading ? (
              <div style={{ padding: 16 }}>
                <Skeleton variant="rect" height={72} style={{ borderRadius: 14, marginBottom: 10 }} />
                <Skeleton variant="rect" height={72} style={{ borderRadius: 14, marginBottom: 10 }} />
                <Skeleton variant="rect" height={72} style={{ borderRadius: 14 }} />
              </div>
            ) : announcements.length === 0 ? (
              <div style={{ padding: 16, color: "rgba(15, 23, 42, 0.65)" }}>Nenhum informativo encontrado.</div>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className={`${classes.listItem} ${selected?.id === a.id ? classes.listItemActive : ""}`}
                  onClick={() => setSelected(a)}
                >
                  <Box display="flex" alignItems="center" justifyContent="space-between" gridGap={10}>
                    <Typography style={{ fontWeight: 900, fontSize: 13 }} noWrap>
                      {a.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={a.priority === 1 ? "Alta" : a.priority === 2 ? "Média" : "Baixa"}
                      style={{
                        fontWeight: 900,
                        background:
                          a.priority === 1 ? "rgba(239,68,68,0.12)" : a.priority === 2 ? "rgba(245,158,11,0.14)" : "rgba(15,23,42,0.08)",
                      }}
                    />
                  </Box>
                  <Typography style={{ marginTop: 6, fontSize: 12, color: "rgba(15, 23, 42, 0.62)" }} noWrap>
                    {a.text}
                  </Typography>
                  <Box display="flex" alignItems="center" justifyContent="space-between" style={{ marginTop: 10 }}>
                    <Box display="flex" alignItems="center" gridGap={8} style={{ flexWrap: "wrap" }}>
                      <Chip size="small" label={`De: ${a.senderName || "Sistema"}`} />
                      <Chip size="small" label={`Para: ${a.sendToAll ? "Todos" : (a.targetUserName || `Usuário #${a.targetUserId}`)}`} />
                    </Box>
                    <Box display="flex" alignItems="center" gridGap={8}>
                      {Number(a.attachmentsCount || 0) > 0 ? (
                        <span className={classes.pill} title="Anexos">
                          <AttachFileOutlinedIcon style={{ fontSize: 16 }} />
                          {Number(a.attachmentsCount)}
                        </span>
                      ) : null}
                      {Number(a.repliesCount || 0) > 0 ? (
                        <span className={classes.pill} title="Mensagens">
                          <ChatBubbleOutlineOutlinedIcon style={{ fontSize: 16 }} />
                          {Number(a.repliesCount)}
                        </span>
                      ) : null}
                      {a.lastReplyAt ? (
                        <span
                          className={classes.pill}
                          title={`Última atividade: ${moment(a.lastReplyAt).format("DD/MM/YYYY HH:mm")}`}
                        >
                          <AccessTimeOutlinedIcon style={{ fontSize: 16 }} />
                          {moment(a.lastReplyAt).fromNow()}
                        </span>
                      ) : null}
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gridGap={8} style={{ marginTop: 10 }}>
                    <Chip size="small" label={a.allowReply ? "Resposta: sim" : "Resposta: não"} />
                    {isAdmin ? (
                      <Chip size="small" label={a.status ? "Ativo" : "Inativo"} />
                    ) : null}
                  </Box>
                </div>
              ))
            )}
          </Grid>

          <Grid item xs={12} md={8} className={classes.right}>
            {!selected ? (
              <div style={{ padding: 24, color: "rgba(15, 23, 42, 0.65)" }}>Selecione um informativo para visualizar.</div>
            ) : (
              <>
                <div className={classes.detailHeader}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" gridGap={10}>
                    <div>
                      <Typography style={{ fontWeight: 900, fontSize: 16 }}>{selected.title}</Typography>
                      <Typography style={{ marginTop: 4, color: "rgba(15, 23, 42, 0.65)", fontSize: 12 }}>
                        {selected.createdAt ? moment(selected.createdAt).format("DD/MM/YYYY HH:mm") : ""}
                      </Typography>
                      <Box display="flex" alignItems="center" gridGap={8} style={{ marginTop: 10, flexWrap: "wrap" }}>
                        <Chip size="small" label={`De: ${selected.senderName || "Sistema"}`} />
                        <Chip size="small" label={`Para: ${selected.sendToAll ? "Todos" : (selected.targetUserName || `Usuário #${selected.targetUserId}`)}`} />
                      </Box>
                    </div>
                    <Box display="flex" alignItems="center" gridGap={8}>
                      <Chip icon={<ForumOutlinedIcon />} label="Conversa" />
                      {isAdmin ? (
                        <>
                          <IconButton size="small" title="Editar" onClick={() => handleOpenEdit(selected.id)}>
                            <EditOutlinedIcon />
                          </IconButton>
                          <IconButton size="small" title="Excluir" onClick={() => setConfirmDeleteOpen(true)}>
                            <DeleteOutlineOutlinedIcon />
                          </IconButton>
                        </>
                      ) : null}
                    </Box>
                  </Box>
                  <Divider style={{ marginTop: 12 }} />
                  <Typography style={{ marginTop: 12, color: "rgba(15, 23, 42, 0.82)" }}>{selected.text}</Typography>
                </div>

                <div className={classes.detailBody}>
                  <TrSectionTitle title="Mensagens" subtitle={canReply ? "Você pode responder abaixo." : "Respostas desativadas."} />

                  {attachments.length > 0 ? (
                    <div style={{ marginBottom: 14 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography style={{ fontWeight: 900, fontSize: 13, color: "rgba(15,23,42,0.78)" }}>
                          Anexos ({attachments.length})
                        </Typography>
                        <ZoomInOutlinedIcon style={{ fontSize: 18, color: "rgba(15,23,42,0.45)" }} />
                      </Box>
                      <div className={classes.attachmentsRow} style={{ marginTop: 10 }}>
                        {attachments.map((att) => {
                          const isImg = String(att.type || "").startsWith("image/") || String(att.name || "").toLowerCase().endsWith(".gif");
                          return (
                            <div key={att.id} title={att.name}>
                              {isImg ? (
                                <img
                                  className={classes.thumb}
                                  src={att.url}
                                  alt={att.name}
                                  onClick={() => {
                                    setPreviewItem(att);
                                    setPreviewOpen(true);
                                  }}
                                />
                              ) : (
                                <div
                                  className={classes.thumb}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}
                                  onClick={() => window.open(att.url, "_blank", "noopener,noreferrer")}
                                >
                                  <AttachFileOutlinedIcon />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {repliesLoading ? (
                    <Skeleton variant="rect" height={140} style={{ borderRadius: 16 }} />
                  ) : replies.length === 0 ? (
                    <div style={{ color: "rgba(15, 23, 42, 0.65)" }}>Ainda não há mensagens nesta conversa.</div>
                  ) : (
                    replies.map((r) => {
                      const mine = Number(r.userId || 0) === currentUserId;
                      return (
                        <div
                          className={classes.bubble}
                          key={r.id}
                          style={{
                            marginLeft: mine ? "auto" : undefined,
                            maxWidth: "92%",
                            background: mine ? "rgba(59,130,246,0.08)" : "#fff",
                          }}
                        >
                          <Typography style={{ fontWeight: 900, fontSize: 13 }}>
                            {mine ? "Você" : (r.userName || "Usuário")}
                          </Typography>
                          <Typography style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{r.text}</Typography>
                          {renderReplyMedia(r)}
                          <div className={classes.bubbleMeta}>
                            {r.createdAt ? moment(r.createdAt).format("DD/MM/YYYY HH:mm") : ""}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={classes.replyBar}>
                  <input
                    id="chat-interno-file"
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    accept="image/*,.gif,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  />
                  <IconButton
                    onClick={() => document.getElementById("chat-interno-file")?.click()}
                    disabled={sending}
                    title="Anexar arquivo (inclui GIF)"
                  >
                    <AttachFileOutlinedIcon />
                  </IconButton>
                  <IconButton onClick={() => setEmojiOpen((v) => !v)} disabled={sending} title="Emojis">
                    <MoodOutlinedIcon />
                  </IconButton>
                  {file ? (
                    <span className={classes.pill} title={file.name} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <AttachFileOutlinedIcon style={{ fontSize: 16 }} />
                      {file.name}
                      <IconButton size="small" onClick={() => setFile(null)} style={{ padding: 2 }}>
                        <CloseOutlinedIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  ) : null}
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    placeholder={canReply ? "Digite sua mensagem..." : "Respostas desativadas para este informativo"}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={!canReply || sending}
                  />
                  <IconButton
                    color="primary"
                    onClick={handleSendReply}
                    disabled={!canReply || sending || (!String(replyText || "").trim() && !file)}
                  >
                    <SendOutlinedIcon />
                  </IconButton>
                  <TrButton onClick={() => fetchReplies(selected.id)} disabled={repliesLoading}>
                    Atualizar
                  </TrButton>
                </div>
                {emojiOpen && canReply ? (
                  <div style={{ padding: 12, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    <Picker
                      title="Emojis"
                      onSelect={(e) => setReplyText((prev) => `${prev || ""}${e?.native || ""}`)}
                    />
                  </div>
                ) : null}
              </>
            )}
          </Grid>
        </Grid>
      </Paper>
    </div>
  );
}


