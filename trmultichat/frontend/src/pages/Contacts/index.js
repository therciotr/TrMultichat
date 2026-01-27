import React, { useState, useEffect, useReducer, useContext } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
// removed Button import after migrating to TrButton
import { TrButton } from "../../components/ui";
import Avatar from "@material-ui/core/Avatar";
import Grid from "@material-ui/core/Grid";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import SearchOutlinedIcon from "@material-ui/icons/SearchOutlined";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import ChatOutlinedIcon from "@material-ui/icons/ChatOutlined";
import PhoneIphoneOutlinedIcon from "@material-ui/icons/PhoneIphoneOutlined";
import AlternateEmailOutlinedIcon from "@material-ui/icons/AlternateEmailOutlined";
import GroupOutlinedIcon from "@material-ui/icons/GroupOutlined";
import CloudDownloadOutlinedIcon from "@material-ui/icons/CloudDownloadOutlined";
import PersonAddOutlinedIcon from "@material-ui/icons/PersonAddOutlined";
import FileDownloadOutlinedIcon from "@material-ui/icons/GetAppOutlined";

import api from "../../services/api";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import NewTicketModal from "../../components/NewTicketModal";
import { socketConnection } from "../../services/socket";

import {CSVLink} from "react-csv";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

function getInitials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : (parts[0]?.[1] || "");
  return `${a}${b}`.toUpperCase();
}

function hueFromString(input = "") {
  let h = 0;
  const s = String(input || "");
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

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
    width: "99.6%",
    alignItems: "center",
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
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
    "&:before": {
      content: '""',
      position: "absolute",
      inset: "0 0 auto 0",
      height: 3,
      background:
        "linear-gradient(90deg, rgba(16, 185, 129, 0.85), rgba(59, 130, 246, 0.85), rgba(99, 102, 241, 0.85))",
      opacity: 0.75,
    },
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
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    color: "rgba(15, 23, 42, 0.92)",
    fontWeight: 900,
  },
  avatarFallback: {
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.65)",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)",
  },
  name: {
    fontWeight: 900,
    fontSize: 14,
    color: "rgba(15, 23, 42, 0.92)",
  },
  sub: {
    marginTop: 2,
    color: "rgba(15, 23, 42, 0.65)",
    fontSize: 13,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: theme.spacing(1.25),
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  actionIcon: {
    color: "rgba(15, 23, 42, 0.68)",
    "&:hover": { color: "rgba(15, 23, 42, 0.92)" },
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
    height: 140,
  },
}));

const Contacts = () => {
  const classes = useStyles();
  const history = useHistory();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [contactTicket, setContactTicket] = useState({});
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/contacts/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketConnection({ companyId });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    // keep as typed; backend handles case-insensitive search and digit normalization
    setSearchParam(event.target.value);
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  // const handleSaveTicket = async contactId => {
  // 	if (!contactId) return;
  // 	setLoading(true);
  // 	try {
  // 		const { data: ticket } = await api.post("/tickets", {
  // 			contactId: contactId,
  // 			userId: user?.id,
  // 			status: "open",
  // 		});
  // 		history.push(`/tickets/${ticket.id}`);
  // 	} catch (err) {
  // 		toastError(err);
  // 	}
  // 	setLoading(false);
  // };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleimportContact = async () => {
    try {
      await api.post("/contacts/import");
      history.go(0);
    } catch (err) {
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
    <MainContainer className={classes.mainContainer}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        initialContact={contactTicket}
        onClose={(ticket) => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <ContactModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      ></ContactModal>
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${
                deletingContact.name
              }?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={(e) =>
          deletingContact
            ? handleDeleteContact(deletingContact.id)
            : handleimportContact()
        }
      >
        {deletingContact
          ? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>
      <MainHeader>
        <Title>{i18n.t("contacts.title")}</Title>
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
          <TrButton
            className={classes.actionBtn}
            onClick={(e) => setConfirmOpen(true)}
            startIcon={<CloudDownloadOutlinedIcon />}
          >
            {i18n.t("contacts.buttons.import")}
          </TrButton>
          <TrButton
            className={classes.actionBtn}
            onClick={handleOpenContactModal}
            startIcon={<PersonAddOutlinedIcon />}
          >
            {i18n.t("contacts.buttons.add")}
          </TrButton>

         <CSVLink style={{ textDecoration:'none'}} separator=";" filename={'trtecnologias.csv'} data={contacts.map((contact) => ({ name: contact.name, number: contact.number, email: contact.email }))}>
          <TrButton className={classes.actionBtn} startIcon={<FileDownloadOutlinedIcon />}>
          EXPORTAR CONTATOS 
          </TrButton>
          </CSVLink>

        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={`${classes.mainPaper} tr-card-border`}
        variant="outlined"
        onScroll={handleScroll}
      >
        {contacts.length === 0 && !loading ? (
          <div className={classes.emptyWrap}>
            <PersonOutlineIcon className={classes.emptyIcon} />
            <Typography style={{ fontWeight: 900, fontSize: 16, color: "rgba(15, 23, 42, 0.92)" }}>
              {i18n.t("contacts.title")}
            </Typography>
            <Typography style={{ color: "rgba(15, 23, 42, 0.62)", fontSize: 13 }}>
              {i18n.t("contacts.searchPlaceholder")}
            </Typography>
          </div>
        ) : (
          <Grid container spacing={2} className={classes.cardsGrid}>
            {contacts.map((contact) => (
              <Grid key={contact.id} item xs={12} sm={6} md={4} lg={3}>
                <Card className={classes.card} variant="outlined">
                  <CardContent>
                    <div className={classes.cardTop}>
                      <div className={classes.titleRow}>
                        {contact.profilePicUrl ? (
                          <Avatar className={classes.avatar} src={contact.profilePicUrl} />
                        ) : (
                          <Avatar
                            className={`${classes.avatar} ${classes.avatarFallback}`}
                            style={{
                              background: `linear-gradient(135deg, hsl(${hueFromString(
                                String(contact.id || contact.name || ""),
                              )} 85% 45%), hsl(${(hueFromString(String(contact.id || contact.name || "")) + 48) % 360
                              } 85% 48%))`,
                            }}
                          >
                            {getInitials(contact.name)}
                          </Avatar>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <Typography className={classes.name} noWrap>
                            {contact.name}
                          </Typography>
                          <Typography className={classes.sub} noWrap>
                            {contact.isGroup ? "Grupo" : (contact.number || "—")}
                          </Typography>
                        </div>
                      </div>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setContactTicket(contact);
                            setNewTicketModalOpen(true);
                          }}
                          aria-label="Abrir atendimento"
                        >
                          <ChatOutlinedIcon className={classes.actionIcon} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => hadleEditContact(contact.id)}
                          aria-label="Editar contato"
                        >
                          <EditOutlinedIcon className={classes.actionIcon} />
                        </IconButton>
                        <Can
                          role={user?.profile || "user"}
                          perform="contacts-page:deleteContact"
                          yes={() => (
                            <IconButton
                              size="small"
                              onClick={() => {
                                setConfirmOpen(true);
                                setDeletingContact(contact);
                              }}
                              aria-label="Excluir contato"
                            >
                              <DeleteOutlineIcon className={classes.actionIcon} />
                            </IconButton>
                          )}
                        />
                      </Box>
                    </div>

                    <div className={classes.chips}>
                      {contact.isGroup && (
                        <Chip
                          className={classes.chip}
                          size="small"
                          icon={<GroupOutlinedIcon style={{ fontSize: 16 }} />}
                          label="Grupo"
                          variant="outlined"
                        />
                      )}
                      <Chip
                        className={classes.chip}
                        size="small"
                        icon={<PhoneIphoneOutlinedIcon style={{ fontSize: 16 }} />}
                        label={contact.number || "—"}
                        variant="outlined"
                      />
                      <Chip
                        className={classes.chip}
                        size="small"
                        icon={<AlternateEmailOutlinedIcon style={{ fontSize: 16 }} />}
                        label={contact.email || "Email"}
                        variant="outlined"
                      />
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

export default Contacts;
