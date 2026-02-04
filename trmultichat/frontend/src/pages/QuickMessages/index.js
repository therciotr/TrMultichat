import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { TrButton } from "../../components/ui";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import FlashOnOutlinedIcon from "@material-ui/icons/FlashOnOutlined";
import ContentCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import StarBorderOutlinedIcon from "@material-ui/icons/StarBorderOutlined";
import StarOutlinedIcon from "@material-ui/icons/StarOutlined";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import AttachmentOutlinedIcon from "@material-ui/icons/AttachmentOutlined";
import PersonOutlineOutlinedIcon from "@material-ui/icons/PersonOutlineOutlined";
import DateRangeOutlinedIcon from "@material-ui/icons/DateRangeOutlined";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import QuickMessageDialog from "../../components/QuickMessageDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid, Typography, Chip, Box, FormControl, InputLabel, MenuItem, Select } from "@material-ui/core";
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

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = `1px solid ${theme.palette.divider}`;
  const softShadow = isDark ? "0 18px 44px rgba(0,0,0,0.35)" : "0 14px 36px rgba(15, 23, 42, 0.06)";
  const cardShadow = isDark ? "0 10px 26px rgba(0,0,0,0.35)" : "0 10px 22px rgba(15, 23, 42, 0.10)";

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
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    backgroundColor: isDark ? "rgba(15,23,42,0.55)" : "#F8FAFC",
    borderRadius: 14,
    border,
  },
  headerRow: {
    alignItems: "center",
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "#fff",
    },
  },
  addButton: {
    borderRadius: 12,
    fontWeight: 800,
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
  cardsGrid: {
    marginTop: theme.spacing(1),
  },
  card: {
    height: "100%",
    borderRadius: 14,
    border,
    boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.45)" : "0 1px 2px rgba(15, 23, 42, 0.06)",
    transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
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
  shortcode: {
    fontWeight: 900,
    fontSize: 14,
    color: theme.palette.text.primary,
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: theme.spacing(1),
  },
  messagePreview: {
    marginTop: theme.spacing(1.25),
    color: theme.palette.text.secondary,
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
  actionIcon: {
    background: isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.04)",
    border,
    borderRadius: 12,
    padding: 6,
    "&:hover": {
      background: isDark ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.06)",
    },
  },
  searchIcon: {
    color: theme.palette.text.secondary,
    opacity: 0.95,
  },
  emptyTitle: {
    fontWeight: 900,
    fontSize: 16,
    color: theme.palette.text.primary,
  },
  emptySub: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
})});

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
  const companyId = user?.companyId;
  const userId = user?.id;
  const profile = String(user?.profile || "").toLowerCase();
  const isAdminLike = profile === "admin" || profile === "super" || Boolean(user?.admin) || Boolean(user?.super);

  const pinKey = `qm:pins:${companyId}:${userId || "me"}`;
  const usageKey = `qm:usage:${companyId}:${userId || "me"}`;
  const [pinnedMap, setPinnedMap] = useState({});
  const [usageMap, setUsageMap] = useState({});
  const [companyUsageMap, setCompanyUsageMap] = useState({});
  const [companyPinMap, setCompanyPinMap] = useState({});
  const [companyTop, setCompanyTop] = useState([]);
  const [statsRange, setStatsRange] = useState("total");
  const [statsUserId, setStatsUserId] = useState(0);
  const [users, setUsers] = useState([]);

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  useEffect(() => {
    if (!companyId) return;
    setPinnedMap(readJson(pinKey, {}));
    setUsageMap(readJson(usageKey, {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!companyId || !userId) return;
        const { data } = await api.get("/quick-messages/meta");
        if (!alive) return;
        const pinnedIds = Array.isArray(data?.pinnedIds) ? data.pinnedIds : [];
        const usageById = data?.usageById && typeof data.usageById === "object" ? data.usageById : {};
        const pinMap = {};
        for (const id of pinnedIds) {
          const k = String(Number(id || 0));
          if (k && k !== "0") pinMap[k] = true;
        }
        setPinnedMap(pinMap);
        setUsageMap({ ...(usageById || {}) });
        writeJson(pinKey, pinMap);
        writeJson(usageKey, { ...(usageById || {}) });

        if (isAdminLike) {
          const cu = data?.companyUsageById && typeof data.companyUsageById === "object" ? data.companyUsageById : {};
          const cp = data?.companyPinCountById && typeof data.companyPinCountById === "object" ? data.companyPinCountById : {};
          setCompanyUsageMap({ ...(cu || {}) });
          setCompanyPinMap({ ...(cp || {}) });
        } else {
          setCompanyUsageMap({});
          setCompanyPinMap({});
        }
      } catch (_) {
        // silent
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId, isAdminLike]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!isAdminLike) return;
        const params = {};
        if (statsRange && statsRange !== "total") params.range = statsRange;
        if (Number(statsUserId || 0) > 0) params.userId = Number(statsUserId);
        const { data } = await api.get("/quick-messages/stats", { params });
        if (!alive) return;
        setCompanyTop(Array.isArray(data?.top) ? data.top : []);
      } catch (_) {
        // silent
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdminLike, statsRange, statsUserId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!isAdminLike) return;
        const { data } = await api.get("/users/list");
        if (!alive) return;
        const arr = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
        setUsers(arr);
      } catch (_) {
        // silent
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdminLike]);

  const isPinned = (qm) => {
    const id = String(qm?.id ?? qm?.shortcode ?? "");
    return Boolean(pinnedMap?.[id]);
  };
  const usageCount = (qm) => {
    const id = String(qm?.id ?? qm?.shortcode ?? "");
    return Number(usageMap?.[id] || 0);
  };
  const companyUsageCount = (qm) => {
    const id = String(qm?.id ?? qm?.shortcode ?? "");
    return Number(companyUsageMap?.[id] || 0);
  };
  const companyPinCount = (qm) => {
    const id = String(qm?.id ?? qm?.shortcode ?? "");
    return Number(companyPinMap?.[id] || 0);
  };
  const togglePinned = (qm) => {
    const id = String(qm?.id ?? qm?.shortcode ?? "");
    if (!id) return;
    const willPin = !Boolean(pinnedMap?.[id]);
    setPinnedMap((prev) => {
      const next = { ...(prev || {}) };
      next[id] = willPin;
      if (!next[id]) delete next[id];
      writeJson(pinKey, next);
      return next;
    });
    (async () => {
      try {
        if (willPin) await api.post(`/quick-messages/pins/${Number(id)}`);
        else await api.delete(`/quick-messages/pins/${Number(id)}`);
      } catch (_) {
        // revert on failure
        setPinnedMap((prev) => {
          const next = { ...(prev || {}) };
          next[id] = !willPin;
          if (!next[id]) delete next[id];
          writeJson(pinKey, next);
          return next;
        });
      }
    })();
  };

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
    if (!companyId || !userId) return;
    const socket = socketConnection({ companyId, userId });

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
  }, [companyId, userId]);

  const fetchQuickemessages = async () => {
    try {
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

  const handleCopy = async (shortcode) => {
    try {
      const txt = `/${String(shortcode || "").trim()}`;
      await navigator.clipboard.writeText(txt);
      toast.success("Atalho copiado.");
    } catch (err) {
      toastError(err);
    }
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
        <Title>{i18n.t("quickMessages.title")}</Title>
      </MainHeader>
      <div
        className={classes.mainPaper}
        onScroll={handleScroll}
      >
        <div className={classes.hero}>
          <div className={classes.heroRow}>
            <div className={classes.heroIcon}>
              <FlashOnOutlinedIcon />
            </div>
            <div style={{ minWidth: 220 }}>
              <p className={classes.heroTitle}>Respostas Rápidas</p>
              <p className={classes.heroSub}>
                Use atalhos no atendimento para ganhar velocidade e padronizar mensagens.
              </p>
            </div>
            <Box flex={1} />
            <Chip size="small" label={`${quickemessages.length} atalhos`} style={{ fontWeight: 1000 }} />
          </div>
        </div>

        <div className={classes.hintCard}>
          <div className={classes.hintIcon}>
            <InfoOutlinedIcon style={{ fontSize: 18 }} />
          </div>
          <div className={classes.hintText}>
            <div style={{ fontWeight: 900, marginBottom: 2 }}>Como usar no chat</div>
            Digite <strong>/atalho</strong> e pressione <strong>Enter</strong> para enviar automaticamente (inclui anexos se houver).
          </div>
        </div>

        {isAdminLike && Array.isArray(companyTop) && companyTop.length ? (
          <div className={classes.hintCard} style={{ marginTop: 10 }}>
            <div className={classes.hintIcon}>
              <FlashOnOutlinedIcon style={{ fontSize: 18 }} />
            </div>
            <div className={classes.hintText} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ fontWeight: 900 }}>Ranking (empresa) · Mais usados</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
                    <InputLabel id="qm-range-label">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <DateRangeOutlinedIcon style={{ fontSize: 16, opacity: 0.8 }} />
                        Período
                      </span>
                    </InputLabel>
                    <Select
                      labelId="qm-range-label"
                      value={statsRange}
                      onChange={(e) => setStatsRange(String(e.target.value))}
                      label="Período"
                    >
                      <MenuItem value="total">Total</MenuItem>
                      <MenuItem value="today">Hoje</MenuItem>
                      <MenuItem value="7d">7 dias</MenuItem>
                      <MenuItem value="30d">30 dias</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl variant="outlined" size="small" style={{ minWidth: 220 }}>
                    <InputLabel id="qm-user-label">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <PersonOutlineOutlinedIcon style={{ fontSize: 16, opacity: 0.8 }} />
                        Usuário
                      </span>
                    </InputLabel>
                    <Select
                      labelId="qm-user-label"
                      value={Number(statsUserId || 0)}
                      onChange={(e) => setStatsUserId(Number(e.target.value) || 0)}
                      label="Usuário"
                    >
                      <MenuItem value={0}>Todos</MenuItem>
                      {(users || []).map((u) => (
                        <MenuItem key={`u-${u.id}`} value={Number(u.id)}>
                          {u.name || u.email || `Usuário #${u.id}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {companyTop.slice(0, 8).map((r) => (
                  <Chip
                    key={`top-${r.id}`}
                    size="small"
                    variant="outlined"
                    label={`/${r.shortcode} · ${Number(r.totalUses || 0)}`}
                    style={{ fontWeight: 900 }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <Grid container spacing={2} className={classes.headerRow} style={{ marginBottom: 8 }}>
          <Grid item xs={12} md={8}>
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
                    <SearchIcon className={classes.searchIcon} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TrButton fullWidth className={classes.addButton} onClick={handleOpenQuickMessageDialog}>
              {i18n.t("quickMessages.buttons.add")}
            </TrButton>
          </Grid>
        </Grid>

        {quickemessages.length === 0 && !loading ? (
          <div className={classes.emptyWrap}>
            <FlashOnOutlinedIcon className={classes.emptyIcon} />
            <Typography className={classes.emptyTitle}>
              {i18n.t("quickMessages.table.shortcode")}
            </Typography>
            <Typography className={classes.emptySub}>
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
                            {quickemessage.category ? (
                              <Chip
                                size="small"
                                label={String(quickemessage.category)}
                                variant="outlined"
                                style={{ fontWeight: 900 }}
                              />
                            ) : null}
                            {isPinned(quickemessage) ? (
                              <Chip
                                size="small"
                                icon={<StarOutlinedIcon />}
                                label="Fixado"
                                variant="outlined"
                                style={{ fontWeight: 900 }}
                              />
                            ) : null}
                            <Chip
                              size="small"
                              label={`Usos (você): ${usageCount(quickemessage)}`}
                              variant="outlined"
                              style={{ fontWeight: 900, opacity: 0.9 }}
                            />
                            {isAdminLike ? (
                              <>
                                <Chip
                                  size="small"
                                  label={`Usos (empresa): ${companyUsageCount(quickemessage)}`}
                                  variant="outlined"
                                  style={{ fontWeight: 900, opacity: 0.9 }}
                                />
                                <Chip
                                  size="small"
                                  label={`Fixados (empresa): ${companyPinCount(quickemessage)}`}
                                  variant="outlined"
                                  style={{ fontWeight: 900, opacity: 0.9 }}
                                />
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <Box>
                        <IconButton
                          size="small"
                          title={isPinned(quickemessage) ? "Desafixar" : "Fixar"}
                          onClick={() => togglePinned(quickemessage)}
                          className={classes.actionIcon}
                        >
                          {isPinned(quickemessage) ? <StarOutlinedIcon /> : <StarBorderOutlinedIcon />}
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Copiar atalho"
                          onClick={() => handleCopy(quickemessage.shortcode)}
                          className={classes.actionIcon}
                        >
                          <ContentCopyOutlinedIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEditQuickemessage(quickemessage)}
                          className={classes.actionIcon}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setDeletingQuickemessage(quickemessage);
                          }}
                          className={classes.actionIcon}
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
      </div>
    </MainContainer>
  );
};

export default Quickemessages;