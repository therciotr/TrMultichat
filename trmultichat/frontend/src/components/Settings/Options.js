import React, { useEffect, useRef, useState } from "react";

import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Slider from "@material-ui/core/Slider";
import useSettings from "../../hooks/useSettings";
import { toast } from 'react-toastify';
import { makeStyles } from "@material-ui/core/styles";
import { grey, blue } from "@material-ui/core/colors";
import { TrButton, TrCard, TrSectionTitle } from "../ui";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import DnsOutlinedIcon from "@material-ui/icons/DnsOutlined";
import VpnKeyOutlinedIcon from "@material-ui/icons/VpnKeyOutlined";
import AccountBalanceWalletOutlinedIcon from "@material-ui/icons/AccountBalanceWalletOutlined";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@material-ui/icons/VisibilityOffOutlined";
import EmojiObjectsIcon from "@material-ui/icons/EmojiObjects";
import CodeIcon from "@material-ui/icons/Code";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import AccessTimeOutlinedIcon from "@material-ui/icons/AccessTimeOutlined";

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
    color: theme.palette.text.primary,
  },
  topBarSub: {
    margin: 0,
    marginTop: 2,
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.type === "dark" ? "0 10px 28px rgba(0,0,0,0.35)" : "0 8px 24px rgba(15, 23, 42, 0.05)",
    backgroundColor: theme.palette.background.paper,
  },
  switchRow: {
    padding: 12,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(15,23,42,0.55)" : "rgba(15,23,42,0.03)",
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
  const [idleLogoutEnabled, setIdleLogoutEnabled] = useState(false);
  const [idleLogoutMinutes, setIdleLogoutMinutes] = useState(30);

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

  const [showTokenIxc, setShowTokenIxc] = useState(false);
  const [showClientSecretMk, setShowClientSecretMk] = useState(false);
  const [showAsaasToken, setShowAsaasToken] = useState(false);

  // IA (ChatGPT / Cursor)
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-3.5-turbo");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("https://api.openai.com/v1");
  const [loadingOpenAi, setLoadingOpenAi] = useState(false);
  const [testingOpenAi, setTestingOpenAi] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);

  const [cursorApiKey, setCursorApiKey] = useState("");
  const [cursorModel, setCursorModel] = useState("gpt-3.5-turbo");
  const [cursorBaseUrl, setCursorBaseUrl] = useState("");
  const [loadingCursor, setLoadingCursor] = useState(false);
  const [testingCursor, setTestingCursor] = useState(false);
  const [showCursorKey, setShowCursorKey] = useState(false);
  
  // recursos a mais da plw design

  const [SendGreetingAccepted, setSendGreetingAccepted] = useState("disabled");
  
  const [SettingsTransfTicket, setSettingsTransfTicket] = useState("disabled");

  const { update } = useSettings();

  const initialGeneralRef = useRef({
    userRating: "disabled",
    scheduleType: "disabled",
    call: "enabled",
    chatBotType: "",
    CheckMsgIsGroup: "enabled",
    sendGreetingAccepted: "disabled",
    sendMsgTransfTicket: "disabled",
    idleLogoutEnabled: false,
    idleLogoutMinutes: 30,
  });

  const initialIntegrationsRef = useRef({
    ipixc: "",
    tokenixc: "",
    ipmkauth: "",
    clientidmkauth: "",
    clientsecretmkauth: "",
    asaas: "",
    openaiApiKey: "",
    openaiModel: "gpt-3.5-turbo",
    openaiBaseUrl: "https://api.openai.com/v1",
    cursorApiKey: "",
    cursorModel: "gpt-3.5-turbo",
    cursorBaseUrl: ""
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
      // PLW DESIGN SAUDAÇÃO
      const SendGreetingAccepted = settings.find((s) => s.key === "sendGreetingAccepted");
      if (SendGreetingAccepted) {
        setSendGreetingAccepted(SendGreetingAccepted.value);
      }	 
      // TRANSFERIR TICKET
	  const SettingsTransfTicket = settings.find((s) => s.key === "sendMsgTransfTicket");
      if (SettingsTransfTicket) {
        setSettingsTransfTicket(SettingsTransfTicket.value);
      }
	  
      const chatbotType = settings.find((s) => s.key === "chatBotType");
      if (chatbotType) {
        setChatbotType(chatbotType.value);
      }

      // Segurança: logout por inatividade
      const idleEnabled = settings.find((s) => s.key === "idleLogoutEnabled");
      if (idleEnabled) {
        setIdleLogoutEnabled(String(idleEnabled.value || "").toLowerCase() === "enabled");
      }
      const idleMinutes = settings.find((s) => s.key === "idleLogoutMinutes");
      if (idleMinutes) {
        const n = Number(idleMinutes.value || 0);
        if (Number.isFinite(n) && n > 0) setIdleLogoutMinutes(Math.max(1, Math.min(240, n)));
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

      const openaiApiKey = settings.find((s) => s.key === "openaiApiKey");
      if (openaiApiKey) setOpenaiApiKey(openaiApiKey.value);
      const openaiModel = settings.find((s) => s.key === "openaiModel");
      if (openaiModel) setOpenaiModel(openaiModel.value);
      const openaiBaseUrl = settings.find((s) => s.key === "openaiBaseUrl");
      if (openaiBaseUrl) setOpenaiBaseUrl(openaiBaseUrl.value);

      const cursorApiKey = settings.find((s) => s.key === "cursorApiKey");
      if (cursorApiKey) setCursorApiKey(cursorApiKey.value);
      const cursorModel = settings.find((s) => s.key === "cursorModel");
      if (cursorModel) setCursorModel(cursorModel.value);
      const cursorBaseUrl = settings.find((s) => s.key === "cursorBaseUrl");
      if (cursorBaseUrl) setCursorBaseUrl(cursorBaseUrl.value);

      // snapshot initial general values (for dirty check)
      initialGeneralRef.current = {
        userRating: userRating?.value ?? "disabled",
        scheduleType: scheduleType?.value ?? "disabled",
        call: callType?.value ?? "enabled",
        chatBotType: chatbotType?.value ?? "",
        CheckMsgIsGroup: CheckMsgIsGroup?.value ?? "enabled",
        sendGreetingAccepted: SendGreetingAccepted?.value ?? "disabled",
        sendMsgTransfTicket: SettingsTransfTicket?.value ?? "disabled",
        idleLogoutEnabled: String(idleEnabled?.value || "").toLowerCase() === "enabled",
        idleLogoutMinutes: (() => {
          const n = Number(idleMinutes?.value || 0);
          return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(240, n)) : 30;
        })(),
      };

      initialIntegrationsRef.current = {
        ipixc: ipixcType?.value ?? "",
        tokenixc: tokenixcType?.value ?? "",
        ipmkauth: ipmkauthType?.value ?? "",
        clientidmkauth: clientidmkauthType?.value ?? "",
        clientsecretmkauth: clientsecretmkauthType?.value ?? "",
        asaas: asaasType?.value ?? "",
        openaiApiKey: openaiApiKey?.value ?? "",
        openaiModel: openaiModel?.value ?? "gpt-3.5-turbo",
        openaiBaseUrl: openaiBaseUrl?.value ?? "https://api.openai.com/v1",
        cursorApiKey: cursorApiKey?.value ?? "",
        cursorModel: cursorModel?.value ?? "gpt-3.5-turbo",
        cursorBaseUrl: cursorBaseUrl?.value ?? ""
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
      String(SettingsTransfTicket) !== String(init.sendMsgTransfTicket) ||
      Boolean(idleLogoutEnabled) !== Boolean(init.idleLogoutEnabled) ||
      Number(idleLogoutMinutes || 0) !== Number(init.idleLogoutMinutes || 0)
    );
  })();
  
  // Mensagens automáticas (ao aceitar / ao transferir)
  async function handleSendGreetingAccepted(value) { setSendGreetingAccepted(value); }

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

  const ixcDirty =
    String(ipixcType || "") !== String(initialIntegrationsRef.current.ipixc || "") ||
    String(tokenixcType || "") !== String(initialIntegrationsRef.current.tokenixc || "");
  const mkDirty =
    String(ipmkauthType || "") !== String(initialIntegrationsRef.current.ipmkauth || "") ||
    String(clientidmkauthType || "") !== String(initialIntegrationsRef.current.clientidmkauth || "") ||
    String(clientsecretmkauthType || "") !== String(initialIntegrationsRef.current.clientsecretmkauth || "");
  const asaasDirty = String(asaasType || "") !== String(initialIntegrationsRef.current.asaas || "");

  const openAiDirty =
    String(openaiApiKey || "") !== String(initialIntegrationsRef.current.openaiApiKey || "") ||
    String(openaiModel || "") !== String(initialIntegrationsRef.current.openaiModel || "") ||
    String(openaiBaseUrl || "") !== String(initialIntegrationsRef.current.openaiBaseUrl || "");

  const cursorDirty =
    String(cursorApiKey || "") !== String(initialIntegrationsRef.current.cursorApiKey || "") ||
    String(cursorModel || "") !== String(initialIntegrationsRef.current.cursorModel || "") ||
    String(cursorBaseUrl || "") !== String(initialIntegrationsRef.current.cursorBaseUrl || "");

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
      if (Boolean(idleLogoutEnabled) !== Boolean(prev.idleLogoutEnabled)) {
        updates.push(update({ key: "idleLogoutEnabled", value: idleLogoutEnabled ? "enabled" : "disabled" }));
      }
      if (Number(idleLogoutMinutes || 0) !== Number(prev.idleLogoutMinutes || 0)) {
        updates.push(update({ key: "idleLogoutMinutes", value: String(Math.max(1, Math.min(240, Number(idleLogoutMinutes || 1)))) }));
      }

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
        idleLogoutEnabled: Boolean(idleLogoutEnabled),
        idleLogoutMinutes: Number(idleLogoutMinutes || 0),
      };
      initialGeneralRef.current = nextSnap;
      if (typeof scheduleTypeChanged === "function") {
        scheduleTypeChanged(scheduleType);
      }
      try {
        window.dispatchEvent(new Event("tr-settings-updated"));
      } catch (_) {}
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

      <TrCard elevation={1} className="tr-card-border" style={{ padding: 0 }}>
        <div className={classes.sectionCard}>
          <TrSectionTitle title="Segurança" subtitle="Controle de sessão e proteção por inatividade" />
          <Grid spacing={3} container style={{ marginTop: 4 }}>
            <Grid xs={12} md={5} item>
              <div className={classes.switchRow}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(idleLogoutEnabled)}
                      onChange={(e) => setIdleLogoutEnabled(Boolean(e.target.checked))}
                      color="primary"
                    />
                  }
                  label="Logout por inatividade"
                />
                <FormHelperText>
                  Quando ligado, o sistema encerra a sessão se não houver atividade (mouse/teclado).
                </FormHelperText>
              </div>
            </Grid>
            <Grid xs={12} md={7} item>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  background: "rgba(248, 250, 252, 0.70)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                    <AccessTimeOutlinedIcon style={{ fontSize: 18, opacity: 0.85 }} />
                    Tempo de inatividade
                  </div>
                  <TextField
                    disabled={!idleLogoutEnabled}
                    variant="outlined"
                    size="small"
                    value={Number(idleLogoutMinutes || 0)}
                    onChange={(e) => {
                      const n = Number(e.target.value || 0);
                      if (!Number.isFinite(n)) return;
                      setIdleLogoutMinutes(Math.max(1, Math.min(240, n)));
                    }}
                    style={{ width: 160 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">min</InputAdornment>,
                    }}
                  />
                </div>
                <div style={{ marginTop: 10, opacity: idleLogoutEnabled ? 1 : 0.55 }}>
                  <Slider
                    value={Number(idleLogoutMinutes || 1)}
                    onChange={(_, v) => setIdleLogoutMinutes(Number(v || 1))}
                    min={1}
                    max={240}
                    step={1}
                    disabled={!idleLogoutEnabled}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 5, label: "5" },
                      { value: 15, label: "15" },
                      { value: 30, label: "30" },
                      { value: 60, label: "60" },
                      { value: 120, label: "120" },
                    ]}
                  />
                  <FormHelperText>
                    Dica: 15–30 min é um bom padrão. Para desativar, desligue o switch.
                  </FormHelperText>
                </div>
              </div>
            </Grid>
          </Grid>
        </div>
      </TrCard>

      <div style={{ height: 12 }} />
      <TrSectionTitle title="Integrações" subtitle="Credenciais dos serviços externos" />
      <TrCard elevation={1} className="tr-card-border" style={{ padding: 0 }}>
        <div className={classes.sectionCard}>
          {/* IXC */}
          <div className={classes.topBar} style={{ marginBottom: 12 }}>
            <div className={classes.topBarLeft}>
              <p className={classes.topBarTitle}>
                <DnsOutlinedIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
                IXC
              </p>
              <p className={classes.topBarSub}>Endereço e token de acesso da integração IXC.</p>
            </div>
            <TrButton
              startIcon={<SaveOutlinedIcon />}
              disabled={!ixcDirty || loadingIpIxcType || loadingTokenIxcType}
              onClick={async () => {
                try {
                  setLoadingIpIxcType(true);
                  setLoadingTokenIxcType(true);
                  await Promise.all([
                    update({ key: "ipixc", value: ipixcType }),
                    update({ key: "tokenixc", value: tokenixcType }),
                  ]);
                  initialIntegrationsRef.current = {
                    ...initialIntegrationsRef.current,
                    ipixc: String(ipixcType || ""),
                    tokenixc: String(tokenixcType || ""),
                  };
                  toast.success("IXC salvo com sucesso.");
                } catch (err) {
                  toastError(err);
                } finally {
                  setLoadingIpIxcType(false);
                  setLoadingTokenIxcType(false);
                }
              }}
            >
              {loadingIpIxcType || loadingTokenIxcType ? "Salvando..." : "Salvar"}
            </TrButton>
          </div>
          <Grid spacing={2} container style={{ marginBottom: 16 }}>
            <Grid xs={12} sm={6} item>
              <TextField
                fullWidth
                size="small"
                id="ipixc"
                name="ipixc"
                label="URL / IP do IXC"
                placeholder="http://seu-ixc:port (ou IP/DNS acessível)"
                variant="outlined"
                value={ipixcType}
                onChange={(e) => handleChangeIPIxc(e.target.value)}
                helperText="Endereço do servidor IXC acessível pela API."
              />
            </Grid>
            <Grid xs={12} sm={6} item>
              <TextField
                fullWidth
                size="small"
                id="tokenixc"
                name="tokenixc"
                label="Token do IXC"
                placeholder="Token de acesso gerado no IXC"
                variant="outlined"
                type={showTokenIxc ? "text" : "password"}
                value={tokenixcType}
                onChange={(e) => handleChangeTokenIxc(e.target.value)}
                helperText="Token de autenticação da integração."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showTokenIxc ? "Ocultar" : "Mostrar"}>
                        <IconButton size="small" onClick={() => setShowTokenIxc((v) => !v)}>
                          {showTokenIxc ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>

          {/* MK-AUTH */}
          <div className={classes.topBar} style={{ marginBottom: 12 }}>
            <div className={classes.topBarLeft}>
              <p className={classes.topBarTitle}>
                <VpnKeyOutlinedIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
                MK-AUTH
              </p>
              <p className={classes.topBarSub}>Credenciais da API do MK-AUTH.</p>
            </div>
            <TrButton
              startIcon={<SaveOutlinedIcon />}
              disabled={!mkDirty || loadingIpMkauthType || loadingClientIdMkauthType || loadingClientSecrectMkauthType}
              onClick={async () => {
                try {
                  setLoadingIpMkauthType(true);
                  setLoadingClientIdMkauthType(true);
                  setLoadingClientSecrectMkauthType(true);
                  await Promise.all([
                    update({ key: "ipmkauth", value: ipmkauthType }),
                    update({ key: "clientidmkauth", value: clientidmkauthType }),
                    update({ key: "clientsecretmkauth", value: clientsecretmkauthType }),
                  ]);
                  initialIntegrationsRef.current = {
                    ...initialIntegrationsRef.current,
                    ipmkauth: String(ipmkauthType || ""),
                    clientidmkauth: String(clientidmkauthType || ""),
                    clientsecretmkauth: String(clientsecretmkauthType || ""),
                  };
                  toast.success("MK-AUTH salvo com sucesso.");
                } catch (err) {
                  toastError(err);
                } finally {
                  setLoadingIpMkauthType(false);
                  setLoadingClientIdMkauthType(false);
                  setLoadingClientSecrectMkauthType(false);
                }
              }}
            >
              {loadingIpMkauthType || loadingClientIdMkauthType || loadingClientSecrectMkauthType ? "Salvando..." : "Salvar"}
            </TrButton>
          </div>
          <Grid spacing={2} container style={{ marginBottom: 16 }}>
            <Grid xs={12} md={4} item>
              <TextField
                fullWidth
                size="small"
                id="ipmkauth"
                name="ipmkauth"
                label="URL / IP do MK-AUTH"
                placeholder="http://seu-mkauth:port (ou IP/DNS)"
                variant="outlined"
                value={ipmkauthType}
                onChange={(e) => handleChangeIpMkauth(e.target.value)}
                helperText="Endereço do servidor MK-AUTH."
              />
            </Grid>
            <Grid xs={12} md={4} item>
              <TextField
                fullWidth
                size="small"
                id="clientidmkauth"
                name="clientidmkauth"
                label="Client ID"
                placeholder="Client ID da API do MK-AUTH"
                variant="outlined"
                value={clientidmkauthType}
                onChange={(e) => handleChangeClientIdMkauth(e.target.value)}
                helperText="Identificador do cliente na API."
              />
            </Grid>
            <Grid xs={12} md={4} item>
              <TextField
                fullWidth
                size="small"
                id="clientsecretmkauth"
                name="clientsecretmkauth"
                label="Client Secret"
                placeholder="Client Secret da API do MK-AUTH"
                variant="outlined"
                type={showClientSecretMk ? "text" : "password"}
                value={clientsecretmkauthType}
                onChange={(e) => handleChangeClientSecrectMkauth(e.target.value)}
                helperText="Segredo do cliente na API."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showClientSecretMk ? "Ocultar" : "Mostrar"}>
                        <IconButton size="small" onClick={() => setShowClientSecretMk((v) => !v)}>
                          {showClientSecretMk ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>

          {/* ASAAS */}
          <div className={classes.topBar} style={{ marginBottom: 12 }}>
            <div className={classes.topBarLeft}>
              <p className={classes.topBarTitle}>
                <AccountBalanceWalletOutlinedIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
                ASAAS
              </p>
              <p className={classes.topBarSub}>Token de API do Asaas (produção ou sandbox).</p>
            </div>
            <TrButton
              startIcon={<SaveOutlinedIcon />}
              disabled={!asaasDirty || loadingAsaasType}
              onClick={async () => {
                try {
                  setLoadingAsaasType(true);
                  await update({ key: "asaas", value: asaasType });
                  initialIntegrationsRef.current = {
                    ...initialIntegrationsRef.current,
                    asaas: String(asaasType || ""),
                  };
                  toast.success("ASAAS salvo com sucesso.");
                } catch (err) {
                  toastError(err);
                } finally {
                  setLoadingAsaasType(false);
                }
              }}
            >
              {loadingAsaasType ? "Salvando..." : "Salvar"}
            </TrButton>
          </div>
          <Grid spacing={2} container>
            <Grid xs={12} item>
              <TextField
                fullWidth
                size="small"
                id="asaas"
                name="asaas"
                label="Token Asaas"
                placeholder="Token Asaas (produção ou sandbox)"
                variant="outlined"
                type={showAsaasToken ? "text" : "password"}
                value={asaasType}
                onChange={(e) => handleChangeAsaas(e.target.value)}
                helperText="Cole o token de API gerado no Asaas."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showAsaasToken ? "Ocultar" : "Mostrar"}>
                        <IconButton size="small" onClick={() => setShowAsaasToken((v) => !v)}>
                          {showAsaasToken ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>

          <div style={{ height: 18 }} />

          {/* ChatGPT (OpenAI) */}
          <div className={classes.topBar} style={{ marginBottom: 12 }}>
            <div className={classes.topBarLeft}>
              <p className={classes.topBarTitle}>
                <EmojiObjectsIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
                ChatGPT (OpenAI)
              </p>
              <p className={classes.topBarSub}>Configuração global de IA para prompts/respostas automáticas.</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <TrButton
                startIcon={<PlayArrowIcon />}
                disabled={testingOpenAi || !String(openaiApiKey || "").trim()}
                onClick={async () => {
                  try {
                    setTestingOpenAi(true);
                    const { data } = await api.post("/ai/test", { provider: "openai", message: "Responda apenas: OK" });
                    toast.success(`ChatGPT: ${data?.response || "OK"}`);
                  } catch (err) {
                    toastError(err);
                  } finally {
                    setTestingOpenAi(false);
                  }
                }}
              >
                {testingOpenAi ? "Testando..." : "Testar"}
              </TrButton>
              <TrButton
                startIcon={<SaveOutlinedIcon />}
                disabled={!openAiDirty || loadingOpenAi}
                onClick={async () => {
                  try {
                    setLoadingOpenAi(true);
                    await Promise.all([
                      update({ key: "openaiApiKey", value: openaiApiKey }),
                      update({ key: "openaiModel", value: openaiModel }),
                      update({ key: "openaiBaseUrl", value: openaiBaseUrl }),
                    ]);
                    initialIntegrationsRef.current = {
                      ...initialIntegrationsRef.current,
                      openaiApiKey: String(openaiApiKey || ""),
                      openaiModel: String(openaiModel || ""),
                      openaiBaseUrl: String(openaiBaseUrl || ""),
                    };
                    toast.success("ChatGPT salvo com sucesso.");
                  } catch (err) {
                    toastError(err);
                  } finally {
                    setLoadingOpenAi(false);
                  }
                }}
              >
                {loadingOpenAi ? "Salvando..." : "Salvar"}
              </TrButton>
            </div>
          </div>
          <Grid spacing={2} container style={{ marginBottom: 16 }}>
            <Grid xs={12} md={6} item>
              <TextField
                fullWidth
                size="small"
                id="openaiApiKey"
                name="openaiApiKey"
                label="OpenAI API Key"
                placeholder="sk-..."
                variant="outlined"
                type={showOpenAiKey ? "text" : "password"}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                helperText="Chave de API da OpenAI (ChatGPT)."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showOpenAiKey ? "Ocultar" : "Mostrar"}>
                        <IconButton size="small" onClick={() => setShowOpenAiKey((v) => !v)}>
                          {showOpenAiKey ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid xs={12} md={3} item>
              <TextField
                fullWidth
                size="small"
                id="openaiModel"
                name="openaiModel"
                label="Modelo"
                placeholder="gpt-3.5-turbo"
                variant="outlined"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                helperText="Ex.: gpt-3.5-turbo"
              />
            </Grid>
            <Grid xs={12} md={3} item>
              <TextField
                fullWidth
                size="small"
                id="openaiBaseUrl"
                name="openaiBaseUrl"
                label="Base URL"
                placeholder="https://api.openai.com/v1"
                variant="outlined"
                value={openaiBaseUrl}
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                helperText="Deixe padrão, a menos que use proxy."
              />
            </Grid>
          </Grid>

          {/* Cursor (OpenAI-compatible) */}
          <div className={classes.topBar} style={{ marginBottom: 12 }}>
            <div className={classes.topBarLeft}>
              <p className={classes.topBarTitle}>
                <CodeIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
                Cursor (OpenAI-compatible)
              </p>
              <p className={classes.topBarSub}>Use um endpoint compatível com OpenAI (baseUrl + apiKey).</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <TrButton
                startIcon={<PlayArrowIcon />}
                disabled={testingCursor || !String(cursorApiKey || "").trim() || !String(cursorBaseUrl || "").trim()}
                onClick={async () => {
                  try {
                    setTestingCursor(true);
                    const { data } = await api.post("/ai/test", { provider: "cursor", message: "Responda apenas: OK" });
                    toast.success(`Cursor: ${data?.response || "OK"}`);
                  } catch (err) {
                    toastError(err);
                  } finally {
                    setTestingCursor(false);
                  }
                }}
              >
                {testingCursor ? "Testando..." : "Testar"}
              </TrButton>
              <TrButton
                startIcon={<SaveOutlinedIcon />}
                disabled={!cursorDirty || loadingCursor}
                onClick={async () => {
                  try {
                    setLoadingCursor(true);
                    await Promise.all([
                      update({ key: "cursorApiKey", value: cursorApiKey }),
                      update({ key: "cursorModel", value: cursorModel }),
                      update({ key: "cursorBaseUrl", value: cursorBaseUrl }),
                    ]);
                    initialIntegrationsRef.current = {
                      ...initialIntegrationsRef.current,
                      cursorApiKey: String(cursorApiKey || ""),
                      cursorModel: String(cursorModel || ""),
                      cursorBaseUrl: String(cursorBaseUrl || ""),
                    };
                    toast.success("Cursor salvo com sucesso.");
                  } catch (err) {
                    toastError(err);
                  } finally {
                    setLoadingCursor(false);
                  }
                }}
              >
                {loadingCursor ? "Salvando..." : "Salvar"}
              </TrButton>
            </div>
          </div>
          <Grid spacing={2} container>
            <Grid xs={12} md={4} item>
              <TextField
                fullWidth
                size="small"
                id="cursorBaseUrl"
                name="cursorBaseUrl"
                label="Base URL"
                placeholder="https://.../v1"
                variant="outlined"
                value={cursorBaseUrl}
                onChange={(e) => setCursorBaseUrl(e.target.value)}
                helperText="Obrigatório (endpoint compatível com OpenAI)."
              />
            </Grid>
            <Grid xs={12} md={4} item>
              <TextField
                fullWidth
                size="small"
                id="cursorApiKey"
                name="cursorApiKey"
                label="API Key"
                placeholder="..."
                variant="outlined"
                type={showCursorKey ? "text" : "password"}
                value={cursorApiKey}
                onChange={(e) => setCursorApiKey(e.target.value)}
                helperText="Chave do provedor."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showCursorKey ? "Ocultar" : "Mostrar"}>
                        <IconButton size="small" onClick={() => setShowCursorKey((v) => !v)}>
                          {showCursorKey ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid xs={12} md={4} item>
              <TextField
                fullWidth
                size="small"
                id="cursorModel"
                name="cursorModel"
                label="Modelo"
                placeholder="gpt-3.5-turbo"
                variant="outlined"
                value={cursorModel}
                onChange={(e) => setCursorModel(e.target.value)}
                helperText="Modelo exposto pelo endpoint."
              />
            </Grid>
          </Grid>
        </div>
      </TrCard>
    </>
  );
}
