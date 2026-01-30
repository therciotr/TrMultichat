import React, { useState, useEffect, useContext, useMemo } from "react";

import * as Yup from "yup";
import {
    Formik,
    Form,
    Field,
    FieldArray
} from "formik";
import { toast } from "react-toastify";

import {
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    makeStyles,
    TextField
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import AddCircleOutlineIcon from "@material-ui/icons/AddCircleOutline";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import InsertDriveFileOutlinedIcon from "@material-ui/icons/InsertDriveFileOutlined";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";

import { green } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TrButton } from "../ui";

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4
    },
    dialogPaper: {
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(15, 23, 42, 0.10)",
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
        color: "rgba(15, 23, 42, 0.92)",
    },
    titleSub: {
        fontSize: 12,
        marginTop: 2,
        color: "rgba(15, 23, 42, 0.64)",
    },
    hintRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: theme.spacing(1.25),
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(15,23,42,0.03)",
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
        border: "1px solid rgba(15, 23, 42, 0.10)",
        background: "rgba(255,255,255,0.96)",
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
    multFieldLine: {
        display: "flex",
        "& > *:not(:last-child)": {
            marginRight: theme.spacing(1),
        },
    },
    textField: {
        marginRight: theme.spacing(1),
        flex: 1,
    },

    extraAttr: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
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
    optionRow: {
        width: "100%",
        padding: theme.spacing(1.25),
        borderRadius: 12,
        border: "1px solid rgba(15, 23, 42, 0.10)",
        background: "rgba(248,250,252,1)",
    },
    optionActions: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
    },
    fileName: {
        fontSize: 12,
        color: theme.palette.text.secondary,
        wordBreak: "break-word",
    },
    hiddenFileInput: {
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
        opacity: 0,
    },
    attachBtn: {
        minWidth: 0,
        padding: "6px 10px",
        borderRadius: 10,
    },
    attachWrap: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
    },
    attachInputOverlay: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0,
        cursor: "pointer",
        // keep it clickable in all browsers
        zIndex: 2,
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
        "& > *": { margin: 0 },
        [theme.breakpoints.down("xs")]: {
            flexDirection: "column",
            alignItems: "stretch",
            "& > *": { width: "100%" },
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
}));

const FileListSchema = Yup.object().shape({
    name: Yup.string()
        .min(3, "nome muito curto")
        .required("Obrigatório"),
    message: Yup.string()
        .required("Obrigatório")
});

function hasAnySelectedFile(options) {
    try {
        if (!Array.isArray(options)) return false;
        return options.some((o) => Boolean(o?.file));
    } catch (_) {
        return false;
    }
}

const FilesModal = ({ open, onClose, fileListId, reload }) => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
    const [selectedFileNames, setSelectedFileNames] = useState([]);


    const initialState = {
        name: "",
        message: "",
        options: [{ name: "", path:"", mediaType:"" }],
    };

    const [fileList, setFileList] = useState(initialState);

    const modalTitle = useMemo(() => {
        return fileListId ? `${i18n.t("fileModal.title.edit")}` : `${i18n.t("fileModal.title.add")}`;
    }, [fileListId]);

    useEffect(() => {
        try {
            (async () => {
                if (!fileListId) return;

                const { data } = await api.get(`/files/${fileListId}`);
                setFileList(data);
            })()
        } catch (err) {
            toastError(err);
        }
    }, [fileListId, open]);

    useEffect(() => {
        if (open) {
            setSelectedFileNames([]);
        }
    }, [open]);

    const handleClose = () => {
        setFileList(initialState);
        onClose();
    };

    const handleSaveFileList = async (values) => {

        const uploadFiles = async (options, filesOptions, id) => {
                const formData = new FormData();
                formData.append("fileId", id);
                formData.append("typeArch", "fileList")
                filesOptions.forEach((fileOption, index) => {
                    if (fileOption.file) {
                        formData.append("files", fileOption.file);
                        formData.append("mediaType", fileOption.file.type)
                        formData.append("name", options[index].name);
                        formData.append("id", options[index].id);
                    }
                });
      
              try {
                const { data } = await api.post(`/files/uploadList/${id}`, formData);
                return data;
              } catch (err) {
                toastError(err);
              }
            return null;
        }

        // IMPORTANT: do not send raw File objects in JSON payload
        const cleanOptions = Array.isArray(values?.options)
          ? values.options.map((o) => ({
              id: o?.id,
              name: o?.name,
              path: o?.path,
              mediaType: o?.mediaType,
            }))
          : [];
        const fileData = { ...values, options: cleanOptions, userId: user.id };
        
        // require at least one file selected to avoid "saved but no real attachment"
        if (!hasAnySelectedFile(values?.options)) {
            toast.error("Selecione um arquivo para anexar antes de salvar.");
            return;
        }

        try {
            if (fileListId) {
                const { data } = await api.put(`/files/${fileListId}`, fileData)
                if (data.options.length > 0)

                    await uploadFiles(data.options, values.options, fileListId)
            } else {
                const { data } = await api.post("/files", fileData);
                if (data.options.length > 0)
                    await uploadFiles(data.options, values.options, data.id)
            }
            toast.success(i18n.t("fileModal.success"));
            if (typeof reload == 'function') {
                reload();
            }            
        } catch (err) {
            toastError(err);
        }
        handleClose();
    };

    const getUploadedUrl = (filename) => {
        try {
            const base = (api && api.defaults && api.defaults.baseURL) ? api.defaults.baseURL : "";
            if (!filename) return "";
            return `${String(base).replace(/\/+$/, "")}/uploads/files/${filename}`;
        } catch (_) {
            return "";
        }
    };

    return (
        <div className={classes.root}>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
                scroll="paper"
                classes={{ paper: classes.dialogPaper }}
                fullScreen={fullScreen}
            >
                <DialogTitle id="form-dialog-title" disableTypography>
                    <div className={classes.titleWrap}>
                        <div className={classes.titleIcon}>
                            <InsertDriveFileOutlinedIcon />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <p className={classes.titleText}>{modalTitle}</p>
                            <div className={classes.titleSub}>
                                Crie listas com arquivos e mensagens prontas para agilizar o atendimento.
                            </div>
                        </div>
                    </div>
                </DialogTitle>
                <Formik
                    initialValues={fileList}
                    enableReinitialize={true}
                    validationSchema={FileListSchema}
                    onSubmit={(values, actions) => {
                        setTimeout(() => {
                            handleSaveFileList(values);
                            actions.setSubmitting(false);
                        }, 400);
                    }}
                >
                    {({ touched, errors, isSubmitting, values, setFieldValue }) => (
                        <Form>
                            <DialogContent dividers>
                                <div className={classes.hintRow}>
                                    <div className={classes.hintIcon}>
                                        <InfoOutlinedIcon style={{ fontSize: 18 }} />
                                    </div>
                                    <div style={{ fontSize: 13, color: "rgba(15,23,42,0.72)", lineHeight: 1.4 }}>
                                        <div style={{ fontWeight: 900, marginBottom: 2 }}>Dica premium</div>
                                        Use uma mensagem padrão clara e adicione itens com arquivos e descrições objetivas.
                                    </div>
                                </div>

                                <div className={classes.sectionCard} style={{ marginBottom: 14 }}>
                                    <div className={classes.sectionTitle}>
                                        <InsertDriveFileOutlinedIcon style={{ fontSize: 16, opacity: 0.8 }} />
                                        Informações da lista
                                    </div>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12}>
                                            <Field
                                                as={TextField}
                                                label={i18n.t("fileModal.form.name")}
                                                name="name"
                                                error={touched.name && Boolean(errors.name)}
                                                helperText={touched.name && errors.name}
                                                variant="outlined"
                                                margin="dense"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Field
                                                as={TextField}
                                                label={i18n.t("fileModal.form.message")}
                                                type="message"
                                                multiline
                                                minRows={4}
                                                fullWidth
                                                name="message"
                                                error={touched.message && Boolean(errors.message)}
                                                helperText={touched.message && errors.message}
                                                variant="outlined"
                                                margin="dense"
                                            />
                                        </Grid>
                                    </Grid>
                                </div>

                                <div className={classes.sectionCard}>
                                    <div className={classes.sectionTitle}>
                                        <AttachFileIcon style={{ fontSize: 16, opacity: 0.8 }} />
                                        Itens da lista
                                    </div>

                                <FieldArray name="options">
                                    {({ push, remove }) => (
                                        <>
                                            {values.options &&
                                                values.options.length > 0 &&
                                                values.options.map((info, index) => (    
                                                    <div
                                                        className={classes.extraAttr}
                                                        key={`${index}-info`}
                                                    >
                                                        <Grid container spacing={1} className={classes.optionRow}>
                                                            <Grid xs={12} md={9} item> 
                                                                <Field
                                                                    as={TextField}
                                                                    label={i18n.t("fileModal.form.extraName")}
                                                                    name={`options[${index}].name`}
                                                                    variant="outlined"
                                                                    margin="dense"
                                                                    multiline
                                                                    fullWidth
                                                                    minRows={2}
                                                                    className={classes.textField}
                                                                />
                                                            </Grid>     
                                                            <Grid xs={12} md={3} item className={classes.optionActions}>
                                                                <span className={classes.attachWrap}>
                                                                    <TrButton
                                                                        className={classes.attachBtn}
                                                                        startIcon={<CloudUploadIcon />}
                                                                        component="span"
                                                                        variant="outlined"
                                                                    >
                                                                        Anexar
                                                                    </TrButton>
                                                                    <input
                                                                        type="file"
                                                                        className={classes.attachInputOverlay}
                                                                        onChange={(e) => {
                                                                            const selectedFile =
                                                                                e.target.files && e.target.files[0];
                                                                            setFieldValue(
                                                                                `options[${index}].file`,
                                                                                selectedFile
                                                                            );

                                                                            const updatedFileNames = [...selectedFileNames];
                                                                            updatedFileNames[index] = selectedFile
                                                                                ? selectedFile.name
                                                                                : "";
                                                                            setSelectedFileNames(updatedFileNames);
                                                                            if (selectedFile?.name) {
                                                                                toast.info(`Arquivo selecionado: ${selectedFile.name}`);
                                                                            }
                                                                            // allow selecting the same file again later
                                                                            try { e.target.value = ""; } catch (_) {}
                                                                        }}
                                                                    />
                                                                </span>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => remove(index)}
                                                                >
                                                                    <DeleteOutlineIcon />
                                                                </IconButton>    
                                                            </Grid>
                                                            <Grid xs={12} md={12} item className={classes.fileName}>
                                                                {(selectedFileNames[index] || info?.path) ? (
                                                                    <Chip
                                                                        size="small"
                                                                        icon={<AttachFileIcon />}
                                                                        label={selectedFileNames[index] || info.path}
                                                                        style={{
                                                                            maxWidth: "100%",
                                                                            justifyContent: "flex-start",
                                                                            background: "rgba(11, 76, 70, 0.06)",
                                                                            color: "var(--tr-primary)",
                                                                        }}
                                                                        onClick={() => {
                                                                            const url = getUploadedUrl(info?.path);
                                                                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                                                                        }}
                                                                        clickable={Boolean(info?.path)}
                                                                        deleteIcon={info?.path ? <OpenInNewIcon /> : undefined}
                                                                        onDelete={
                                                                            info?.path
                                                                                ? () => {
                                                                                    const url = getUploadedUrl(info?.path);
                                                                                    if (url) window.open(url, "_blank", "noopener,noreferrer");
                                                                                }
                                                                                : undefined
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <span style={{ opacity: 0.65 }}>
                                                                        Nenhum arquivo selecionado
                                                                    </span>
                                                                )}
                                                            </Grid> 
                                                        </Grid>                                                    
                                                </div>                     
                                                                                           
                                                ))}
                                            <div className={classes.extraAttr}>
                                                <TrButton
                                                    style={{ flex: 1, marginTop: 8 }}
                                                    onClick={() => {
                                                        push({ name: "", path: "" });
                                                        setSelectedFileNames([...selectedFileNames, ""]);
                                                    }}
                                                    startIcon={<AddCircleOutlineIcon />}
                                                >
                                                    {i18n.t("fileModal.buttons.fileOptions")}
                                                </TrButton>
                                            </div>
                                        </>
                                    )}
                                </FieldArray>
                                </div>
                            </DialogContent>
                            <DialogActions className={classes.actionsBar}>
                                <TrButton
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                    variant="outlined"
                                    className={classes.actionBtn}
                                >
                                    {i18n.t("fileModal.buttons.cancel")}
                                </TrButton>
                                <TrButton
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={classes.actionBtnPrimary}
                                >
                                    {fileListId
                                        ? `${i18n.t("fileModal.buttons.okEdit")}`
                                        : `${i18n.t("fileModal.buttons.okAdd")}`}
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

export default FilesModal;