import React, { useState, useEffect, useMemo, useRef, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { green } from "@material-ui/core/colors";
import { TrButton } from "../ui";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import IconButton from "@material-ui/core/IconButton";
import FlashOnOutlinedIcon from "@material-ui/icons/FlashOnOutlined";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import CloudUploadOutlinedIcon from "@material-ui/icons/CloudUploadOutlined";
import { i18n } from "../../translate/i18n";
import { head } from "lodash";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import MessageVariablesPicker from "../MessageVariablesPicker";
import { AuthContext } from "../../context/Auth/AuthContext";
import Autocomplete from "@material-ui/lab/Autocomplete";

import {
    FormControlLabel,
    Grid,
    Switch,
    Chip,
    Box,
} from "@material-ui/core";
import ConfirmationModal from "../ConfirmationModal";

const path = require('path');

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
    },
    dialogPaper: {
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${theme.palette.divider}`,
        maxHeight: "calc(100vh - 72px)",
        [theme.breakpoints.down("xs")]: {
            maxHeight: "100vh",
            borderRadius: 0,
        },
    },
    titleWrap: {
        display: "flex",
        alignItems: "center",
        gap: 12,
    },
    titleIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        background: "rgba(59, 130, 246, 0.12)",
        border: "1px solid rgba(59, 130, 246, 0.16)",
        color: "rgba(14, 116, 144, 1)",
        flex: "0 0 auto",
    },
    titleText: {
        fontWeight: 1000,
        fontSize: 15,
        margin: 0,
        color: theme.palette.text.primary,
    },
    titleSub: {
        fontSize: 12,
        marginTop: 2,
        color: theme.palette.text.secondary,
    },
    field: {
        "& .MuiOutlinedInput-root": {
            borderRadius: 14,
            background: theme.palette.background.paper,
        },
    },
    hintRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: theme.spacing(1.25),
        borderRadius: 14,
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.type === "dark" ? "rgba(15,23,42,0.55)" : "rgba(15,23,42,0.03)",
        marginBottom: theme.spacing(1.5),
    },
    hintIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        background: "rgba(59,130,246,0.12)",
        color: "rgba(30,64,175,0.95)",
        flex: "0 0 auto",
    },
    sectionCard: {
        borderRadius: 16,
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.background.paper,
        padding: theme.spacing(1.5),
    },
    sectionTitle: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 1000,
        fontSize: 12,
        color: "rgba(15,23,42,0.76)",
        marginBottom: theme.spacing(1),
    },
    previewBox: {
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.10)",
        background: "rgba(248,250,252,1)",
        padding: theme.spacing(1.25),
        fontSize: 13,
        lineHeight: 1.45,
        color: "rgba(15,23,42,0.78)",
        whiteSpace: "pre-wrap",
    },
    attachPill: {
        borderRadius: 999,
        fontWeight: 900,
    },
    actionsBar: {
        position: "sticky",
        bottom: 0,
        zIndex: 2,
        background: "#fff",
        borderTop: "1px solid rgba(15,23,42,0.10)",
        padding: theme.spacing(1.25, 1.5),
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        gap: theme.spacing(1),
        "& > *": {
            margin: 0, // override MUI default spacing
        },
        [theme.breakpoints.down("xs")]: {
            flexDirection: "column",
            alignItems: "stretch",
            "& > *": {
                width: "100%",
            },
        },
    },
    actionBtn: {
        borderRadius: 12,
        fontWeight: 900,
        textTransform: "none",
        minHeight: 40,
    },
    actionBtnPrimary: {
        borderRadius: 12,
        fontWeight: 1000,
        textTransform: "none",
        minHeight: 40,
    },
    multFieldLine: {
        display: "flex",
        "& > *:not(:last-child)": {
            marginRight: theme.spacing(1),
        },
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
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
    colorAdorment: {
        width: 20,
        height: 20,
    },
}));

const QuickeMessageSchema = Yup.object().shape({
    shortcode: Yup.string().required("Obrigatório"),
    //   message: Yup.string().required("Obrigatório"),
});

const QuickMessageDialog = ({ open, onClose, quickemessageId, reload }) => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
    const messageInputRef = useRef();

    const initialState = {
        shortcode: "",
        message: "",
        category: "",
        geral: false,
        status: true,
    };

    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [quickemessage, setQuickemessage] = useState(initialState);
    const [attachment, setAttachment] = useState(null);
    const attachmentFile = useRef(null);
    const [categoryOptions, setCategoryOptions] = useState([]);

    const companyId = user?.companyId;
    const userId = user?.id;

    const normalizedCategoryOptions = useMemo(() => {
        const arr = Array.isArray(categoryOptions) ? categoryOptions : [];
        return arr
            .map((s) => String(s || "").trim())
            .filter(Boolean)
            .slice(0, 60);
    }, [categoryOptions]);

    useEffect(() => {
        try {
            (async () => {
                if (!quickemessageId) return;

                const { data } = await api.get(`/quick-messages/${quickemessageId}`);

                setQuickemessage((prevState) => {
                    return { ...prevState, ...data };
                });
            })();
        } catch (err) {
            toastError(err);
        }
    }, [quickemessageId, open]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                if (!open) return;
                if (!companyId) return;
                const { data } = await api.get("/quick-messages/list", {
                    params: { companyId, userId },
                });
                const rows = Array.isArray(data) ? data : [];
                const uniq = new Set();
                for (const r of rows) {
                    const c = String(r?.category || "").trim();
                    if (c) uniq.add(c);
                }
                const sorted = Array.from(uniq).sort((a, b) =>
                    String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" })
                );
                if (!alive) return;
                setCategoryOptions(sorted);
            } catch (_) {
                // silent
            }
        })();
        return () => {
            alive = false;
        };
    }, [open, companyId, userId]);

    const handleClose = () => {
        setQuickemessage(initialState);
        setAttachment(null);
        onClose();
    };

    const handleAttachmentFile = (e) => {
      
        const file = head(e.target.files);
        if (file) {
            setAttachment(file);
        }
    };

    const handleSaveQuickeMessage = async (values) => {

        const quickemessageData = { ...values, isMedia: true, mediaPath: attachment ? String(attachment.name).replace(/ /g, "_") : values.mediaPath ? path.basename(values.mediaPath).replace(/ /g, "_") : null };

        try {
            if (quickemessageId) {
                await api.put(`/quick-messages/${quickemessageId}`, quickemessageData);
                if (attachment != null) {
                    const formData = new FormData();
                    formData.append("typeArch", "quickMessage");
                    formData.append("file", attachment);
                    await api.post(
                        `/quick-messages/${quickemessageId}/media-upload`,
                        formData
                    );
                }
            } else {
                const { data } = await api.post("/quick-messages", quickemessageData);
                if (attachment != null) {
                    const formData = new FormData();
                    formData.append("typeArch", "quickMessage");
                    formData.append("file", attachment);
                    await api.post(`/quick-messages/${data.id}/media-upload`, formData);
                }
            }
            toast.success(i18n.t("quickMessages.toasts.success"));
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

        if (quickemessage.mediaPath) {
            await api.delete(`/quick-messages/${quickemessage.id}/media-upload`);
            setQuickemessage((prev) => ({
                ...prev,
                mediaPath: null,
            }));
            toast.success(i18n.t("quickMessages.toasts.deleted"));
            if (typeof reload == "function") {

                reload();
            }
        }
    };

    const handleClickMsgVar = async (msgVar, setValueFunc) => {
        const el = messageInputRef.current;
        const firstHalfText = el.value.substring(0, el.selectionStart);
        const secondHalfText = el.value.substring(el.selectionEnd);
        const newCursorPos = el.selectionStart + msgVar.length;

        setValueFunc("message", `${firstHalfText}${msgVar}${secondHalfText}`);

        await new Promise(r => setTimeout(r, 100));
        messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    };

    return (
        <div className={classes.root}>
            <ConfirmationModal
                title={i18n.t("quickMessages.confirmationModal.deleteTitle")}
                open={confirmationOpen}
                onClose={() => setConfirmationOpen(false)}
                onConfirm={deleteMedia}
            >
                {i18n.t("quickMessages.confirmationModal.deleteMessage")}
            </ConfirmationModal>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
                scroll="paper"
                classes={{ paper: classes.dialogPaper }}
                fullScreen={fullScreen}
            >
                <DialogTitle id="form-dialog-title" disableTypography>
                    <div className={classes.titleWrap}>
                        <div className={classes.titleIcon}>
                            <FlashOnOutlinedIcon />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <p className={classes.titleText}>
                                {quickemessageId ? `${i18n.t("quickMessages.dialog.edit")}` : `${i18n.t("quickMessages.dialog.add")}`}
                            </p>
                            <div className={classes.titleSub}>
                                Digite <strong>/atalho</strong> no chat e pressione <strong>Enter</strong>.
                            </div>
                        </div>
                        <Box flex={1} />
                        <Chip size="small" className={classes.attachPill} label={quickemessageId ? "Edição" : "Novo"} />
                    </div>
                </DialogTitle>
                <div style={{ display: "none" }}>
                    <input
                        type="file"
                        ref={attachmentFile}
                        onChange={(e) => handleAttachmentFile(e)}
                    />
                </div>
                <Formik
                    initialValues={quickemessage}
                    enableReinitialize={true}
                    validationSchema={QuickeMessageSchema}
                    onSubmit={(values, actions) => {
                        setTimeout(() => {
                            handleSaveQuickeMessage(values);
                            actions.setSubmitting(false);
                        }, 400);
                    }}
                >
                    {({ touched, errors, isSubmitting, setFieldValue, values }) => (
                        <Form>
                            <DialogContent dividers>
                                <div className={classes.hintRow}>
                                    <div className={classes.hintIcon}>
                                        <InfoOutlinedIcon style={{ fontSize: 18 }} />
                                    </div>
                                    <div style={{ fontSize: 13, color: "rgba(15,23,42,0.72)", lineHeight: 1.4 }}>
                                        <div style={{ fontWeight: 900, marginBottom: 2 }}>Dica premium</div>
                                        Crie atalhos curtos e fáceis de memorizar. Ex.: <strong>/bomdia</strong>, <strong>/pix</strong>, <strong>/endereco</strong>.
                                    </div>
                                </div>

                                <Grid spacing={2} container>
                                    <Grid xs={12} item>
                                        <Field
                                            as={TextField}
                                            autoFocus
                                            label={i18n.t("quickMessages.dialog.shortcode")}
                                            name="shortcode"
                                            error={touched.shortcode && Boolean(errors.shortcode)}
                                            helperText={touched.shortcode && errors.shortcode}
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                            className={classes.field}
                                        />
                                    </Grid>
                                    <Grid xs={12} item>
                                        <Autocomplete
                                            freeSolo
                                            options={normalizedCategoryOptions}
                                            value={String(values.category || "")}
                                            onChange={(_, v) => setFieldValue("category", String(v || ""))}
                                            onInputChange={(_, v) => setFieldValue("category", String(v || ""))}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Categoria (opcional)"
                                                    variant="outlined"
                                                    margin="dense"
                                                    fullWidth
                                                    className={classes.field}
                                                    helperText="Ex.: Saudações, Cobrança, Endereço, Suporte"
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid xs={12} item>
                                        <div className={classes.sectionCard}>
                                            <div className={classes.sectionTitle}>
                                                <InfoOutlinedIcon style={{ fontSize: 16, opacity: 0.8 }} />
                                                Configuração
                                            </div>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={Boolean(values.status)}
                                                                onChange={(e) => setFieldValue("status", e.target.checked)}
                                                                color="primary"
                                                            />
                                                        }
                                                        label="Ativo"
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={Boolean(values.geral)}
                                                                onChange={(e) => setFieldValue("geral", e.target.checked)}
                                                                color="primary"
                                                            />
                                                        }
                                                        label="Geral (para todos)"
                                                    />
                                                </Grid>
                                            </Grid>
                                        </div>
                                    </Grid>
                                    <Grid xs={12} item>
                                        <Field
                                            as={TextField}
                                            label={i18n.t("quickMessages.dialog.message")}
                                            name="message"
                                            inputRef={messageInputRef}
                                            error={touched.message && Boolean(errors.message)}
                                            helperText={touched.message && errors.message}
                                            variant="outlined"
                                            margin="dense"
                                            multiline={true}
                                            rows={7}
                                            fullWidth
                                        // disabled={quickemessage.mediaPath || attachment ? true : false}
                                            className={classes.field}
                                        />
                                    </Grid>
                                    <Grid item>
                                        <MessageVariablesPicker
                                            disabled={isSubmitting}
                                            onClick={value => handleClickMsgVar(value, setFieldValue)}
                                        />
                                    </Grid>
                                    <Grid xs={12} item>
                                        <div className={classes.sectionCard}>
                                            <div className={classes.sectionTitle}>
                                                <InfoOutlinedIcon style={{ fontSize: 16, opacity: 0.8 }} />
                                                Pré-visualização
                                            </div>
                                            <div className={classes.previewBox}>
                                                {String(values.message || "").trim() ? String(values.message || "") : "—"}
                                            </div>
                                        </div>
                                    </Grid>
                                    {(quickemessage.mediaPath || attachment) && (
                                        <Grid xs={12} item>
                                            <TrButton startIcon={<AttachFileIcon />} variant="outlined">
                                                {attachment ? attachment.name : quickemessage.mediaName}
                                            </TrButton>
                                            <IconButton
                                                onClick={() => setConfirmationOpen(true)}
                                                color="secondary"
                                            >
                                                <DeleteOutlineIcon color="secondary" />
                                            </IconButton>
                                        </Grid>
                                    )}
                                </Grid>
                            </DialogContent>
                            <DialogActions className={classes.actionsBar}>
                                {!attachment && !quickemessage.mediaPath && (
                                    <TrButton
                                        onClick={() => attachmentFile.current.click()}
                                        disabled={isSubmitting}
                                        variant="outlined"
                                        startIcon={<CloudUploadOutlinedIcon />}
                                        className={classes.actionBtn}
                                    >
                                        Anexar
                                    </TrButton>
                                )}
                                <TrButton onClick={handleClose} disabled={isSubmitting} variant="outlined" className={classes.actionBtn}>
                                    {i18n.t("quickMessages.buttons.cancel")}
                                </TrButton>
                                <TrButton type="submit" disabled={isSubmitting} className={classes.actionBtnPrimary}>
                                    {quickemessageId
                                        ? `${i18n.t("quickMessages.buttons.edit")}`
                                        : `${i18n.t("quickMessages.buttons.add")}`}
                                    {isSubmitting && (
                                        <CircularProgress
                                            size={24}
                                            className={classes.buttonProgress}
                                        />
                                    )}
                                </TrButton>
                            </DialogActions>
                        </Form>
                    )}
                </Formik>
            </Dialog>
        </div>
    );
};

export default QuickMessageDialog;