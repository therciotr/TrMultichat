import React, { useState, useEffect, useReducer } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { TrButton } from "../../components/ui";
import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Typography,
  Chip,
  IconButton,
  TextField,
  InputAdornment
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import BusinessIcon from "@material-ui/icons/Business";
import PersonIcon from "@material-ui/icons/Person";
import EmailIcon from "@material-ui/icons/Email";
import SupervisorAccountIcon from "@material-ui/icons/SupervisorAccount";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { socketConnection } from "../../services/socket";

const reducer = (state, action) => {
  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  scrollArea: {
    flex: 1,
    overflowY: "auto",
    paddingBottom: theme.spacing(2),
    ...theme.scrollbarStyles
  },
  softCard: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)"
  },
  groupHeader: { paddingBottom: theme.spacing(1) },
  userCard: {
    height: "100%",
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: theme.shadows[4],
      borderColor: theme.palette.primary.main
    }
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  userName: {
    fontWeight: 900,
    lineHeight: 1.15,
    wordBreak: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    minWidth: 0
  },
  pill: { fontWeight: 900, borderRadius: 12 },
  pillPrimary: { backgroundColor: theme.palette.primary.main, color: "#fff" },
  metaRow: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(1.25)
  },
  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
    flex: "1 1 180px",
    minWidth: 180
  },
  metaLabel: { opacity: 0.75, fontWeight: 700, fontSize: 12, lineHeight: 1.2 },
  metaValue: { fontWeight: 900, fontSize: 13, lineHeight: 1.2, wordBreak: "break-word" },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(0.5),
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"
  },
  iconBtn: { borderRadius: 10 }
}));

const Users = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [users, dispatch] = useReducer(reducer, []);
  const [companiesById, setCompaniesById] = useState({});

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_USERS", payload: data.users });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    // Para agrupar por empresa com nome, buscamos /companies (permitido para master; para outras retorna a lista do tenant, ok)
    (async () => {
      try {
        const { data } = await api.get("/companies");
        const map = {};
        (Array.isArray(data) ? data : []).forEach((c) => {
          if (c && c.id !== undefined) map[c.id] = c;
        });
        setCompaniesById(map);
      } catch {
        setCompaniesById({});
      }
    })();
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });

    socket.on(`company-${companyId}-user`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_USERS", payload: data.user });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.userId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
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

  const grouped = users.reduce((acc, u) => {
    const cid = u && u.companyId !== undefined ? u.companyId : 0;
    if (!acc[cid]) acc[cid] = [];
    acc[cid].push(u);
    return acc;
  }, {});

  const companyIds = Object.keys(grouped)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${
            deletingUser.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <UserModal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        aria-labelledby="form-dialog-title"
        userId={selectedUser && selectedUser.id}
      />
      <MainHeader>
        <Title>{i18n.t("users.title")}</Title>
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
            size="small"
            variant="outlined"
          />
          <TrButton onClick={handleOpenUserModal}>
            {i18n.t("users.buttons.add")}
          </TrButton>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <div className={classes.scrollArea} onScroll={handleScroll}>
        <Grid container spacing={2}>
          {companyIds.map((companyIdKey) => {
            const company = companiesById[companyIdKey];
            const companyName = company?.name || (companyIdKey ? `Empresa ${companyIdKey}` : "Sem empresa");
            const list = grouped[companyIdKey] || [];
            return (
              <Grid item xs={12} key={companyIdKey}>
                <Card className={classes.softCard} elevation={0}>
                  <CardHeader
                    className={classes.groupHeader}
                    avatar={<BusinessIcon color="primary" />}
                    title={companyName}
                    subheader={`${list.length} usuário(s)`}
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      {list.map((user) => (
                        <Grid item xs={12} sm={6} md={4} key={user.id}>
                          <Card className={classes.userCard} elevation={0}>
                            <CardContent>
                              <div className={classes.titleRow}>
                                <Typography variant="subtitle1" className={classes.userName}>
                                  {user.name || "-"}
                                </Typography>
                                <Chip
                                  size="small"
                                  className={`${classes.pill} ${classes.pillPrimary}`}
                                  icon={<SupervisorAccountIcon fontSize="small" />}
                                  label={user.profile || "user"}
                                />
                              </div>

                              <div className={classes.metaRow}>
                                <div className={classes.metaItem}>
                                  <BusinessIcon fontSize="small" style={{ opacity: 0.85 }} />
                                  <div>
                                    <div className={classes.metaLabel}>Empresa</div>
                                    <div className={classes.metaValue}>
                                      {companiesById?.[user.companyId]?.name || `Empresa ${user.companyId || "-"}`}
                                    </div>
                                  </div>
                                </div>
                                <div className={classes.metaItem}>
                                  <EmailIcon fontSize="small" style={{ opacity: 0.85 }} />
                                  <div>
                                    <div className={classes.metaLabel}>E-mail</div>
                                    <div className={classes.metaValue}>{user.email || "-"}</div>
                                  </div>
                                </div>
                                <div className={classes.metaItem}>
                                  <PersonIcon fontSize="small" style={{ opacity: 0.85 }} />
                                  <div>
                                    <div className={classes.metaLabel}>ID</div>
                                    <div className={classes.metaValue}>{user.id}</div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>

                            <div className={classes.actions}>
                              <IconButton
                                className={classes.iconBtn}
                                size="small"
                                color="primary"
                                onClick={() => handleEditUser(user)}
                                aria-label={`Editar usuário ${user.name || ""}`}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                className={classes.iconBtn}
                                size="small"
                                style={{ color: "#d32f2f" }}
                                onClick={() => {
                                  setConfirmModalOpen(true);
                                  setDeletingUser(user);
                                }}
                                aria-label={`Excluir usuário ${user.name || ""}`}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </div>
                          </Card>
                        </Grid>
                      ))}
                      {loading ? (
                        <Grid item xs={12}>
                          <Typography variant="body2" style={{ opacity: 0.8 }}>
                            Carregando...
                          </Typography>
                        </Grid>
                      ) : null}
                      {!loading && list.length === 0 ? (
                        <Grid item xs={12}>
                          <Typography variant="body2" style={{ opacity: 0.8 }}>
                            Nenhum usuário encontrado.
                          </Typography>
                        </Grid>
                      ) : null}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}

          {!loading && users.length === 0 ? (
            <Grid item xs={12}>
              <Card className={classes.softCard} elevation={0}>
                <CardContent>
                  <Typography variant="body2" style={{ opacity: 0.8 }}>
                    Nenhum usuário encontrado.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : null}
        </Grid>
      </div>
    </MainContainer>
  );
};

export default Users;
