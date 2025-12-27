import React, {
    useState,
    useEffect,
    useReducer,
    useCallback,
    useContext,
} from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { Box, Chip, Grid, Tooltip, Typography } from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
// removed Button import after migrating to TrButton
import { TrButton } from "../../components/ui";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import AttachFileIcon from "@material-ui/icons/AttachFile";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import FileModal from "../../components/FileModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { socketConnection } from "../../services/socket";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
    if (action.type === "LOAD_FILES") {
        const files = action.payload;
        const newFiles = [];

        files.forEach((fileList) => {
            const fileListIndex = state.findIndex((s) => s.id === fileList.id);
            if (fileListIndex !== -1) {
                state[fileListIndex] = fileList;
            } else {
                newFiles.push(fileList);
            }
        });

        return [...state, ...newFiles];
    }

    if (action.type === "UPDATE_FILES") {
        const fileList = action.payload;
        const fileListIndex = state.findIndex((s) => s.id === fileList.id);

        if (fileListIndex !== -1) {
            state[fileListIndex] = fileList;
            return [...state];
        } else {
            return [fileList, ...state];
        }
    }

    if (action.type === "DELETE_FILE") {
        const fileListId = action.payload;

        const fileListIndex = state.findIndex((s) => s.id === fileListId);
        if (fileListIndex !== -1) {
            state.splice(fileListIndex, 1);
        }
        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const useStyles = makeStyles((theme) => ({
    mainPaper: {
        flex: 1,
        padding: theme.spacing(2),
        overflowY: "auto",
        ...theme.scrollbarStyles,
    },
    headerRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(1),
    },
    card: {
        padding: theme.spacing(2),
        borderRadius: 14,
        border: "1px solid rgba(11, 76, 70, 0.18)",
        background:
            "linear-gradient(180deg, rgba(11, 76, 70, 0.045), rgba(255,255,255,1) 42%)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1.25),
        minWidth: 0,
        cursor: "pointer",
    },
    cardTitle: {
        fontWeight: 800,
        color: "var(--tr-primary)",
        minWidth: 0,
    },
    cardActions: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
    },
    metaRow: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: theme.spacing(1),
    },
    clamp2: {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
        wordBreak: "break-word",
    },
    emptyState: {
        padding: theme.spacing(4),
        textAlign: "center",
        color: theme.palette.text.secondary,
    },
}));

const FileLists = () => {
    const classes = useStyles();

    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [selectedFileList, setSelectedFileList] = useState(null);
    const [deletingFileList, setDeletingFileList] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const [files, dispatch] = useReducer(reducer, []);
    const [fileListModalOpen, setFileListModalOpen] = useState(false);

    const fetchFileLists = useCallback(async () => {
        try {
            const { data } = await api.get("/files/", {
                params: { searchParam, pageNumber },
            });
            dispatch({ type: "LOAD_FILES", payload: data.files });
            setHasMore(data.hasMore);
            setLoading(false);
        } catch (err) {
            toastError(err);
        }
    }, [searchParam, pageNumber]);

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [searchParam]);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            fetchFileLists();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchParam, pageNumber, fetchFileLists]);

    useEffect(() => {
        const socket = socketConnection({ companyId: user.companyId });

        socket.on(`company-${user.companyId}-file`, (data) => {
            if (data.action === "update" || data.action === "create") {
                dispatch({ type: "UPDATE_FILES", payload: data.files || data.file || data.record });
            }

            if (data.action === "delete") {
                dispatch({ type: "DELETE_FILE", payload: +data.fileId });
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [user]);

    const handleOpenFileListModal = () => {
        setSelectedFileList(null);
        setFileListModalOpen(true);
    };

    const handleCloseFileListModal = () => {
        setSelectedFileList(null);
        setFileListModalOpen(false);
    };

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase());
    };

    const handleEditFileList = (fileList) => {
        setSelectedFileList(fileList);
        setFileListModalOpen(true);
    };

    const handleDeleteFileList = async (fileListId) => {
        try {
            await api.delete(`/files/${fileListId}`);
            toast.success(i18n.t("files.toasts.deleted"));
        } catch (err) {
            toastError(err);
        }
        setDeletingFileList(null);
        setSearchParam("");
        setPageNumber(1);

        dispatch({ type: "RESET" });
        setPageNumber(1);
        await fetchFileLists();
    };

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - (scrollTop + 100) < clientHeight) {
            loadMore();
        }
    };

    const getOptionsCount = (fileList) => {
        const opts = fileList?.options;
        if (Array.isArray(opts)) return opts.length;
        return 0;
    };

    return (
        <MainContainer>
            <ConfirmationModal
                title={deletingFileList && `${i18n.t("files.confirmationModal.deleteTitle")}`}
                open={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={() => handleDeleteFileList(deletingFileList.id)}
            >
                {i18n.t("files.confirmationModal.deleteMessage")}
            </ConfirmationModal>
            <FileModal
                open={fileListModalOpen}
                onClose={handleCloseFileListModal}
                reload={fetchFileLists}
                aria-labelledby="form-dialog-title"
                fileListId={selectedFileList && selectedFileList.id}
            />
            <MainHeader>
                <Title>{i18n.t("files.title")} ({files.length})</Title>
                <MainHeaderButtonsWrapper>
                    <TextField
                        placeholder={i18n.t("contacts.searchPlaceholder")}
                        type="search"
                        value={searchParam}
                        onChange={handleSearch}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon style={{ color: "gray" }} />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TrButton onClick={handleOpenFileListModal}>
                        {i18n.t("files.buttons.add")}
                    </TrButton>
                </MainHeaderButtonsWrapper>
            </MainHeader>
      <Paper
        className={`${classes.mainPaper} tr-card-border`}
                variant="outlined"
                onScroll={handleScroll}
            >
                {loading && (
                    <Box className={classes.emptyState}>
                        <Typography variant="body2">Carregando arquivos...</Typography>
                    </Box>
                )}

                {!loading && files.length === 0 && (
                    <Box className={classes.emptyState}>
                        <Typography variant="h6" style={{ fontWeight: 800, color: "var(--tr-primary)" }}>
                            Nenhum arquivo cadastrado
                        </Typography>
                        <Typography variant="body2" style={{ marginTop: 8 }}>
                            Clique em <b>Adicionar</b> para criar sua primeira lista de arquivos.
                        </Typography>
                        <Box style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                            <TrButton onClick={handleOpenFileListModal}>
                                {i18n.t("files.buttons.add")}
                            </TrButton>
                        </Box>
                    </Box>
                )}

                {!loading && files.length > 0 && (
                    <Grid container spacing={2}>
                        {files.map((fileList) => {
                            const optionsCount = getOptionsCount(fileList);
                            return (
                                <Grid key={fileList.id} item xs={12} sm={6} md={4} lg={3}>
                                    <Paper
                                        className={classes.card}
                                        variant="outlined"
                                        onClick={() => handleEditFileList(fileList)}
                                    >
                                        <div className={classes.headerRow}>
                                            <Box style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                                <AttachFileIcon style={{ color: "var(--tr-primary)" }} />
                                                <Typography className={classes.cardTitle} variant="subtitle1" noWrap>
                                                    {fileList.name}
                                                </Typography>
                                            </Box>
                                            <div className={classes.cardActions} onClick={(e) => e.stopPropagation()}>
                                                <Tooltip title="Editar">
                                                    <IconButton size="small" onClick={() => handleEditFileList(fileList)}>
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Excluir">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setConfirmModalOpen(true);
                                                            setDeletingFileList(fileList);
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </div>
                                        </div>

                                        <div className={classes.metaRow}>
                                            <Chip
                                                size="small"
                                                label={`Itens: ${optionsCount}`}
                                                style={{
                                                    background: "rgba(11, 76, 70, 0.08)",
                                                    color: "var(--tr-primary)",
                                                    fontWeight: 700,
                                                }}
                                            />
                                            <Chip size="small" label={`ID: ${fileList.id}`} />
                                        </div>

                                        <Box style={{ marginTop: 4 }}>
                                            <Typography variant="caption" color="textSecondary" style={{ fontWeight: 700 }}>
                                                Mensagem
                                            </Typography>
                                            <Typography variant="body2" className={classes.clamp2}>
                                                {fileList.message || "-"}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Paper>
        </MainContainer>
    );
};

export default FileLists;
