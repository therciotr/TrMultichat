import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";
import Box from "@material-ui/core/Box";
import Checkbox from "@material-ui/core/Checkbox";
import IconButton from "@material-ui/core/IconButton";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import { v4 as uuidv4 } from "uuid";

import AndroidIcon from "@material-ui/icons/Android";
import VisibilityIcon from "@material-ui/icons/Visibility";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import TicketMessagesDialog from "../TicketMessagesDialog";
import contrastColor from "../../helpers/contrastColor";
import ContactTag from "../ContactTag";
import ConfirmationModal from "../ConfirmationModal";
import { toast } from "react-toastify";
import { fade } from "@material-ui/core/styles/colorManipulator";

const useStyles = makeStyles((theme) => ({
  ticket: {
    position: "relative",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 10,
    boxShadow: theme.palette.type === "dark" ? "0 1px 2px rgba(0,0,0,0.45)" : "0 1px 2px rgba(15, 23, 42, 0.06)",
    transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
    "&:hover": {
      borderColor: fade(theme.palette.text.primary, theme.palette.type === "dark" ? 0.28 : 0.18),
      boxShadow: theme.palette.type === "dark" ? "0 10px 24px rgba(0,0,0,0.55)" : "0 8px 18px rgba(15, 23, 42, 0.08)",
      transform: "translateY(-1px)",
    },
    "&.Mui-selected": {
      backgroundColor: fade(theme.palette.primary.main, theme.palette.type === "dark" ? 0.18 : 0.08),
      borderColor: fade(theme.palette.primary.main, theme.palette.type === "dark" ? 0.45 : 0.28),
    },
    "&.Mui-focusVisible": {
      boxShadow:
        `0 0 0 3px ${fade(theme.palette.primary.main, 0.22)}, 0 8px 18px ${
          theme.palette.type === "dark" ? "rgba(0,0,0,0.55)" : "rgba(15, 23, 42, 0.08)"
        }`,
    },
  },

  pendingTicket: {
    cursor: "unset",
    opacity: 0.92,
    "&:hover": {
      transform: "none",
      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    },
  },
  queueTag: {
    background: theme.palette.action.hover,
    color: theme.palette.text.primary,
    marginRight: 1,
    padding: 1,
    fontWeight: 'bold',
    paddingLeft: 5,
    paddingRight: 5,
    borderRadius: 3,
    fontSize: "0.8em",
    whiteSpace: "nowrap"
  },
  noTicketsDiv: {
    display: "flex",
    height: "100px",
    margin: 40,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  newMessagesCount: {
    position: "absolute",
    right: 10,
    top: 10,
  },
  noTicketsText: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontSize: "14px",
    lineHeight: "1.4",
  },
  connectionTag: {
    display: "inline-flex",
    alignItems: "center",
    background: theme.palette.action.hover,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    marginRight: 6,
    padding: "2px 8px",
    fontWeight: 700,
    borderRadius: 999,
    fontSize: 11,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  },
  agentTag: {
    background: fade(theme.palette.primary.main, theme.palette.type === "dark" ? 0.18 : 0.10),
    borderColor: fade(theme.palette.primary.main, theme.palette.type === "dark" ? 0.35 : 0.20),
    color: theme.palette.text.primary,
  },
  noTicketsTitle: {
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0px",
  },

  contactNameWrapper: {
    display: "flex",
    justifyContent: "space-between",
    marginLeft: "5px",
    gap: 10,
  },

  lastMessageTime: {
    justifySelf: "flex-end",
    textAlign: "right",
    fontSize: 12,
    color: theme.palette.text.secondary,
  },

  closedBadge: {
    alignSelf: "center",
    justifySelf: "flex-end",
    marginRight: 32,
    marginLeft: "auto",
  },

  contactLastMessage: {
    paddingRight: "0%",
    marginLeft: "5px",
    color: theme.palette.text.secondary,
  },


  badgeStyle: {
    color: "white",
    backgroundColor: green[600],
    borderRadius: 999,
    padding: "0 6px",
    minWidth: 18,
    height: 18,
    fontSize: 11,
  },

  actionButtons: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    marginLeft: 12,
  },
  actionButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 800,
    fontSize: 11,
    padding: "4px 10px",
    minWidth: 0,
    boxShadow: "none",
  },
  btnAccept: {
    backgroundColor: "#16A34A",
    color: "#fff",
    "&:hover": { backgroundColor: "#15803D" },
  },
  btnDanger: {
    backgroundColor: "#DC2626",
    color: "#fff",
    "&:hover": { backgroundColor: "#B91C1C" },
  },


  ticketQueueColor: {
    flex: "none",
    width: "8px",
    height: "100%",
    position: "absolute",
    top: "0%",
    left: "0%",
  },

  ticketInfo: {
    position: "relative",
  },
  secondaryContentSecond: {
    display: 'flex',
    // marginTop: 5,
    //marginLeft: "5px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    flexDirection: "row",
    alignContent: "flex-start",
  },
  ticketInfo1: {
    position: "relative",
    top: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  Radiusdot: {
    "& .MuiBadge-badge": {
      borderRadius: 2,
      position: "inherit",
      height: 16,
      margin: 2,
      padding: 3
    },
    "& .MuiBadge-anchorOriginTopRightRectangle": {
      transform: "scale(1) translate(0%, -40%)",
    },

  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
  },
  primaryIcon: {
    color: theme.palette.primary.main,
  },
  mutedIcon: {
    color: theme.palette.text.secondary,
  },
  title: {
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 0,
  },
  secondaryLine: {
    marginTop: 2,
  },
  divider: {
    display: "none",
  },
}));
/* PLW DESIGN INSERIDO o dentro do const handleChangeTab */
const TicketListItemCustom = ({ ticket, selectionMode = false, selected = false, onToggleSelect }) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ticketUser, setTicketUser] = useState(null);
  const [tag, setTag] = useState([]);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const { ticketId } = useParams();
  const isMounted = useRef(true);
  const { setCurrentTicket } = useContext(TicketsContext);
  const { user } = useContext(AuthContext);
  const { profile } = user;
  const isAdmin = String(user?.profile || "").toLowerCase() === "admin" || String(user?.profile || "").toLowerCase() === "super" || Boolean(user?.admin);

  useEffect(() => {
    if (ticket.userId && ticket.user) {
      setTicketUser(ticket.user?.name?.toUpperCase());
    }

    setTag(ticket?.tags);

    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* CÓDIGO NOVO SAUDAÇÃO */
  const handleCloseTicket = async (id) => {
    setTag(ticket?.tags);
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "closed",
        userId: user?.id,
        queueId: ticket?.queue?.id,
        useIntegration: false,
        promptId: null,
        integrationId: null
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/`);
  };

  const handleReopenTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
        queueId: ticket?.queue?.id
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/${ticket.uuid}`);
  };

    const handleAcepptTicket = async (id) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${id}`, {
                status: "open",
                userId: user?.id,
            });
            
            let settingIndex;

            try {
                const { data } = await api.get("/settings/");
                
                const settingsList = Array.isArray(data) ? data : [];
                settingIndex = settingsList.filter((s) => s.key === "sendGreetingAccepted");
                
            } catch (err) {
                toastError(err);
                   
            }
            
            // Guard: settings might not include this key
            if (settingIndex?.[0]?.value === "enabled" && !ticket.isGroup) {
                handleSendMessage(ticket.id);
                
            }

        } catch (err) {
            setLoading(false);
            
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }

        // handleChangeTab(null, "tickets");
        // handleChangeTab(null, "open");
        history.push(`/tickets/${ticket.uuid}`);
    };
	
	    const handleSendMessage = async (id) => {
        
        const msg = `{{ms}} *{{name}}*, meu nome é *${user?.name}* e agora vou prosseguir com seu atendimento!`;
        const message = {
            read: 1,
            fromMe: true,
            mediaUrl: "",
            body: `*Mensagem Automática:*\n${msg.trim()}`,
        };
        try {
            await api.post(`/messages/${id}`, message);
        } catch (err) {
            toastError(err);
            
        }
    };
	/* CÓDIGO NOVO SAUDAÇÃO */

  const handleSelectTicket = (ticket) => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  const handleDeleteTicket = async () => {
    setLoading(true);
    try {
      await api.delete(`/tickets/${ticket.id}`);
      setLoading(false);
      setDeleteConfirmOpen(false);
      try { toast.success("Ticket excluído com sucesso."); } catch {}
      try { history.push("/tickets"); } catch {}
    } catch (err) {
      setLoading(false);
      setDeleteConfirmOpen(false);
      toastError(err);
    }
  };


  const renderTicketInfo = () => {
    if (ticketUser) {

      return (
        <>
          {ticket.chatbot && (
            <Tooltip title="Chatbot">
              <AndroidIcon
                fontSize="small"
                className={classes.mutedIcon}
                style={{ marginRight: 5 }}
              />
            </Tooltip>
          )}

          {/* </span> */}
        </>
      );
    } else {
      return (
        <>
          {ticket.chatbot && (
            <Tooltip title="Chatbot">
              <AndroidIcon
                fontSize="small"
                className={classes.mutedIcon}
                style={{ marginRight: 5 }}
              />
            </Tooltip>
          )}
        </>
      );
    }
  };

  return (
    <React.Fragment key={ticket.id}>
      <ConfirmationModal
        title={`Excluir o ticket #${ticket?.id}?`}
        open={deleteConfirmOpen}
        onClose={setDeleteConfirmOpen}
        onConfirm={handleDeleteTicket}
      >
        Essa ação é permanente e remove mensagens/anotações relacionadas.
      </ConfirmationModal>
      <TicketMessagesDialog
        open={openTicketMessageDialog}

        handleClose={() => setOpenTicketMessageDialog(false)}
        ticketId={ticket.id}
      ></TicketMessagesDialog>
      <ListItem
        dense
        button
        onClick={(e) => {
          if (selectionMode) {
            if (typeof onToggleSelect === "function") onToggleSelect(ticket.id);
            return;
          }
          if (ticket.status === "pending") return;
          handleSelectTicket(ticket);
        }}
        selected={ticketId && +ticketId === ticket.id}
        className={clsx(classes.ticket, {
          [classes.pendingTicket]: ticket.status === "pending",
        })}
      >
        <Tooltip arrow placement="right" title={ticket.queue?.name?.toUpperCase() || "SEM FILA"} >
          <span style={{ backgroundColor: ticket.queue?.color || "#7C7C7C" }} className={classes.ticketQueueColor}></span>
        </Tooltip>
        {selectionMode && (
          <Checkbox
            checked={Boolean(selected)}
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onToggleSelect === "function") onToggleSelect(ticket.id);
            }}
            color="primary"
          />
        )}
        <ListItemAvatar>
          <Avatar className={classes.avatar} src={ticket?.contact?.profilePicUrl} />
        </ListItemAvatar>
        <ListItemText
          disableTypography

          primary={
            <span className={classes.contactNameWrapper}>
              <Typography
                noWrap
                component="span"
                variant="body2"
                color="textPrimary"
                className={classes.title}
              >
                {ticket.contact.name}
                {profile === "admin" && (
                  <>
                    <Tooltip title="Espiar Conversa">
                      <VisibilityIcon
                        onClick={() => setOpenTicketMessageDialog(true)}
                        fontSize="small"
                        style={{
                          color: undefined,
                          cursor: "pointer",
                          marginLeft: 10,
                          verticalAlign: "middle"
                        }}
                        className={classes.primaryIcon}
                      />
                    </Tooltip>
                    {isAdmin && !selectionMode && (
                      <Tooltip title="Excluir ticket">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmOpen(true);
                          }}
                          style={{ marginLeft: 6 }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
              </Typography>
              <ListItemSecondaryAction>
                <Box className={classes.ticketInfo1}>{renderTicketInfo()}</Box>
              </ListItemSecondaryAction>
            </span>

          }
          secondary={
            <span className={classes.contactNameWrapper}>

              <Typography
                className={classes.contactLastMessage}
                noWrap
                component="span"
                variant="body2"
                color="textSecondary"
              > {String(ticket.lastMessage || "").includes('data:image/png;base64') ? <MarkdownWrapper> Localização</MarkdownWrapper> : <MarkdownWrapper>{ticket.lastMessage || ""}</MarkdownWrapper>}
                <span className={clsx(classes.secondaryContentSecond, classes.secondaryLine)} >
                  {ticket?.whatsapp?.name ? <span className={classes.connectionTag}>{ticket?.whatsapp?.name?.toUpperCase()}</span> : <br></br>}
                  {ticketUser ? <span className={clsx(classes.connectionTag, classes.agentTag)}>{ticketUser}</span> : <br></br>}
                  <span style={{ backgroundColor: ticket.queue?.color || "#7c7c7c", color: contrastColor(ticket.queue?.color || "#7c7c7c") }} className={classes.connectionTag}>{ticket.queue?.name?.toUpperCase() || "SEM FILA"}</span>
                </span>
                <span style={{ paddingTop: "2px" }} className={classes.secondaryContentSecond} >
                  {tag?.map((tag) => {
                    return (
                      <ContactTag tag={tag} key={`ticket-contact-tag-${ticket.id}-${tag.id}`} />
                    );
                  })}
                </span>
              </Typography>

              <Badge
                className={classes.newMessagesCount}
                badgeContent={ticket.unreadMessages}
                classes={{
                  badge: classes.badgeStyle,
                }}
              />
            </span>
          }

        />
        <ListItemSecondaryAction>
          {ticket.lastMessage && (
            <>

              <Typography
                className={classes.lastMessageTime}
                component="span"
                variant="body2"
                color="textSecondary"
              >

                {isSameDay(parseISO(ticket.updatedAt), new Date()) ? (
                  <>{format(parseISO(ticket.updatedAt), "HH:mm")}</>
                ) : (
                  <>{format(parseISO(ticket.updatedAt), "dd/MM/yyyy")}</>
                )}
              </Typography>

              <br />

            </>
          )}

        </ListItemSecondaryAction>
        <span className={classes.actionButtons}>
          {ticket.status === "pending" && (
            <ButtonWithSpinner
              variant="contained"
              className={clsx(classes.actionButton, classes.btnAccept)}
              size="small"
              loading={loading}
			  //PLW DESIGN INSERIDO O handleChangeTab
              onClick={e => handleAcepptTicket(ticket.id)}
            >
              {i18n.t("ticketsList.buttons.accept")}
            </ButtonWithSpinner>

          )}
          {(ticket.status !== "closed") && (
            <ButtonWithSpinner
              variant="contained"
              className={clsx(classes.actionButton, classes.btnDanger)}
              size="small"
              loading={loading}
              onClick={e => handleCloseTicket(ticket.id)}
            >
              {i18n.t("ticketsList.buttons.closed")}
            </ButtonWithSpinner>

          )}
          {(ticket.status === "closed") && (
            <ButtonWithSpinner
              variant="contained"
              className={clsx(classes.actionButton, classes.btnDanger)}
              size="small"
              loading={loading}
              onClick={e => handleReopenTicket(ticket.id)}
            >
              {i18n.t("ticketsList.buttons.reopen")}
            </ButtonWithSpinner>

          )}
        </span>
      </ListItem>

      <Divider className={classes.divider} variant="inset" component="li" />
    </React.Fragment>
  );
};

export default TicketListItemCustom;