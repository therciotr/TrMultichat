import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import { TrButton } from "../../components/ui";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import FlashOnOutlinedIcon from "@material-ui/icons/FlashOnOutlined";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import AttachmentOutlinedIcon from "@material-ui/icons/AttachmentOutlined";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import QuickMessageDialog from "../../components/QuickMessageDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid, Typography, Chip, Box } from "@material-ui/core";
import { isArray } from "lodash";
import { socketConnection } from "../../services/socket";
import { AuthContext } from "../../context/Auth/AuthContext";


const reducer = (state, action) => {
  if (action.type === "LOAD_QUICKMESSAGES") {
    //console.log("aqui");
    //console.log(action);
    //console.log(action.payload);
    const quickmessages = action.payload;
    const newQuickmessages = [];
    //console.log(newQuickmessages);

    if (isArray(quickmessages)) {
      quickmessages.forEach((quickemessage) => {
        const quickemessageIndex = state.findIndex(
          (u) => u.id === quickemessage.id
        );
        if (quickemessageIndex !== -1) {
          state[quickemessageIndex] = quickemessage;
        } else {
          newQuickmessages.push(quickemessage);
        }
      });
    }

    return [...state, ...newQuickmessages];
  }

  if (action.type === "UPDATE_QUICKMESSAGES") {
    const quickemessage = action.payload;
    const quickemessageIndex = state.findIndex((u) => u.id === quickemessage.id);

    if (quickemessageIndex !== -1) {
      state[quickemessageIndex] = quickemessage;
      return [...state];
    } else {
      return [quickemessage, ...state];
    }
  }

  if (action.type === "DELETE_QUICKMESSAGE") {
    const quickemessageId = action.payload;

    const quickemessageIndex = state.findIndex((u) => u.id === quickemessageId);
    if (quickemessageIndex !== -1) {
      state.splice(quickemessageIndex, 1);
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
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
  },
  headerRow: {
    alignItems: "center",
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#fff",
    },
  },
  addButton: {
    borderRadius: 12,
    fontWeight: 800,
    textTransform: "none",
  },
  cardsGrid: {
    marginTop: theme.spacing(1),
  },
  card: {
    height: "100%",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
    "&:hover": {
      borderColor: "rgba(15, 23, 42, 0.14)",
      boxShadow: "0 10px 22px rgba(15, 23, 42, 0.10)",
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
    backgroundColor: "rgba(59, 130, 246, 0.10)",
    color: "rgba(30, 64, 175, 0.95)",
    flex: "none",
  },
  shortcode: {
    fontWeight: 900,
    fontSize: 14,
    color: "rgba(15, 23, 42, 0.92)",
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: theme.spacing(1),
  },
  messagePreview: {
    marginTop: theme.spacing(1.25),
    color: "rgba(15, 23, 42, 0.70)",
    fontSize: 13,
    lineHeight: 1.45,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  actions: {
    justifyContent: "flex-end",
    paddingTop: 0,
  },
  emptyWrap: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    backgroundColor: "#fff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
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
    color: "rgba(15, 23, 42, 0.22)",
  },
  skeletonCard: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    backgroundColor: "#fff",
    height: 140,
  },
}));

const Quickemessages = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedQuickemessage, setSelectedQuickemessage] = useState(null);
  const [deletingQuickemessage, setDeletingQuickemessage] = useState(null);
  const [quickemessageModalOpen, setQuickMessageDialogOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [quickemessages, dispatch] = useReducer(reducer, []);
  const { user } = useContext(AuthContext);
  const { profile } = user;

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchQuickemessages();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = user.companyId;
    const socket = socketConnection({ companyId, userId: user.id });

    socket.on(`company${companyId}-quickemessage`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUICKMESSAGES", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUICKMESSAGE", payload: +data.id });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchQuickemessages = async () => {
    try {
      const companyId = user.companyId;
      //const searchParam = ({ companyId, userId: user.id });
      const { data } = await api.get("/quick-messages", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_QUICKMESSAGES", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenQuickMessageDialog = () => {
    setSelectedQuickemessage(null);
    setQuickMessageDialogOpen(true);
  };

  const handleCloseQuickMessageDialog = () => {
    setSelectedQuickemessage(null);
    setQuickMessageDialogOpen(false);
    //window.location.reload();
    fetchQuickemessages();
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditQuickemessage = (quickemessage) => {
    //console.log(quickemessage);
    setSelectedQuickemessage(quickemessage);
    setQuickMessageDialogOpen(true);
  };

  const handleDeleteQuickemessage = async (quickemessageId) => {
    try {
      await api.delete(`/quick-messages/${quickemessageId}`);
      toast.success(i18n.t("quickemessages.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingQuickemessage(null);
    setSearchParam("");
    setPageNumber(1);
    fetchQuickemessages();
    dispatch({ type: "RESET" });

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

  return (
    <MainContainer>
      <ConfirmationModal
        title={deletingQuickemessage && `${i18n.t("quickMessages.confirmationModal.deleteTitle")} ${deletingQuickemessage.shortcode}?`}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteQuickemessage(deletingQuickemessage.id)}
      >
        {i18n.t("quickMessages.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QuickMessageDialog
        resetPagination={() => {
          setPageNumber(1);
          fetchQuickemessages();
        }}
        open={quickemessageModalOpen}
        onClose={handleCloseQuickMessageDialog}
        aria-labelledby="form-dialog-title"
        quickemessageId={selectedQuickemessage && selectedQuickemessage.id}
      />
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container className={classes.headerRow} spacing={2}>
          <Grid xs={12} sm={8} item>
            <Title>{i18n.t("quickMessages.title")}</Title>
          </Grid>
          <Grid xs={12} sm={4} item>
            <Grid spacing={2} container>
              <Grid xs={6} sm={6} item>
                <TextField
                  fullWidth
                  placeholder={i18n.t("quickMessages.searchPlaceholder")}
                  type="search"
                  value={searchParam}
                  onChange={handleSearch}
                  variant="outlined"
                  size="small"
                  className={classes.searchField}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "gray" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid xs={6} sm={6} item>
                <TrButton
                  fullWidth
                  className={classes.addButton}
                  onClick={handleOpenQuickMessageDialog}
                >
                  {i18n.t("quickMessages.buttons.add")}
                </TrButton>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        {quickemessages.length === 0 && !loading ? (
          <div className={classes.emptyWrap}>
            <FlashOnOutlinedIcon className={classes.emptyIcon} />
            <Typography style={{ fontWeight: 900, fontSize: 16 }}>
              {i18n.t("quickMessages.table.shortcode")}
            </Typography>
            <Typography style={{ color: "rgba(15, 23, 42, 0.65)", fontSize: 13 }}>
              {i18n.t("quickMessages.noAttachment")}
            </Typography>
          </div>
        ) : (
          <Grid container spacing={2} className={classes.cardsGrid}>
            {quickemessages.map((quickemessage) => (
              <Grid key={quickemessage.id} item xs={12} sm={6} md={4} lg={3}>
                <Card className={classes.card} variant="outlined">
                  <CardContent>
                    <div className={classes.cardTop}>
                      <div className={classes.cardTitleRow}>
                        <div className={classes.iconBadge}>
                          <FlashOnOutlinedIcon style={{ fontSize: 20 }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Typography className={classes.shortcode} noWrap>
                            {quickemessage.shortcode}
                          </Typography>
                          <div className={classes.meta}>
                            <Chip
                              size="small"
                              icon={<AttachmentOutlinedIcon />}
                              label={
                                quickemessage.mediaName ??
                                i18n.t("quickMessages.noAttachment")
                              }
                              variant="outlined"
                            />
                          </div>
                        </div>
                      </div>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleEditQuickemessage(quickemessage)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setDeletingQuickemessage(quickemessage);
                          }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                    </div>
                    <Typography className={classes.messagePreview}>
                      {quickemessage.message || "—"}
                    </Typography>
                  </CardContent>
                  <CardActions className={classes.actions}>
                    {/* mantém ações apenas via ícones (edit/delete) para não criar comportamento novo */}
                  </CardActions>
                </Card>
              </Grid>
            ))}

            {loading &&
              Array.from({ length: 8 }).map((_, idx) => (
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

export default Quickemessages;