import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import { TrButton } from "../ui";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import Divider from "@material-ui/core/Divider";
import Chip from "@material-ui/core/Chip";

import { i18n } from "../../translate/i18n";
import { head } from "lodash";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  FormControlLabel,
} from "@material-ui/core";
import ConfirmationModal from "../ConfirmationModal";
import CloseOutlinedIcon from "@material-ui/icons/CloseOutlined";
import NotificationsOutlinedIcon from "@material-ui/icons/NotificationsOutlined";
import TitleOutlinedIcon from "@material-ui/icons/TitleOutlined";
import SubjectOutlinedIcon from "@material-ui/icons/SubjectOutlined";
import LabelImportantOutlinedIcon from "@material-ui/icons/LabelImportantOutlined";
import ToggleOnOutlinedIcon from "@material-ui/icons/ToggleOnOutlined";
import PeopleOutlineOutlinedIcon from "@material-ui/icons/PeopleOutlineOutlined";
import PersonOutlineOutlinedIcon from "@material-ui/icons/PersonOutlineOutlined";
import SearchOutlinedIcon from "@material-ui/icons/SearchOutlined";
import AttachFileOutlinedIcon from "@material-ui/icons/AttachFileOutlined";
import DeleteOutlineOutlinedIcon from "@material-ui/icons/DeleteOutlineOutlined";
import CheckCircleOutlineOutlinedIcon from "@material-ui/icons/CheckCircleOutlineOutlined";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  dialogPaper: {
    borderRadius: 18,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2, 2, 1.25),
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    minWidth: 0,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,0.10)",
    color: "rgba(59,130,246,0.95)",
    border: "1px solid rgba(59,130,246,0.18)",
    flexShrink: 0,
  },
  headerTitle: {
    fontWeight: 1000,
    fontSize: 16,
    color: "rgba(15,23,42,0.92)",
    lineHeight: "20px",
  },
  headerSub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(15,23,42,0.62)",
    lineHeight: "18px",
  },
  closeBtn: {
    color: "rgba(15,23,42,0.55)",
  },
  content: {
    padding: theme.spacing(1.75, 2),
  },
  section: {
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.92)",
    padding: theme.spacing(1.5),
  },
  sectionTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: theme.spacing(1),
    color: "rgba(15,23,42,0.82)",
  },
  sectionTitle: {
    fontWeight: 1000,
    fontSize: 13,
  },
  helper: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(15,23,42,0.60)",
  },
  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      backgroundColor: "#fff",
    },
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(15,23,42,0.04)",
    fontSize: 12,
    fontWeight: 900,
    maxWidth: "100%",
  },
  actions: {
    padding: theme.spacing(1.25, 2, 2),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  actionBtn: {
    borderRadius: 12,
    fontWeight: 900,
    textTransform: "none",
    padding: theme.spacing(0.9, 1.6),
    whiteSpace: "nowrap",
  },
  primaryBtn: {
    background: "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(99,102,241,0.95))",
    color: "#fff",
    "&:hover": {
      background: "linear-gradient(90deg, rgba(59,130,246,1), rgba(99,102,241,1))",
    },
  },
}));

const AnnouncementSchema = Yup.object().shape({
  title: Yup.string().required("Obrigatório"),
  text: Yup.string().required("Obrigatório"),
});

const AnnouncementModal = ({ open, onClose, announcementId, reload }) => {
  const classes = useStyles();

  const initialState = {
    title: "",
    text: "",
    priority: 3,
    status: true,
    sendToAll: true,
    targetUserId: "",
    allowReply: false,
  };

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(initialState);
  const [attachment, setAttachment] = useState(null);
  const attachmentFile = useRef(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    try {
      (async () => {
        if (!announcementId) return;

        const { data } = await api.get(`/announcements/${announcementId}`);
        setAnnouncement((prevState) => {
          return { ...prevState, ...data };
        });
      })();
    } catch (err) {
      toastError(err);
    }
  }, [announcementId, open]);

  useEffect(() => {
    if (!open) return;
    // fetch users for targeting
    (async () => {
      setUsersLoading(true);
      try {
        const { data } = await api.get("/users", { params: { searchParam: userSearch || "", pageNumber: 1 } });
        const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
        setUsers(list);
      } catch (e) {
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [open, userSearch]);

  const handleClose = () => {
    setAnnouncement(initialState);
    setAttachment(null);
    onClose();
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const handleSaveAnnouncement = async (values) => {
    const announcementData = {
      ...values,
      // normalize targetUserId
      targetUserId: values?.sendToAll ? null : (values?.targetUserId === "" ? null : Number(values?.targetUserId)),
    };
    try {
      if (announcementId) {
        await api.put(`/announcements/${announcementId}`, announcementData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(
            `/announcements/${announcementId}/media-upload`,
            formData
          );
        }
      } else {
        const { data } = await api.post("/announcements", announcementData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/announcements/${data.id}/media-upload`, formData);
        }
      }
      toast.success(i18n.t("announcements.toasts.success"));
      if (typeof reload == "function") {
        reload();
      }
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (announcement.mediaPath) {
      await api.delete(`/announcements/${announcement.id}/media-upload`);
      setAnnouncement((prev) => ({
        ...prev,
        mediaPath: null,
      }));
      toast.success(i18n.t("announcements.toasts.deleted"));
      if (typeof reload == "function") {
        reload();
      }
    }
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("announcements.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("announcements.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle id="form-dialog-title" style={{ padding: 0 }}>
          <div className={classes.header}>
            <div className={classes.headerLeft}>
              <div className={classes.headerIcon}>
                <NotificationsOutlinedIcon />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className={classes.headerTitle}>
                  {announcementId ? "Editar Chat - Interno" : "Novo Chat - Interno"}
                </div>
                <div className={classes.headerSub}>
                  Crie um informativo, selecione o destinatário e permita respostas se necessário.
                </div>
              </div>
            </div>
            <IconButton onClick={handleClose} size="small" className={classes.closeBtn} title="Fechar">
              <CloseOutlinedIcon />
            </IconButton>
          </div>
          <Divider />
        </DialogTitle>
        <div style={{ display: "none" }}>
          <input
            type="file"
            accept="image/*,.gif,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
        <Formik
          initialValues={announcement}
          enableReinitialize={true}
          validationSchema={AnnouncementSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveAnnouncement(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values }) => (
            <Form>
              <DialogContent className={classes.content}>
                <Grid spacing={2} container>
                  <Grid xs={12} item>
                    <div className={classes.section}>
                      <div className={classes.sectionTitleRow}>
                        <TitleOutlinedIcon style={{ fontSize: 18, opacity: 0.75 }} />
                        <span className={classes.sectionTitle}>Conteúdo</span>
                      </div>

                      <Field
                        as={TextField}
                        className={classes.field}
                        label="Título"
                        name="title"
                        error={touched.title && Boolean(errors.title)}
                        helperText={touched.title && errors.title}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LabelImportantOutlinedIcon style={{ fontSize: 18, opacity: 0.65 }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <Field
                        as={TextField}
                        className={classes.field}
                        label="Texto"
                        name="text"
                        error={touched.text && Boolean(errors.text)}
                        helperText={touched.text && errors.text}
                        variant="outlined"
                        margin="dense"
                        multiline={true}
                        rows={6}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SubjectOutlinedIcon style={{ fontSize: 18, opacity: 0.65 }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <div className={classes.helper}>
                        Dica: use um título curto e um texto objetivo para facilitar a leitura no painel.
                      </div>
                    </div>
                  </Grid>

                  <Grid xs={12} item>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <div className={classes.section}>
                          <div className={classes.sectionTitleRow}>
                            <ToggleOnOutlinedIcon style={{ fontSize: 18, opacity: 0.75 }} />
                            <span className={classes.sectionTitle}>Status</span>
                          </div>
                          <FormControl variant="outlined" margin="dense" fullWidth className={classes.field}>
                            <InputLabel id="status-selection-label">
                              {i18n.t("announcements.dialog.form.status")}
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("announcements.dialog.form.status")}
                              labelId="status-selection-label"
                              id="status"
                              name="status"
                              error={touched.status && Boolean(errors.status)}
                            >
                              <MenuItem value={true}>Ativo</MenuItem>
                              <MenuItem value={false}>Inativo</MenuItem>
                            </Field>
                          </FormControl>
                          <div className={classes.helper}>
                            “Inativo” oculta para usuários comuns, mas mantém registro para histórico.
                          </div>
                        </div>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <div className={classes.section}>
                          <div className={classes.sectionTitleRow}>
                            <LabelImportantOutlinedIcon style={{ fontSize: 18, opacity: 0.75 }} />
                            <span className={classes.sectionTitle}>Prioridade</span>
                          </div>
                          <FormControl variant="outlined" margin="dense" fullWidth className={classes.field}>
                            <InputLabel id="priority-selection-label">
                              {i18n.t("announcements.dialog.form.priority")}
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("announcements.dialog.form.priority")}
                              labelId="priority-selection-label"
                              id="priority"
                              name="priority"
                              error={touched.priority && Boolean(errors.priority)}
                            >
                              <MenuItem value={1}>Alta</MenuItem>
                              <MenuItem value={2}>Média</MenuItem>
                              <MenuItem value={3}>Baixa</MenuItem>
                            </Field>
                          </FormControl>
                          <div className={classes.helper}>
                            A prioridade aparece como etiqueta na lista para facilitar a triagem.
                          </div>
                        </div>
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid xs={12} item>
                    <div className={classes.section}>
                      <div className={classes.sectionTitleRow}>
                        <PeopleOutlineOutlinedIcon style={{ fontSize: 18, opacity: 0.75 }} />
                        <span className={classes.sectionTitle}>Destino</span>
                      </div>

                      <div className={classes.toggleRow}>
                        <FormControlLabel
                          control={
                            <Field
                              as={Switch}
                              name="sendToAll"
                              color="primary"
                              checked={Boolean(values.sendToAll)}
                            />
                          }
                          label="Enviar para todos"
                        />
                        {!values.sendToAll ? (
                          <Chip
                            size="small"
                            icon={<PersonOutlineOutlinedIcon />}
                            label="Destino: usuário específico"
                            style={{ fontWeight: 900 }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            icon={<PeopleOutlineOutlinedIcon />}
                            label="Destino: todos"
                            style={{ fontWeight: 900 }}
                          />
                        )}
                      </div>

                      {!values.sendToAll && (
                        <Box mt={1}>
                          <TextField
                            className={classes.field}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            label="Buscar usuário"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            disabled={usersLoading}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchOutlinedIcon style={{ fontSize: 18, opacity: 0.7 }} />
                                </InputAdornment>
                              ),
                            }}
                          />
                          <FormControl variant="outlined" margin="dense" fullWidth className={classes.field}>
                            <InputLabel id="target-user-selection-label">Usuário</InputLabel>
                            <Field
                              as={Select}
                              label="Usuário"
                              labelId="target-user-selection-label"
                              id="targetUserId"
                              name="targetUserId"
                            >
                              <MenuItem value={""}>Selecione...</MenuItem>
                              {users.map((u) => (
                                <MenuItem key={u.id} value={String(u.id)}>
                                  {u.name ? `${u.name} (#${u.id})` : `Usuário #${u.id}`}
                                </MenuItem>
                              ))}
                            </Field>
                          </FormControl>
                        </Box>
                      )}
                      <div className={classes.helper}>
                        Selecione “todos” para um comunicado geral ou um usuário específico para conversas direcionadas.
                      </div>
                    </div>
                  </Grid>

                  <Grid xs={12} item>
                    <div className={classes.section}>
                      <div className={classes.sectionTitleRow}>
                        <CheckCircleOutlineOutlinedIcon style={{ fontSize: 18, opacity: 0.75 }} />
                        <span className={classes.sectionTitle}>Permissões</span>
                      </div>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            name="allowReply"
                            color="primary"
                            checked={Boolean(values.allowReply)}
                          />
                        }
                        label="Permitir resposta do usuário"
                      />
                      <div className={classes.helper}>
                        Se estiver desligado, apenas admins poderão escrever (útil para comunicados).
                      </div>
                    </div>
                  </Grid>

                  <Grid xs={12} item>
                    <div className={classes.section}>
                      <div className={classes.sectionTitleRow}>
                        <AttachFileOutlinedIcon style={{ fontSize: 18, opacity: 0.75 }} />
                        <span className={classes.sectionTitle}>Anexo</span>
                      </div>

                      <Box display="flex" alignItems="center" gridGap={10} style={{ flexWrap: "wrap" }}>
                        {!attachment && !announcement.mediaPath ? (
                          <TrButton
                            className={classes.actionBtn}
                            onClick={() => attachmentFile.current.click()}
                            disabled={isSubmitting}
                            startIcon={<AttachFileOutlinedIcon />}
                          >
                            Anexar arquivo
                          </TrButton>
                        ) : null}

                        {(announcement.mediaPath || attachment) ? (
                          <>
                            <span className={classes.pill} title={attachment ? attachment.name : announcement.mediaName}>
                              <AttachFileOutlinedIcon style={{ fontSize: 16, opacity: 0.8 }} />
                              {attachment ? attachment.name : announcement.mediaName}
                            </span>
                            <IconButton onClick={() => setConfirmationOpen(true)} size="small" title="Remover anexo">
                              <DeleteOutlineOutlinedIcon />
                            </IconButton>
                          </>
                        ) : (
                          <span className={classes.helper}>Opcional. Você pode anexar imagens, PDFs, vídeos ou outros arquivos.</span>
                        )}
                      </Box>
                    </div>
                  </Grid>
                </Grid>
              </DialogContent>

              <DialogActions className={classes.actions}>
                <Box display="flex" alignItems="center" gridGap={10}>
                  <span style={{ fontSize: 12, color: "rgba(15,23,42,0.55)" }}>
                    {values.sendToAll ? "Destino: Todos" : "Destino: Usuário"}
                  </span>
                </Box>
                <Box display="flex" alignItems="center" gridGap={10}>
                  <TrButton className={classes.actionBtn} onClick={handleClose} disabled={isSubmitting}>
                    Cancelar
                  </TrButton>
                  <TrButton
                    type="submit"
                    disabled={isSubmitting}
                    className={`${classes.actionBtn} ${classes.primaryBtn} ${classes.btnWrapper}`}
                    startIcon={<CheckCircleOutlineOutlinedIcon />}
                  >
                    {announcementId ? "Salvar" : "Criar"}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </TrButton>
                </Box>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default AnnouncementModal;
