import React, { useState, useEffect, useRef, useContext } from "react";
import { useHistory } from "react-router-dom";

import { TrButton } from "../ui";
import Dialog from "@material-ui/core/Dialog";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import { Grid, ListItemText, Typography, makeStyles } from "@material-ui/core";

import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import useQueues from "../../hooks/useQueues";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  maxWidth: {
    width: "100%",
  },
}));

const TransferTicketModalCustom = ({ modalOpen, onClose, ticketid }) => {
  const history = useHistory();
  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const classes = useStyles();
  const { findAll: findAllQueues } = useQueues();
  const isMounted = useRef(true);
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId;
  const whatsappId = user?.whatsappId;

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/whatsapp`, { params: { companyId, session: 0 } });
          setWhatsapps(Array.isArray(data) ? data : []);
        } catch (_) {
          setWhatsapps([]);
        }
      };

      if (whatsappId !== null && whatsappId !== undefined) {
        setSelectedWhatsapp(whatsappId)
      }

      if ((user?.queues || []).length === 1) {
        setSelectedQueue(user.queues[0].id)
      }
      fetchContacts();
      setLoading(false);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [modalOpen, companyId, whatsappId, user])

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        const list = await findAllQueues();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    setLoading(true);
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/users/list");
        setOptions(Array.isArray(data) ? data : []);
      } catch (err) {
        toastError(err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [modalOpen]);

  const handleClose = () => {
    onClose();
    setSelectedUser(null);
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    if (!ticketid) return;
    if (!selectedQueue || selectedQueue === "") return;
    setLoading(true);
    try {
      let data = {};

      if (selectedUser) {
        data.userId = selectedUser.id;
      }

      if (selectedQueue && selectedQueue !== null) {
        data.queueId = selectedQueue;

        if (!selectedUser) {
          data.status = "pending";
          data.userId = null;
        }
      }

      if (selectedWhatsapp) {
        data.whatsappId = selectedWhatsapp
      }
      await api.put(`/tickets/${ticketid}`, data);

      history.push(`/tickets`);
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  return (
    <Dialog open={modalOpen} onClose={handleClose} maxWidth="lg" scroll="paper">
      <form onSubmit={handleSaveTicket}>
        <DialogTitle id="form-dialog-title">
          {i18n.t("transferTicketModal.title")}
        </DialogTitle>
        <DialogContent dividers>
          <FormControl variant="outlined" className={classes.maxWidth} style={{ marginBottom: 20 }}>
            <InputLabel>{i18n.t("transferTicketModal.fieldLabel")}</InputLabel>
            <Select
              autoFocus
              value={selectedUser?.id || ""}
              onChange={(e) => {
                const nextUser = options.find((u) => u.id === e.target.value) || null;
                setSelectedUser(nextUser);
                if (nextUser != null && Array.isArray(nextUser.queues)) {
                  setQueues(nextUser.queues);
                } else {
                  setQueues(allQueues);
                  setSelectedQueue("");
                }
              }}
              label={i18n.t("transferTicketModal.fieldLabel")}
            >
              <MenuItem value="">
                {i18n.t("transferTicketModal.noneUserOption")}
              </MenuItem>
              {options.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="outlined" className={classes.maxWidth}>
            <InputLabel>
              {i18n.t("transferTicketModal.fieldQueueLabel")}
            </InputLabel>
            <Select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
            >
              {queues.map((queue) => (
                <MenuItem key={queue.id} value={queue.id}>
                  {queue.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* CONEXAO */}
          <Grid container spacing={2} style={{marginTop: '15px'}}>
            <Grid xs={12} item>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedWhatsapp}
                onChange={(e) => {
                  setSelectedWhatsapp(e.target.value)
                }}
                MenuProps={{
                  anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
                renderValue={() => {
                  if (selectedWhatsapp === "") {
                    return "Selecione uma Conexão"
                  }
                  const whatsapp = whatsapps.find(w => w.id === selectedWhatsapp)
                  return whatsapp.name
                }}
              >
                {whatsapps?.length > 0 &&
                  whatsapps.map((whatsapp, key) => (
                    <MenuItem dense key={key} value={whatsapp.id}>
                      <ListItemText
                        primary={
                          <>
                            {/* {IconChannel(whatsapp.channel)} */}
                            <Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
                              {whatsapp.name} &nbsp; <p className={(whatsapp.status) === 'CONNECTED' ? classes.online : classes.offline} >({whatsapp.status})</p>
                            </Typography>
                          </>
                        }
                      />
                    </MenuItem>
                  ))}
              </Select>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <TrButton onClick={handleClose} disabled={loading}>
            {i18n.t("transferTicketModal.buttons.cancel")}
          </TrButton>
          <ButtonWithSpinner type="submit" loading={loading}>
            {i18n.t("transferTicketModal.buttons.ok")}
          </ButtonWithSpinner>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TransferTicketModalCustom;
