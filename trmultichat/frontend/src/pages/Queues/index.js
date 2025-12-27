import React, { useEffect, useReducer, useState } from "react";

import {
  Box,
  Chip,
  Grid,
  IconButton,
  makeStyles,
  Paper,
  Typography,
} from "@material-ui/core";
import { TrButton } from "../../components/ui";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit } from "@material-ui/icons";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { socketConnection } from "../../services/socket";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
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
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: "1px solid rgba(0,0,0,0.12)",
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

const reducer = (state, action) => {
  if (action.type === "LOAD_QUEUES") {
    const queues = action.payload;
    const newQueues = [];

    queues.forEach((queue) => {
      const queueIndex = state.findIndex((q) => q.id === queue.id);
      if (queueIndex !== -1) {
        state[queueIndex] = queue;
      } else {
        newQueues.push(queue);
      }
    });

    return [...state, ...newQueues];
  }

  if (action.type === "UPDATE_QUEUES") {
    const queue = action.payload;
    const queueIndex = state.findIndex((u) => u.id === queue.id);

    if (queueIndex !== -1) {
      state[queueIndex] = queue;
      return [...state];
    } else {
      return [queue, ...state];
    }
  }

  if (action.type === "DELETE_QUEUE") {
    const queueId = action.payload;
    const queueIndex = state.findIndex((q) => q.id === queueId);
    if (queueIndex !== -1) {
      state.splice(queueIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Queues = () => {
  const classes = useStyles();

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const loadQueues = async () => {
    setLoading(true);
    try {
      let { data } = await api.get("/queue");
      // Fallback DEV endpoint if default returns vazio
      if (!Array.isArray(data) || data.length === 0) {
        try {
          const alt = await api.get("/queue-list");
          data = alt.data;
        } catch (_) {}
      }
      dispatch({ type: "RESET" });
      dispatch({ type: "LOAD_QUEUES", payload: Array.isArray(data) ? data : [] });
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };
  useEffect(() => { loadQueues(); }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });

    socket.on(`company-${companyId}-queue`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenQueueModal = () => {
    setQueueModalOpen(true);
    setSelectedQueue(null);
  };

  const handleCloseQueueModal = () => {
    setQueueModalOpen(false);
    setSelectedQueue(null);
    // refetch to ensure UI reflects saved data even if socket didn't fire
    loadQueues();
  };

  const handleEditQueue = (queue) => {
    setSelectedQueue(queue);
    setQueueModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (queueId) => {
    try {
      await api.delete(`/queue/${queueId}`);
      toast.success(i18n.t("Queue deleted successfully!"));
    } catch (err) {
      toastError(err);
    }
    setSelectedQueue(null);
  };

  const renderChips = (queue) => {
    const chips = [];
    if (queue?.orderQueue !== undefined && queue?.orderQueue !== null && String(queue.orderQueue).trim() !== "") {
      chips.push(
        <Chip
          key="order"
          size="small"
          label={`Ordem: ${queue.orderQueue}`}
          style={{ background: "rgba(11, 76, 70, 0.08)", color: "var(--tr-primary)", fontWeight: 600 }}
        />
      );
    }
    if (queue?.integrationId) {
      chips.push(<Chip key="int" size="small" label={`Integração: ${queue.integrationId}`} />);
    }
    if (queue?.promptId) {
      chips.push(<Chip key="prompt" size="small" label={`Prompt: ${queue.promptId}`} />);
    }
    return chips;
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedQueue &&
          `${i18n.t("queues.confirmationModal.deleteTitle")} ${
            selectedQueue.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queues.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QueueModal
        open={queueModalOpen}
        onClose={handleCloseQueueModal}
        queueId={selectedQueue?.id}
      />
      <MainHeader>
        <Title>{i18n.t("queues.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TrButton onClick={handleOpenQueueModal}>
            {i18n.t("queues.buttons.add")}
          </TrButton>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper className={`${classes.mainPaper} tr-card-border`} variant="outlined">
        {loading && (
          <Box className={classes.emptyState}>
            <Typography variant="body2">Carregando filas...</Typography>
          </Box>
        )}

        {!loading && queues.length === 0 && (
          <Box className={classes.emptyState}>
            <Typography variant="h6" style={{ fontWeight: 800, color: "var(--tr-primary)" }}>
              Nenhuma fila cadastrada
            </Typography>
            <Typography variant="body2" style={{ marginTop: 8 }}>
              Clique em <b>Adicionar fila</b> para criar sua primeira fila e configurar o chatbot.
            </Typography>
            <Box style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
              <TrButton onClick={handleOpenQueueModal}>{i18n.t("queues.buttons.add")}</TrButton>
            </Box>
          </Box>
        )}

        {!loading && queues.length > 0 && (
          <Grid container spacing={2}>
            {queues.map((queue) => (
              <Grid key={queue.id} item xs={12} sm={6} md={4} lg={3}>
                <Paper className={classes.card} variant="outlined">
                  <div className={classes.headerRow}>
                    <Box style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span className={classes.colorSwatch} style={{ backgroundColor: queue.color || "#0B4C46" }} />
                      <Typography className={classes.cardTitle} variant="subtitle1" noWrap>
                        {queue.name}
                      </Typography>
                    </Box>
                    <div className={classes.cardActions}>
                      <IconButton size="small" onClick={() => handleEditQueue(queue)}>
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedQueue(queue);
                          setConfirmModalOpen(true);
                        }}
                      >
                        <DeleteOutline />
                      </IconButton>
                    </div>
                  </div>

                  <div className={classes.metaRow}>{renderChips(queue)}</div>

                  <Box style={{ marginTop: 4 }}>
                    <Typography variant="caption" color="textSecondary" style={{ fontWeight: 700 }}>
                      Mensagem de saudação
                    </Typography>
                    <Typography variant="body2" className={classes.clamp2}>
                      {queue.greetingMessage || "-"}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Queues;
