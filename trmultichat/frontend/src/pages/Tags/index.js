import React, {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useContext,
} from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
// removed Button import after migrating to TrButton
import { TrButton } from "../../components/ui";
import IconButton from "@material-ui/core/IconButton";
import Grid from "@material-ui/core/Grid";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import SearchOutlinedIcon from "@material-ui/icons/SearchOutlined";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import LocalOfferOutlinedIcon from "@material-ui/icons/LocalOfferOutlined";
import AddCircleOutlineIcon from "@material-ui/icons/AddCircleOutline";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TagModal from "../../components/TagModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Chip } from "@material-ui/core";
import { socketConnection } from "../../services/socket";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_TAGS") {
    const tags = action.payload;
    const newTags = [];

    tags.forEach((tag) => {
      const tagIndex = state.findIndex((s) => s.id === tag.id);
      if (tagIndex !== -1) {
        state[tagIndex] = tag;
      } else {
        newTags.push(tag);
      }
    });

    return [...state, ...newTags];
  }

  if (action.type === "UPDATE_TAGS") {
    const tag = action.payload;
    const tagIndex = state.findIndex((s) => s.id === tag.id);

    if (tagIndex !== -1) {
      state[tagIndex] = tag;
      return [...state];
    } else {
      return [tag, ...state];
    }
  }

  if (action.type === "DELETE_TAG") {
    const tagId = action.payload;

    const tagIndex = state.findIndex((s) => s.id === tagId);
    if (tagIndex !== -1) {
      state.splice(tagIndex, 1);
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
    backgroundColor: "#F6F8FB",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#fff",
    },
  },
  actionBtn: {
    borderRadius: 12,
    fontWeight: 900,
    textTransform: "none",
    whiteSpace: "nowrap",
  },
  cardsGrid: {
    marginTop: theme.spacing(0.5),
  },
  card: {
    height: "100%",
    minHeight: 168,
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 100%)",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
    "&:hover": {
      borderColor: "rgba(15, 23, 42, 0.14)",
      boxShadow: "0 10px 22px rgba(15, 23, 42, 0.10)",
      transform: "translateY(-1px)",
    },
  },
  cardContent: {
    padding: theme.spacing(2),
    "&:last-child": {
      paddingBottom: theme.spacing(2),
    },
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    backgroundColor: "rgba(14, 116, 144, 0.10)",
    color: "rgba(14, 116, 144, 0.95)",
    flex: "none",
  },
  meta: {
    marginTop: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
  },
  tagChip: {
    borderRadius: 999,
    fontWeight: 800,
    maxWidth: "100%",
    "& .MuiChip-label": {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      display: "block",
    },
  },
  countChip: {
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.03)",
    color: "rgba(15, 23, 42, 0.78)",
  },
  actions: {
    justifyContent: "flex-end",
    paddingTop: 0,
  },
  emptyWrap: {
    borderRadius: 14,
    border: "1px dashed rgba(15, 23, 42, 0.18)",
    backgroundColor: "rgba(255,255,255,0.75)",
    padding: theme.spacing(4),
    textAlign: "center",
    marginTop: theme.spacing(2),
  },
  emptyIcon: {
    width: 56,
    height: 56,
    color: "rgba(15, 23, 42, 0.22)",
    margin: "0 auto 10px",
    display: "block",
  },
  skeletonCard: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    backgroundColor: "#fff",
    height: 130,
  },
}));

const Tags = () => {
  const classes = useStyles();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [tags, dispatch] = useReducer(reducer, []);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await api.get("/tags/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_TAGS", payload: data.tags });
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
      fetchTags();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, fetchTags]);

  useEffect(() => {
    const socket = socketConnection({ companyId: user.companyId });

    socket.on("user", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_TAGS", payload: data.tags });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.tagId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleOpenTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(true);
  };

  const handleCloseTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditTag = (tag) => {
    setSelectedTag(tag);
    setTagModalOpen(true);
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}`);
      toast.success(i18n.t("tags.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingTag(null);
    setSearchParam("");
    setPageNumber(1);

    dispatch({ type: "RESET" });
    setPageNumber(1);
    await fetchTags();
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
        title={deletingTag && `${i18n.t("tags.confirmationModal.deleteTitle")}`}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteTag(deletingTag.id)}
      >
        {i18n.t("tags.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <TagModal
        open={tagModalOpen}
        onClose={handleCloseTagModal}
        reload={fetchTags}
        aria-labelledby="form-dialog-title"
        tagId={selectedTag && selectedTag.id}
      />
      <MainHeader>
        <Title>{i18n.t("tags.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            variant="outlined"
            size="small"
            className={classes.searchField}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon style={{ color: "rgba(15, 23, 42, 0.55)" }} />
                </InputAdornment>
              ),
            }}
          />
          <TrButton className={classes.actionBtn} onClick={handleOpenTagModal} startIcon={<AddCircleOutlineIcon />}>
            {i18n.t("tags.buttons.add")}
          </TrButton>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={`${classes.mainPaper} tr-card-border`}
        variant="outlined"
        onScroll={handleScroll}
      >
        {tags.length === 0 && !loading ? (
          <div className={classes.emptyWrap}>
            <LocalOfferOutlinedIcon className={classes.emptyIcon} />
            <Typography style={{ fontWeight: 900, fontSize: 16, color: "rgba(15, 23, 42, 0.92)" }}>
              {i18n.t("tags.title")}
            </Typography>
            <Typography style={{ color: "rgba(15, 23, 42, 0.62)", fontSize: 13 }}>
              {i18n.t("contacts.searchPlaceholder")}
            </Typography>
          </div>
        ) : (
          <Grid container spacing={2} className={classes.cardsGrid}>
            {tags.map((tag) => (
              <Grid key={tag.id} item xs={12} sm={6} md={4} lg={3}>
                <Card className={classes.card} variant="outlined">
                  <CardContent className={classes.cardContent}>
                    <div className={classes.cardTop}>
                      <div className={classes.titleRow}>
                        <div className={classes.iconBadge}>
                          <LocalOfferOutlinedIcon style={{ fontSize: 22 }} />
                        </div>
                        <div style={{ minWidth: 0, width: "100%" }}>
                          <div className={classes.meta}>
                            <Chip
                              className={classes.tagChip}
                              variant="outlined"
                              style={{
                                backgroundColor: tag.color,
                                textShadow: "1px 1px 1px rgba(0,0,0,0.35)",
                                color: "white",
                              }}
                              label={tag.name}
                              size="small"
                            />
                            <Chip
                              className={classes.countChip}
                              variant="outlined"
                              size="small"
                              label={`${i18n.t("tags.table.tickets")}: ${tag.ticketsCount ?? 0}`}
                            />
                          </div>
                        </div>
                      </div>
                      <Box>
                        <IconButton size="small" onClick={() => handleEditTag(tag)} aria-label="Editar tag">
                          <EditOutlinedIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setDeletingTag(tag);
                          }}
                          aria-label="Excluir tag"
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                    </div>
                  </CardContent>
                  <CardActions className={classes.actions}>
                    {/* ações ficam nos ícones para não alterar comportamento */}
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

export default Tags;
