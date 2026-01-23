import React, { useEffect, useState } from "react";

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
}));

export default function Options(props) {
  const { settings, scheduleTypeChanged } = props;
  const classes = useStyles();
  const [userRating, setUserRating] = useState("disabled");
  const [scheduleType, setScheduleType] = useState("disabled");
  const [callType, setCallType] = useState("enabled");
  const [chatbotType, setChatbotType] = useState("");
  const [CheckMsgIsGroup, setCheckMsgIsGroupType] = useState("enabled");

  const [loadingUserRating, setLoadingUserRating] = useState(false);
  const [loadingScheduleType, setLoadingScheduleType] = useState(false);
  const [loadingCallType, setLoadingCallType] = useState(false);
  const [loadingChatbotType, setLoadingChatbotType] = useState(false);
  const [loadingCheckMsgIsGroup, setLoadingCheckMsgIsGroup] = useState(false);


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

  async function safeUpdateSetting({ key, value, setValue, setLoading, successMessage }) {
    const prev = value;
    try {
      setLoading(true);
      await update({ key, value });
      if (typeof setValue === "function") setValue(value);
      toast.success(successMessage || "Operação atualizada com sucesso.");
      return true;
    } catch (err) {
      toastError(err);
      // revert optimistic UI if needed
      if (typeof setValue === "function") setValue(prev);
      return false;
    } finally {
      setLoading(false);
    }
  }

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  async function handleChangeUserRating(value) {
    await safeUpdateSetting({
      key: "userRating",
      value,
      setValue: setUserRating,
      setLoading: setLoadingUserRating,
    });
  }

  async function handleScheduleType(value) {
    const ok = await safeUpdateSetting({
      key: "scheduleType",
      value,
      setValue: setScheduleType,
      setLoading: setLoadingScheduleType,
    });
    if (typeof scheduleTypeChanged === "function") {
      // only notify parent if persisted
      if (ok) scheduleTypeChanged(value);
    }
  }

  async function handleCallType(value) {
    await safeUpdateSetting({
      key: "call",
      value,
      setValue: setCallType,
      setLoading: setLoadingCallType,
    });
  }

  async function handleChatbotType(value) {
    await safeUpdateSetting({
      key: "chatBotType",
      value,
      setValue: setChatbotType,
      setLoading: setLoadingChatbotType,
    });
  }

  async function handleGroupType(value) {
    await safeUpdateSetting({
      key: "CheckMsgIsGroup",
      value,
      setValue: setCheckMsgIsGroupType,
      setLoading: setLoadingCheckMsgIsGroup,
    });
    /*     if (typeof scheduleTypeChanged === "function") {
          scheduleTypeChanged(value);
        } */
  }
  
  {/*NOVO CÓDIGO*/}  
  async function handleSendGreetingAccepted(value) {
    await safeUpdateSetting({
      key: "sendGreetingAccepted",
      value,
      setValue: setSendGreetingAccepted,
      setLoading: setLoadingSendGreetingAccepted,
    });
  }  
  
  
  {/*NOVO CÓDIGO*/}    

  async function handleSettingsTransfTicket(value) {
    await safeUpdateSetting({
      key: "sendMsgTransfTicket",
      value,
      setValue: setSettingsTransfTicket,
      setLoading: setLoadingSettingsTransfTicket,
    });
  } 
 
  async function handleChangeIPIxc(value) {
    setIpIxcType(value);
    setLoadingIpIxcType(true);
    await update({
      key: "ipixc",
      value,
    });
    toast.success("Operação atualizada com sucesso.");
    setLoadingIpIxcType(false);
  }

  async function handleChangeTokenIxc(value) {
    setTokenIxcType(value);
    setLoadingTokenIxcType(true);
    await update({
      key: "tokenixc",
      value,
    });
    toast.success("Operação atualizada com sucesso.");
    setLoadingTokenIxcType(false);
  }

  async function handleChangeIpMkauth(value) {
    setIpMkauthType(value);
    setLoadingIpMkauthType(true);
    await update({
      key: "ipmkauth",
      value,
    });
    toast.success("Operação atualizada com sucesso.");
    setLoadingIpMkauthType(false);
  }

  async function handleChangeClientIdMkauth(value) {
    setClientIdMkauthType(value);
    setLoadingClientIdMkauthType(true);
    await update({
      key: "clientidmkauth",
      value,
    });
    toast.success("Operação atualizada com sucesso.");
    setLoadingClientIdMkauthType(false);
  }

  async function handleChangeClientSecrectMkauth(value) {
    setClientSecrectMkauthType(value);
    setLoadingClientSecrectMkauthType(true);
    await update({
      key: "clientsecretmkauth",
      value,
    });
    toast.success("Operação atualizada com sucesso.");
    setLoadingClientSecrectMkauthType(false);
  }

  async function handleChangeAsaas(value) {
    setAsaasType(value);
    setLoadingAsaasType(true);
    await update({
      key: "asaas",
      value,
    });
    toast.success("Operação atualizada com sucesso.");
    setLoadingAsaasType(false);
  }
  return (
    <>
      <TrSectionTitle title="Opções gerais" subtitle="Configure comportamento do atendimento e chatbot" />
      <TrCard elevation={1} className="tr-card-border" style={{ padding: 16 }}>
      <Grid spacing={3} container>
        {/* <Grid xs={12} item>
                    <Title>Configurações Gerais</Title>
                </Grid> */}
        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="ratings-label">Avaliações</InputLabel>
            <Select
              labelId="ratings-label"
              value={userRating}
              onChange={async (e) => {
                await handleChangeUserRating(e.target.value);
              }}
            >
              <MenuItem value={"disabled"}>Desabilitadas</MenuItem>
              <MenuItem value={"enabled"}>Habilitadas</MenuItem>
            </Select>
            <FormHelperText>
              {loadingUserRating && "Atualizando..."}
            </FormHelperText>
          </FormControl>
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
                await handleScheduleType(e.target.value);
              }}
            >
              <MenuItem value={"disabled"}>Desabilitado</MenuItem>
              <MenuItem value={"queue"}>Fila</MenuItem>
              <MenuItem value={"company"}>Empresa</MenuItem>
            </Select>
            <FormHelperText>
              {loadingScheduleType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="group-type-label">
              Ignorar Mensagens de Grupos
            </InputLabel>
            <Select
              labelId="group-type-label"
              value={CheckMsgIsGroup}
              onChange={async (e) => {
                await handleGroupType(e.target.value);
              }}
            >
              <MenuItem value={"disabled"}>Desativado</MenuItem>
              <MenuItem value={"enabled"}>Ativado</MenuItem>
            </Select>
            <FormHelperText>
              {loadingCheckMsgIsGroup && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="call-type-label">
              Aceitar Chamada
            </InputLabel>
            <Select
              labelId="call-type-label"
              value={callType}
              onChange={async (e) => {
                await handleCallType(e.target.value);
              }}
            >
              <MenuItem value={"disabled"}>Não Aceitar</MenuItem>
              <MenuItem value={"enabled"}>Aceitar</MenuItem>
            </Select>
            <FormHelperText>
              {loadingCallType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
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
                await handleChatbotType(e.target.value);
              }}
            >
              <MenuItem value={"text"}>Texto</MenuItem>
			 {/*<MenuItem value={"button"}>Botão</MenuItem>*/}
             {/*<MenuItem value={"list"}>Lista</MenuItem>*/}
            </Select>
            <FormHelperText>
              {loadingChatbotType && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
		{/* ENVIAR SAUDAÇÃO AO ACEITAR O TICKET */}
        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="sendGreetingAccepted-label">Enviar saudação ao aceitar o ticket</InputLabel>
            <Select
              labelId="sendGreetingAccepted-label"
              value={SendGreetingAccepted}
              onChange={async (e) => {
                await handleSendGreetingAccepted(e.target.value);
              }}
            >
              <MenuItem value={"disabled"}>Desabilitado</MenuItem>
              <MenuItem value={"enabled"}>Habilitado</MenuItem>
            </Select>
            <FormHelperText>
              {loadingSendGreetingAccepted && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
		{/* ENVIAR SAUDAÇÃO AO ACEITAR O TICKET */}
		
		{/* ENVIAR MENSAGEM DE TRANSFERENCIA DE SETOR/ATENDENTE */}
        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="sendMsgTransfTicket-label">Enviar mensagem de transferencia de Fila/agente</InputLabel>
            <Select
              labelId="sendMsgTransfTicket-label"
              value={SettingsTransfTicket}
              onChange={async (e) => {
                await handleSettingsTransfTicket(e.target.value);
              }}
            >
              <MenuItem value={"disabled"}>Desabilitado</MenuItem>
              <MenuItem value={"enabled"}>Habilitado</MenuItem>
            </Select>
            <FormHelperText>
              {loadingSettingsTransfTicket && "Atualizando..."}
            </FormHelperText>
          </FormControl>
        </Grid>
		
      </Grid>
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
