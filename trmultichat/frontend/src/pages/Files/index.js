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
import InsertDriveFileOutlinedIcon from "@material-ui/icons/InsertDriveFileOutlined";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import AttachFileIcon from "@material-ui/icons/AttachFile";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
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

const useStyles = makeStyles((theme) => {
    const isDark = theme.palette.type === "dark";
    const border = `1px solid ${theme.palette.divider}`;
    const softShadow = isDark ? "0 18px 44px rgba(0,0,0,0.35)" : "0 14px 36px rgba(15, 23, 42, 0.06)";
    const cardShadow = isDark ? "0 10px 26px rgba(0,0,0,0.38)" : "0 10px 22px rgba(15, 23, 42, 0.10)";

    return ({
    hero: {
        borderRadius: 18,
        border,
        boxShadow: softShadow,
        background: isDark
            ? "linear-gradient(135deg, rgba(var(--tr-heading-rgb, 11, 76, 70), 0.18), rgba(var(--tr-secondary-rgb, 43, 169, 165), 0.12) 52%, rgba(15,23,42,0.88))"
            : "linear-gradient(135deg, rgba(var(--tr-heading-rgb, 11, 76, 70), 0.14), rgba(var(--tr-secondary-rgb, 43, 169, 165), 0.10) 52%, rgba(255,255,255,0.96))",
        padding: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    heroRow: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1.25),
        flexWrap: "wrap",
    },
    heroIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        background: "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.12)",
        border: "1px solid rgba(var(--tr-heading-rgb, 11, 76, 70), 0.16)",
        color: "var(--tr-heading, var(--tr-primary))",
        flexShrink: 0,
    },
    heroTitle: {
        fontSize: 16,
        fontWeight: 1000,
        margin: 0,
        color: "var(--tr-heading, var(--tr-primary))",
    },
    heroSub: {
        marginTop: 4,
        marginBottom: 0,
        fontSize: 13,
        color: "var(--tr-muted, rgba(15,23,42,0.65))",
    },
    mainPaper: {
        flex: 1,
        padding: theme.spacing(2),
        overflowY: "auto",
        ...theme.scrollbarStyles,
        backgroundColor: isDark ? "rgba(15,23,42,0.55)" : "#F8FAFC",
        borderRadius: 14,
        border,
    },
    headerRow: { alignItems: "center" },
    searchField: {
        "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "#fff",
        },
    },
    addButton: {
        borderRadius: 12,
        fontWeight: 900,
        textTransform: "none",
    },
    hintCard: {
        borderRadius: 14,
        border,
        background: theme.palette.background.paper,
        padding: theme.spacing(1.5),
        display: "flex",
        alignItems: "flex-start",
        gap: theme.spacing(1.25),
        marginBottom: theme.spacing(1.5),
    },
    hintIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        background: "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.10)",
        color: "var(--tr-heading, var(--tr-primary))",
        flex: "0 0 auto",
    },
    hintText: {
        fontSize: 13,
        color: theme.palette.text.secondary,
        lineHeight: 1.45,
    },
    card: {
        height: "100%",
        borderRadius: 14,
        border,
        boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.45)" : "0 1px 2px rgba(15, 23, 42, 0.06)",
        background:
            isDark
                ? "linear-gradient(180deg, rgba(var(--tr-heading-rgb, 11, 76, 70), 0.12), rgba(15,23,42,0.92) 42%)"
                : "linear-gradient(180deg, rgba(var(--tr-heading-rgb, 11, 76, 70), 0.06), rgba(255,255,255,1) 42%)",
        transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
        padding: theme.spacing(2),
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1.25),
        minWidth: 0,
        cursor: "pointer",
        "&:hover": {
            borderColor: isDark ? "rgba(148,163,184,0.32)" : "rgba(15, 23, 42, 0.14)",
            boxShadow: cardShadow,
            transform: "translateY(-1px)",
        },
    },
    cardTop: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: theme.spacing(1),
    },
    cardTitleRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
    },
    iconBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        backgroundColor: "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.10)",
        color: "var(--tr-heading, var(--tr-primary))",
        flex: "none",
    },
    cardTitle: {
        fontWeight: 1000,
        color: theme.palette.text.primary,
        minWidth: 0,
    },
    cardActions: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
    },
    actionIcon: {
        background: isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.04)",
        border,
        borderRadius: 12,
        padding: 6,
        "&:hover": {
            background: isDark ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.06)",
        },
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
    emptyWrap: {
        borderRadius: 14,
        border,
        backgroundColor: theme.palette.background.paper,
        boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.45)" : "0 1px 2px rgba(15, 23, 42, 0.06)",
        padding: theme.spacing(4),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: theme.spacing(1),
        textAlign: "center",
        marginTop: theme.spacing(2),
    },
    emptyIcon: {
        width: 52,
        height: 52,
        color: isDark ? "rgba(148,163,184,0.35)" : "rgba(15, 23, 42, 0.22)",
    },
    skeletonCard: {
        borderRadius: 14,
        border,
        backgroundColor: theme.palette.background.paper,
        height: 140,
    },
    searchIcon: { color: theme.palette.text.secondary, opacity: 0.95 },
    emptyTitle: { fontWeight: 900, fontSize: 16, color: theme.palette.text.primary },
    emptySub: { color: theme.palette.text.secondary, fontSize: 13 },
})});

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
    const totalItems = (Array.isArray(files) ? files : []).reduce((sum, f) => sum + getOptionsCount(f), 0);

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
                <Title>{i18n.t("files.title")}</Title>
            </MainHeader>
            <Paper
                className={classes.mainPaper}
                variant="outlined"
                onScroll={handleScroll}
            >
                <div className={classes.hero}>
                    <div className={classes.heroRow}>
                        <div className={classes.heroIcon}>
                            <InsertDriveFileOutlinedIcon />
                        </div>
                        <div style={{ minWidth: 220 }}>
                            <p className={classes.heroTitle}>Lista de arquivos</p>
                            <p className={classes.heroSub}>
                                Centralize seus anexos e mensagens prontas para o atendimento.
                            </p>
                        </div>
                        <Box flex={1} />
                        <Chip size="small" label={`${files.length} listas`} style={{ fontWeight: 1000 }} />
                        <Chip size="small" label={`${totalItems} itens`} style={{ fontWeight: 1000 }} />
                    </div>
                </div>

                <div className={classes.hintCard}>
                    <div className={classes.hintIcon}>
                        <InfoOutlinedIcon style={{ fontSize: 18 }} />
                    </div>
                    <div className={classes.hintText}>
                        <div style={{ fontWeight: 900, marginBottom: 2 }}>Dica</div>
                        Organize por listas (ex.: <strong>Documentos</strong>, <strong>Contratos</strong>, <strong>Boletos</strong>) para achar mais rápido.
                    </div>
                </div>

                <Grid container spacing={2} className={classes.headerRow} style={{ marginBottom: 8 }}>
                    <Grid item xs={12} md={8}>
                        <TextField
                            fullWidth
                            placeholder={i18n.t("files.searchPlaceholder")}
                            type="search"
                            value={searchParam}
                            onChange={handleSearch}
                            variant="outlined"
                            size="small"
                            className={classes.searchField}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon className={classes.searchIcon} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TrButton fullWidth className={classes.addButton} onClick={handleOpenFileListModal}>
                            {i18n.t("files.buttons.add")}
                        </TrButton>
                    </Grid>
                </Grid>

                {!loading && files.length === 0 && (
                    <div className={classes.emptyWrap}>
                        <InsertDriveFileOutlinedIcon className={classes.emptyIcon} />
                        <Typography className={classes.emptyTitle}>
                            Nenhuma lista cadastrada
                        </Typography>
                        <Typography className={classes.emptySub}>
                            Clique em <strong>Adicionar</strong> para criar sua primeira lista de arquivos.
                        </Typography>
                        <Box style={{ marginTop: 10, width: "min(360px, 100%)" }}>
                            <TrButton fullWidth className={classes.addButton} onClick={handleOpenFileListModal}>
                                {i18n.t("files.buttons.add")}
                            </TrButton>
                        </Box>
                    </div>
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
                                        <div className={classes.cardTop}>
                                            <div className={classes.cardTitleRow}>
                                                <div className={classes.iconBadge}>
                                                    <AttachFileIcon style={{ fontSize: 18 }} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <Typography className={classes.cardTitle} variant="subtitle1" noWrap>
                                                        {fileList.name}
                                                    </Typography>
                                                    <div className={classes.metaRow}>
                                                        <Chip
                                                            size="small"
                                                            label={`Itens: ${optionsCount}`}
                                                            variant="outlined"
                                                            style={{ fontWeight: 900 }}
                                                        />
                                                        <Chip size="small" label={`ID: ${fileList.id}`} variant="outlined" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={classes.cardActions} onClick={(e) => e.stopPropagation()}>
                                                <Tooltip title="Editar">
                                                    <IconButton
                                                        size="small"
                                                        className={classes.actionIcon}
                                                        onClick={() => handleEditFileList(fileList)}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Excluir">
                                                    <IconButton
                                                        size="small"
                                                        className={classes.actionIcon}
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

                                        <Box style={{ marginTop: 2 }}>
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

                {loading && (
                    <Grid container spacing={2}>
                        {Array.from({ length: 8 }).map((_, idx) => (
                            <Grid key={`sk-${idx}`} item xs={12} sm={6} md={4} lg={3}>
                                <div className={classes.skeletonCard} />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Paper>
        </MainContainer>
    );
};

export default FileLists;
