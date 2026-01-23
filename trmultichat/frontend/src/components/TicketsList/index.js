import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import IconButton from "@material-ui/core/IconButton";
import Checkbox from "@material-ui/core/Checkbox";
import Tooltip from "@material-ui/core/Tooltip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import SelectAllIcon from "@material-ui/icons/SelectAll";
import CloseIcon from "@material-ui/icons/Close";

import TicketListItem from "../TicketListItem";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { ListSubheader } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { socketConnection } from "../../services/socket";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  ticketsListWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },

  ticketsList: {
    flex: 1,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    borderTop: "2px solid rgba(0, 0, 0, 0.12)",
  },

  ticketsListHeader: {
    color: "rgb(67, 83, 105)",
    zIndex: 2,
    backgroundColor: "white",
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ticketsCount: {
    fontWeight: "normal",
    color: "rgb(104, 121, 146)",
    marginLeft: "8px",
    fontSize: "14px",
  },

  noTicketsText: {
    textAlign: "center",
    color: "rgb(104, 121, 146)",
    fontSize: "14px",
    lineHeight: "1.4",
  },

  noTicketsTitle: {
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0px",
  },

  noTicketsDiv: {
    display: "flex",
    height: "100px",
    margin: 40,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_TICKETS") {
    const newTickets = action.payload;

    newTickets.forEach((ticket) => {
      const ticketIndex = state.findIndex((t) => t.id === ticket.id);
      if (ticketIndex !== -1) {
        state[ticketIndex] = ticket;
        if (ticket.unreadMessages > 0) {
          state.unshift(state.splice(ticketIndex, 1)[0]);
        }
      } else {
        state.push(ticket);
      }
    });

    return [...newTickets];
  }

  if (action.type === "RESET_UNREAD") {
    const ticketId = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].unreadMessages = 0;
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET") {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_CONTACT") {
    const contact = action.payload;
    const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
    if (ticketIndex !== -1) {
      state[ticketIndex].contact = contact;
    }
    return [...state];
  }

  if (action.type === "DELETE_TICKET") {
    const ticketId = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const TicketsList = ({
  status,
  searchParam,
  tags,
  showAll,
  selectedQueueIds,
}) => {
  const classes = useStyles();
  const [pageNumber, setPageNumber] = useState(1);
  const [ticketsList, dispatch] = useReducer(reducer, []);
  const { user } = useContext(AuthContext);
  const isAdmin = useMemo(() => {
    const p = String(user?.profile || "").toLowerCase();
    return Boolean(user?.admin) || p === "admin" || p === "super";
  }, [user]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    setSelectionMode(false);
    setSelectedIds([]);
  }, [status, searchParam, dispatch, showAll, selectedQueueIds]);

  const { tickets, hasMore, loading } = useTickets({
    pageNumber,
    searchParam,
    tags: JSON.stringify(tags),
    status,
    showAll,
    queueIds: JSON.stringify(selectedQueueIds),
  });

  useEffect(() => {
    if (!status && !searchParam) return;
    dispatch({
      type: "LOAD_TICKETS",
      payload: tickets,
    });
  }, [tickets, status, searchParam]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });

    const hasQueueFilter = Array.isArray(selectedQueueIds) && selectedQueueIds.length > 0;
    const shouldUpdateTicket = (ticket) =>
      (!ticket.userId || ticket.userId === user?.id || showAll) &&
      (!hasQueueFilter || !ticket.queueId || selectedQueueIds.indexOf(ticket.queueId) > -1);

    const notBelongsToUserQueues = (ticket) =>
      hasQueueFilter && ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

    socket.on("connect", () => {
      if (status) {
        socket.emit("joinTickets", status);
      } else {
        socket.emit("joinNotification");
      }
    });

    socket.on(`company-${companyId}-ticket`, (data) => {
      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD",
          payload: data.ticketId,
        });
      }

      if (data.action === "update" && shouldUpdateTicket(data.ticket)) {
        dispatch({
          type: "UPDATE_TICKET",
          payload: data.ticket,
        });
      }

      if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
        dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TICKET", payload: data.ticketId });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      // This socket event is also used by MessagesList ({ action, message }).
      // Tickets list should ignore events that don't include a ticket payload.
      const t = data?.ticket;
      if (!t) return;

      if (data.action === "create" && shouldUpdateTicket(t)) {
        dispatch({
          type: "UPDATE_TICKET_UNREAD_MESSAGES",
          payload: t,
        });
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_TICKET_CONTACT",
          payload: data.contact,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [status, showAll, user, selectedQueueIds]);

  const visibleTicketIds = useMemo(() => (Array.isArray(ticketsList) ? ticketsList.map((t) => t.id) : []), [ticketsList]);
  const allVisibleSelected = useMemo(() => {
    if (!visibleTicketIds.length) return false;
    return visibleTicketIds.every((id) => selectedIds.includes(id));
  }, [visibleTicketIds, selectedIds]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (!visibleTicketIds.length) return prev;
      const allSelected = visibleTicketIds.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !visibleTicketIds.includes(id));
      const next = new Set(prev);
      visibleTicketIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if (!ids.length) return;
    try {
      await api.request({ method: "DELETE", url: "/tickets/bulk", data: { ids } });
      ids.forEach((id) => dispatch({ type: "DELETE_TICKET", payload: id }));
      setSelectedIds([]);
      setSelectionMode(false);
      setConfirmBulkOpen(false);
    } catch (err) {
      setConfirmBulkOpen(false);
      toastError(err);
    }
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
    <div className={classes.ticketsListWrapper}>
      {isAdmin && (
        <>
          <ConfirmationModal
            title={`Excluir ${selectedIds.length} ticket(s)?`}
            open={confirmBulkOpen}
            onClose={setConfirmBulkOpen}
            onConfirm={handleBulkDelete}
          >
            Essa ação é permanente e remove mensagens/anotações relacionadas.
          </ConfirmationModal>
        </>
      )}
      <Paper
        square
        name="closed"
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List style={{ paddingTop: 0 }}>
          {status === "open" && (
            <ListSubheader className={classes.ticketsListHeader}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div>
                {i18n.t("ticketsList.assignedHeader")}
                <span className={classes.ticketsCount}>
                  {ticketsList.length}
                </span>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {!selectionMode ? (
                      <Tooltip title="Selecionar tickets">
                        <IconButton size="small" onClick={() => setSelectionMode(true)}>
                          <SelectAllIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip title="Sair da seleção">
                          <IconButton size="small" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Checkbox checked={allVisibleSelected} onChange={handleSelectAllVisible} color="primary" />
                        <Tooltip title="Excluir selecionados">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => setConfirmBulkOpen(true)}
                              disabled={!selectedIds.length}
                              style={{ color: selectedIds.length ? "#DC2626" : undefined }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </div>
                )}
              </div>
            </ListSubheader>
          )}
          {status === "pending" && (
            <ListSubheader className={classes.ticketsListHeader}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div>
                {i18n.t("ticketsList.pendingHeader")}
                <span className={classes.ticketsCount}>
                  {ticketsList.length}
                </span>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {!selectionMode ? (
                      <Tooltip title="Selecionar tickets">
                        <IconButton size="small" onClick={() => setSelectionMode(true)}>
                          <SelectAllIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip title="Sair da seleção">
                          <IconButton size="small" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Checkbox checked={allVisibleSelected} onChange={handleSelectAllVisible} color="primary" />
                        <Tooltip title="Excluir selecionados">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => setConfirmBulkOpen(true)}
                              disabled={!selectedIds.length}
                              style={{ color: selectedIds.length ? "#DC2626" : undefined }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </div>
                )}
              </div>
            </ListSubheader>
          )}
          {status === "closed" && (
            <ListSubheader className={classes.ticketsListHeader}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div>
                  {i18n.t("ticketsList.closedHeader") || "Resolvidos"}
                  <span className={classes.ticketsCount}>
                    {ticketsList.length}
                  </span>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {!selectionMode ? (
                      <Tooltip title="Selecionar tickets">
                        <IconButton size="small" onClick={() => setSelectionMode(true)}>
                          <SelectAllIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip title="Sair da seleção">
                          <IconButton size="small" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Checkbox checked={allVisibleSelected} onChange={handleSelectAllVisible} color="primary" />
                        <Tooltip title="Excluir selecionados">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => setConfirmBulkOpen(true)}
                              disabled={!selectedIds.length}
                              style={{ color: selectedIds.length ? "#DC2626" : undefined }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </div>
                )}
              </div>
            </ListSubheader>
          )}
          {ticketsList.length === 0 && !loading ? (
            <div className={classes.noTicketsDiv}>
              <span className={classes.noTicketsTitle}>
                {i18n.t("ticketsList.noTicketsTitle")}
              </span>
              <p className={classes.noTicketsText}>
                {i18n.t("ticketsList.noTicketsMessage")}
              </p>
            </div>
          ) : (
            <>
              {ticketsList.map((ticket) => (
                <TicketListItem
                  ticket={ticket}
                  key={ticket.id}
                  selectionMode={selectionMode}
                  selected={selectedIds.includes(ticket.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </>
          )}
          {loading && <TicketsListSkeleton />}
        </List>
      </Paper>
    </div>
  );
};

export default TicketsList;
