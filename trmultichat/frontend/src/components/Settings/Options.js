import React, { useEffect, useRef, useState } from "react";

import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Title from "../Title";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import useSettings from "../../hooks/useSettings";
import { ToastContainer, toast } from 'react-toastify';
import { makeStyles } from "@material-ui/core/styles";
import { grey, blue } from "@material-ui/core/colors";
import { Tabs, Tab } from "@material-ui/core";
import { TrButton, TrCard, TrSectionTitle } from "../ui";
import toastError from "../../errors/toastError";
import Box from "@material-ui/core/Box";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";

//import 'react-toastify/dist/ReactToastify.css';
 
const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 240,
  },
  tab: {
    backgroundColor: theme.palette.options,  //DARK MODE PLW DESIGN//
    borderRadius: 4,
    width: "100%",
    "& .MuiTab-wrapper": {
      color: theme.palette.fontecor,
    },   //DARK MODE PLW DESIGN//
    "& .MuiTabs-flexContainer": {
      justifyContent: "center"
    }


  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  cardAvatar: {
    fontSize: "55px",
    color: grey[500],
    backgroundColor: "#ffffff",
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  cardTitle: {
    fontSize: "18px",
    color: blue[700],
  },
  cardSubtitle: {
    color: grey[600],
    fontSize: "14px",
  },
  alignRight: {
    textAlign: "right",
  },
  fullWidth: {
    width: "100%",
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  topBarLeft: {
    minWidth: 0,
  },
  topBarTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: "rgba(15, 23, 42, 0.92)",
  },
  topBarSub: {
    margin: 0,
    marginTop: 2,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.65)",
  },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
    backgroundColor: "#fff",
  },
  switchRow: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(248, 250, 252, 0.70)",
  },
}));

export default function Options(props) {
  const { settings, scheduleTypeChanged } = props;
  const classes = useStyles();
  const [userRating, setUserRating] = useState("disabled");
  const [scheduleType, setScheduleType] = useState("disabled");
  const [callType, setCallType] = useState("enabled");
  const [chatbotType, setChatbotType] = useState("");
  const [CheckMsgIsGroup, setCheckMsgIsGroupType] = useState("enabled");

  const [savingGeneral, setSavingGeneral] = useState(false);


  const [ipixcType, setIpIxcType] = useState("");
  const [loadingIpIxcType, setLoadingIpIxcType] = useState(false);
  const [tokenixcType, setTokenIxcType] = useState("");
  const [loadingTokenIxcType, setLoadingTokenIxcType] = useState(false);

  const [ipmkauthType, setIpMkauthType] = useState("");
  const [loadingIpMkauthType, setLoadingIpMkauthType] = useState(false);
  const [clientidmkauthType, setClientIdMkauthType] = useState("");
  const [loadingClientIdMkauthType, setLoadingClientIdMkauthType] = useState(false);
  const [clientsecretmkauthType, setClientSecrectMkauthType] = useState("");
  const [loadingClientSecrectMkauthType, setLoadingClientSecrectMkauthType] = useState(false);

  const [asaasType, setAsaasType] = useState("");
  const [loadingAsaasType, setLoadingAsaasType] = useState(false);
  
  // recursos a mais da plw design

  const [SendGreetingAccepted, setSendGreetingAccepted] = useState("disabled");
  const [loadingSendGreetingAccepted, setLoadingSendGreetingAccepted] = useState(false);
  
  const [SettingsTransfTicket, setSettingsTransfTicket] = useState("disabled");
  const [loadingSettingsTransfTicket, setLoadingSettingsTransfTicket] = useState(false);

  const { update } = useSettings();

  const initialGeneralRef = useRef({
    userRating: "disabled",
    scheduleType: "disabled",
    call: "enabled",
    chatBotType: "",
    CheckMsgIsGroup: "enabled",
    sendGreetingAccepted: "disabled",
    sendMsgTransfTicket: "disabled",
  });

  useEffect(() => {
    if (Array.isArray(settings) && settings.length) {
      const userRating = settings.find((s) => s.key === "userRating");
      if (userRating) {
        setUserRating(userRating.value);
      }
      const scheduleType = settings.find((s) => s.key === "scheduleType");
      if (scheduleType) {
        setScheduleType(scheduleType.value);
      }
      const callType = settings.find((s) => s.key === "call");
      if (callType) {
        setCallType(callType.value);
      }
      const CheckMsgIsGroup = settings.find((s) => s.key === "CheckMsgIsGroup");
      if (CheckMsgIsGroup) {
        setCheckMsgIsGroupType(CheckMsgIsGroup.value);
      }
	  
	  {/*PLW DESIGN SAUDAÇÃO*/}
      const SendGreetingAccepted = settings.find((s) => s.key === "sendGreetingAccepted");
      if (SendGreetingAccepted) {
        setSendGreetingAccepted(SendGreetingAccepted.value);
      }	 
	  {/*PLW DESIGN SAUDAÇÃO*/}	 
	  
	  {/*TRANSFERIR TICKET*/}	
	  const SettingsTransfTicket = settings.find((s) => s.key === "sendMsgTransfTicket");
      if (SettingsTransfTicket) {
        setSettingsTransfTicket(SettingsTransfTicket.value);
      }
	  {/*TRANSFERIR TICKET*/}	
	  
      const chatbotType = settings.find((s) => s.key === "chatBotType");
      if (chatbotType) {
        setChatbotType(chatbotType.value);
      }

      const ipixcType = settings.find((s) => s.key === "ipixc");
      if (ipixcType) {
        setIpIxcType(ipixcType.value);
      }

      const tokenixcType = settings.find((s) => s.key === "tokenixc");
      if (tokenixcType) {
        setTokenIxcType(tokenixcType.value);
      }

      const ipmkauthType = settings.find((s) => s.key === "ipmkauth");
      if (ipmkauthType) {
        setIpMkauthType(ipmkauthType.value);
      }

      const clientidmkauthType = settings.find((s) => s.key === "clientidmkauth");
      if (clientidmkauthType) {
        setClientIdMkauthType(clientidmkauthType.value);
      }

      const clientsecretmkauthType = settings.find((s) => s.key === "clientsecretmkauth");
      if (clientsecretmkauthType) {
        setClientSecrectMkauthType(clientsecretmkauthType.value);
      }

      const asaasType = settings.find((s) => s.key === "asaas");
      if (asaasType) {
        setAsaasType(asaasType.value);
      }

      // snapshot initial general values (for dirty check)
      initialGeneralRef.current = {
        userRating: userRating?.value ?? "disabled",
        scheduleType: scheduleType?.value ?? "disabled",
        call: callType?.value ?? "enabled",
        chatBotType: chatbotType?.value ?? "",
        CheckMsgIsGroup: CheckMsgIsGroup?.value ?? "enabled",
        sendGreetingAccepted: SendGreetingAccepted?.value ?? "disabled",
        sendMsgTransfTicket: SettingsTransfTicket?.value ?? "disabled",
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const generalDirty = (() => {
    const init = initialGeneralRef.current || {};
    return (
      String(userRating) !== String(init.userRating) ||
      String(scheduleType) !== String(init.scheduleType) ||
      String(callType) !== String(init.call) ||
      String(chatbotType) !== String(init.chatBotType) ||
      String(CheckMsgIsGroup) !== String(init.CheckMsgIsGroup) ||
      String(SendGreetingAccepted) !== String(init.sendGreetingAccepted) ||
      String(SettingsTransfTicket) !== String(init.sendMsgTransfTicket)
    );
  })();
  
  {/*NOVO CÓDIGO*/}  
  async function handleSendGreetingAccepted(value) { setSendGreetingAccepted(value); }  
  
  
  {/*NOVO CÓDIGO*/}    

  async function handleSettingsTransfTicket(value) { setSettingsTransfTicket(value); } 
 
  async function handleChangeIPIxc(value) {
    setIpIxcType(value);
  }

  async function handleChangeTokenIxc(value) {
    setTokenIxcType(value);
  }

  async function handleChangeIpMkauth(value) {
    setIpMkauthType(value);
  }

  async function handleChangeClientIdMkauth(value) {
    setClientIdMkauthType(value);
  }

  async function handleChangeClientSecrectMkauth(value) {
    setClientSecrectMkauthType(value);
  }

  async function handleChangeAsaas(value) {
    setAsaasType(value);
  }

  async function handleSaveGeneral() {
    if (!generalDirty) return;
    const prev = initialGeneralRef.current;
    try {
      setSavingGeneral(true);
      const updates = [];
      if (String(userRating) !== String(prev.userRating)) updates.push(update({ key: "userRating", value: userRating }));
      if (String(scheduleType) !== String(prev.scheduleType)) updates.push(update({ key: "scheduleType", value: scheduleType }));
      if (String(callType) !== String(prev.call)) updates.push(update({ key: "call", value: callType }));
      if (String(chatbotType) !== String(prev.chatBotType)) updates.push(update({ key: "chatBotType", value: chatbotType }));
      if (String(CheckMsgIsGroup) !== String(prev.CheckMsgIsGroup)) updates.push(update({ key: "CheckMsgIsGroup", value: CheckMsgIsGroup }));
      if (String(SendGreetingAccepted) !== String(prev.sendGreetingAccepted)) updates.push(update({ key: "sendGreetingAccepted", value: SendGreetingAccepted }));
      if (String(SettingsTransfTicket) !== String(prev.sendMsgTransfTicket)) updates.push(update({ key: "sendMsgTransfTicket", value: SettingsTransfTicket }));

      await Promise.all(updates);
      toast.success("Configurações salvas com sucesso.");
      const nextSnap = {
        userRating,
        scheduleType,
        call: callType,
        chatBotType: chatbotType,
        CheckMsgIsGroup,
        sendGreetingAccepted: SendGreetingAccepted,
        sendMsgTransfTicket: SettingsTransfTicket,
      };
      initialGeneralRef.current = nextSnap;
      if (typeof scheduleTypeChanged === "function") {
        scheduleTypeChanged(scheduleType);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSavingGeneral(false);
    }
  }
  return (
    <>
      <div className={classes.topBar}>
        <div className={classes.topBarLeft}>
          <p className={classes.topBarTitle}>Opções gerais</p>
          <p className={classes.topBarSub}>Configure comportamento do atendimento e chatbot</p>
        </div>
        <TrButton
          startIcon={<SaveOutlinedIcon />}
          onClick={handleSaveGeneral}
          disabled={!generalDirty || savingGeneral}
        >
          {savingGeneral ? "Salvando..." : "Salvar alterações"}
        </TrButton>
      </div>
      <TrCard elevation={1} className="tr-card-border" style={{ padding: 0 }}>
      <div className={classes.sectionCard}>
      <Grid spacing={3} container>
        {/* <Grid xs={12} item>
                    <Title>Configurações Gerais</Title>
                </Grid> */}
        <Grid xs={12} sm={6} md={4} item>
          <div className={classes.switchRow}>
            <FormControlLabel
              control={
                <Switch
                  checked={String(userRating) === "enabled"}
                  onChange={(e) => setUserRating(e.target.checked ? "enabled" : "disabled")}
                  color="primary"
                />
              }
              label="Avaliações"
            />
            <FormHelperText>Habilita coleta de avaliação após o atendimento.</FormHelperText>
          </div>
        </Grid>
        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="schedule-type-label">
              Gerenciamento de Expediente
            </InputLabel>
            <Select
              labelId="schedule-type-label"
              value={scheduleType}
              onChange={async (e) => {
                setScheduleType(e.target.value);
              }}
            >
              <MenuItem value={"disabled"}>Desabilitado</MenuItem>
              <MenuItem value={"queue"}>Fila</MenuItem>
              <MenuItem value={"company"}>Empresa</MenuItem>
            </Select>
            <FormHelperText>Define onde controlar o expediente.</FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={4} item>
          <div className={classes.switchRow}>
            <FormControlLabel
              control={
                <Switch
                  checked={String(CheckMsgIsGroup) === "enabled"}
                  onChange={(e) => setCheckMsgIsGroupType(e.target.checked ? "enabled" : "disabled")}
                  color="primary"
                />
              }
              label="Ignorar mensagens de grupos"
            />
            <FormHelperText>Quando ativo, mensagens de grupos não criam tickets.</FormHelperText>
          </div>
        </Grid>
        <Grid xs={12} sm={6} md={4} item>
          <div className={classes.switchRow}>
            <FormControlLabel
              control={
                <Switch
                  checked={String(callType) === "enabled"}
                  onChange={(e) => setCallType(e.target.checked ? "enabled" : "disabled")}
                  color="primary"
                />
              }
              label="Aceitar chamada"
            />
            <FormHelperText>Permite receber chamadas (quando suportado).</FormHelperText>
          </div>
        </Grid>
        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="chatbot-type-label">
              Tipo Chatbot
            </InputLabel>
            <Select
              labelId="chatbot-type-label"
              value={chatbotType}
              onChange={async (e) => {
                setChatbotType(e.target.value);
              }}
            >
              <MenuItem value={"text"}>Texto</MenuItem>
			 {/*<MenuItem value={"button"}>Botão</MenuItem>*/}
             {/*<MenuItem value={"list"}>Lista</MenuItem>*/}
            </Select>
            <FormHelperText>Define o formato das opções do chatbot.</FormHelperText>
          </FormControl>
        </Grid>
		{/* ENVIAR SAUDAÇÃO AO ACEITAR O TICKET */}
        <Grid xs={12} sm={6} md={4} item>
          <div className={classes.switchRow}>
            <FormControlLabel
              control={
                <Switch
                  checked={String(SendGreetingAccepted) === "enabled"}
                  onChange={(e) => handleSendGreetingAccepted(e.target.checked ? "enabled" : "disabled")}
                  color="primary"
                />
              }
              label="Enviar saudação ao aceitar o ticket"
            />
            <FormHelperText>Envie a mensagem automática ao aceitar o atendimento.</FormHelperText>
          </div>
        </Grid>
		{/* ENVIAR SAUDAÇÃO AO ACEITAR O TICKET */}
		
		{/* ENVIAR MENSAGEM DE TRANSFERENCIA DE SETOR/ATENDENTE */}
        <Grid xs={12} sm={6} md={4} item>
          <div className={classes.switchRow}>
            <FormControlLabel
              control={
                <Switch
                  checked={String(SettingsTransfTicket) === "enabled"}
                  onChange={(e) => handleSettingsTransfTicket(e.target.checked ? "enabled" : "disabled")}
                  color="primary"
                />
              }
              label="Mensagem ao transferir fila/agente"
            />
            <FormHelperText>Notifica o cliente quando o ticket for transferido.</FormHelperText>
          </div>
        </Grid>
		
      </Grid>
      </div>
      </TrCard>
      <div style={{ height: 12 }} />
      <TrSectionTitle title="Integrações" subtitle="Credenciais dos serviços externos" />
      <TrCard elevation={1} className="tr-card-border" style={{ padding: 16 }}>
      {/*-----------------IXC-----------------*/}
      <TrSectionTitle title="IXC" />
      <Grid spacing={3} container
        style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="ipixc"
              name="ipixc"
              margin="dense"
              label="IP do IXC"
              placeholder="http://seu-ixc:port (ou IP/DNS acessível)"
              variant="outlined"
              value={ipixcType}
              onChange={async (e) => {
                handleChangeIPIxc(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>Endereço do servidor IXC acessível pela API.</FormHelperText>
            <FormHelperText>
              {loadingIpIxcType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="tokenixc"
              name="tokenixc"
              margin="dense"
              label="Token do IXC"
              placeholder="Token de acesso gerado no IXC"
              variant="outlined"
              value={tokenixcType}
              onChange={async (e) => {
                handleChangeTokenIxc(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>Informe o token da integração IXC.</FormHelperText>
            <FormHelperText>
              {loadingTokenIxcType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} item>
          <TrButton
            onClick={async () => {
              setLoadingIpIxcType(true);
              setLoadingTokenIxcType(true);
              await Promise.all([
                update({ key: "ipixc", value: ipixcType }),
                update({ key: "tokenixc", value: tokenixcType }),
              ]);
              toast.success("IXC salvo com sucesso.");
              setLoadingIpIxcType(false);
              setLoadingTokenIxcType(false);
            }}
          >
            Salvar IXC
          </TrButton>
        </Grid>
      </Grid>
      {/*-----------------MK-AUTH-----------------*/}
      <TrSectionTitle title="MK-AUTH" />
      <Grid spacing={3} container
        style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={12} md={4} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="ipmkauth"
              name="ipmkauth"
              margin="dense"
              label="Ip Mk-Auth"
              placeholder="http://seu-mkauth:port (ou IP/DNS)"
              variant="outlined"
              value={ipmkauthType}
              onChange={async (e) => {
                handleChangeIpMkauth(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>Endereço do servidor MK-AUTH.</FormHelperText>
            <FormHelperText>
              {loadingIpMkauthType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={12} md={4} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="clientidmkauth"
              name="clientidmkauth"
              margin="dense"
              label="Client Id"
              placeholder="Client ID da API do MK-AUTH"
              variant="outlined"
              value={clientidmkauthType}
              onChange={async (e) => {
                handleChangeClientIdMkauth(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>Identificador do cliente na API MK-AUTH.</FormHelperText>
            <FormHelperText>
              {loadingClientIdMkauthType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={12} md={4} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="clientsecretmkauth"
              name="clientsecretmkauth"
              margin="dense"
              label="Client Secret"
              placeholder="Client Secret da API do MK-AUTH"
              variant="outlined"
              value={clientsecretmkauthType}
              onChange={async (e) => {
                handleChangeClientSecrectMkauth(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>Segredo do cliente na API MK-AUTH.</FormHelperText>
            <FormHelperText>
              {loadingClientSecrectMkauthType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} item>
          <TrButton
            onClick={async () => {
              setLoadingIpMkauthType(true);
              setLoadingClientIdMkauthType(true);
              setLoadingClientSecrectMkauthType(true);
              await Promise.all([
                update({ key: "ipmkauth", value: ipmkauthType }),
                update({ key: "clientidmkauth", value: clientidmkauthType }),
                update({ key: "clientsecretmkauth", value: clientsecretmkauthType }),
              ]);
              toast.success("MK-AUTH salvo com sucesso.");
              setLoadingIpMkauthType(false);
              setLoadingClientIdMkauthType(false);
              setLoadingClientSecrectMkauthType(false);
            }}
          >
            Salvar MK-AUTH
          </TrButton>
        </Grid>
      </Grid>
      {/*-----------------ASAAS-----------------*/}
      <TrSectionTitle title="ASAAS" />
      <Grid spacing={3} container
        style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={12} md={12} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="asaas"
              name="asaas"
              margin="dense"
              label="Token Asaas"
              placeholder="Token Asaas (produção ou sandbox)"
              variant="outlined"
              value={asaasType}
              onChange={async (e) => {
                handleChangeAsaas(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>Informe o token de API do Asaas.</FormHelperText>
            <FormHelperText>
              {loadingAsaasType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} item>
          <TrButton
            onClick={async () => {
              setLoadingAsaasType(true);
              await update({ key: "asaas", value: asaasType });
              toast.success("ASAAS salvo com sucesso.");
              setLoadingAsaasType(false);
            }}
          >
            Salvar ASAAS
          </TrButton>
        </Grid>
      </Grid>
      </TrCard>
    </>
  );
}
