import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import {
    Formik,
    Form,
    Field,
    FieldArray
} from "formik";
import { toast } from "react-toastify";

import {
    Box,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    makeStyles,
    TextField
} from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import AddCircleOutlineIcon from "@material-ui/icons/AddCircleOutline";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";

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
        padding: theme.spacing(1),
        borderRadius: 12,
        border: "1px solid rgba(11, 76, 70, 0.14)",
        background: "rgba(11, 76, 70, 0.03)",
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
}));

const FileListSchema = Yup.object().shape({
    name: Yup.string()
        .min(3, "nome muito curto")
        .required("Obrigatório"),
    message: Yup.string()
        .required("Obrigatório")
});

const FilesModal = ({ open, onClose, fileListId, reload }) => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);
    const [selectedFileNames, setSelectedFileNames] = useState([]);


    const initialState = {
        name: "",
        message: "",
        options: [{ name: "", path:"", mediaType:"" }],
    };

    const [fileList, setFileList] = useState(initialState);

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

        const fileData = { ...values, userId: user.id };
        
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
                scroll="paper">
                <DialogTitle id="form-dialog-title">
                    {(fileListId ? `${i18n.t("fileModal.title.edit")}` : `${i18n.t("fileModal.title.add")}`)}
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
                                <div className={classes.multFieldLine}>
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
                                </div>
                                <br />
                                <div className={classes.multFieldLine}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("fileModal.form.message")}
                                        type="message"
                                        multiline
                                        minRows={5}
                                        fullWidth
                                        name="message"
                                        error={
                                            touched.message && Boolean(errors.message)
                                        }
                                        helperText={
                                            touched.message && errors.message
                                        }
                                        variant="outlined"
                                        margin="dense"
                                    />
                                </div>
                                <Typography
                                    style={{ marginBottom: 8, marginTop: 12 }}
                                    variant="subtitle1"
                                >
                                    {i18n.t("fileModal.form.fileOptions")}
                                </Typography>

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
                                                            <Grid xs={6} md={10} item> 
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
                                                            <Grid xs={6} md={2} item className={classes.optionActions}>
                                                                <TrButton
                                                                    className={classes.attachBtn}
                                                                    startIcon={<CloudUploadIcon />}
                                                                    component="label"
                                                                >
                                                                    Anexar
                                                                    <input
                                                                        type="file"
                                                                        className={classes.hiddenFileInput}
                                                                        onChange={(e) => {
                                                                            const selectedFile = e.target.files[0];
                                                                            setFieldValue(`options[${index}].file`, selectedFile);

                                                                            const updatedFileNames = [...selectedFileNames];
                                                                            updatedFileNames[index] = selectedFile ? selectedFile.name : "";
                                                                            setSelectedFileNames(updatedFileNames);
                                                                        }}
                                                                    />
                                                                </TrButton>
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
                            </DialogContent>
                            <DialogActions>
                                <TrButton
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                >
                                    {i18n.t("fileModal.buttons.cancel")}
                                </TrButton>
                                <TrButton
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={classes.btnWrapper}
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