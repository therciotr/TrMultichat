import React, { useMemo, useState, useEffect } from "react";
import {
  makeStyles,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
  Chip,
  Typography,
  Divider,
  IconButton,
  Select,
  InputAdornment,
} from "@material-ui/core";
import { Card, CardHeader, CardContent } from "@material-ui/core";
import BusinessIcon from "@material-ui/icons/Business";
import ListAltIcon from "@material-ui/icons/ListAlt";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EmailIcon from "@material-ui/icons/Email";
import PhoneIcon from "@material-ui/icons/Phone";
import EventIcon from "@material-ui/icons/Event";
import AssignmentIcon from "@material-ui/icons/Assignment";
import AssignmentIndIcon from "@material-ui/icons/AssignmentInd";
import HomeOutlinedIcon from "@material-ui/icons/HomeOutlined";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import { Formik, Form, Field, FieldArray } from "formik";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import usePlans from "../../hooks/usePlans";
import ModalUsers from "../ModalUsers";
import api from "../../services/api";
import { head, isArray, has } from "lodash";
import { useDate } from "../../hooks/useDate";

import moment from "moment";
import { isValidCPF } from "../../utils/cpf";
import { maskCPF, maskCNPJ, maskCEP, maskPhoneBR, onlyDigits as onlyDigitsMask } from "../../utils/masks";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  fullWidth: {
    width: "100%",
  },
  textfield: {
    width: "100%",
  },
  textRight: {
    textAlign: "right",
  },
  row: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  control: {
    paddingRight: theme.spacing(1),
    paddingLeft: theme.spacing(1),
  },
  buttonContainer: {
    textAlign: "right",
    padding: theme.spacing(1),
  },
  softCard: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)",
  },
  sectionHeader: { paddingBottom: theme.spacing(1) },
  formGrid: {
    // deixa o form “respirar” e evita quebra esquisita no mobile
    marginTop: theme.spacing(0.5),
  },
  subSection: {
    padding: theme.spacing(1.5),
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
  },
  subSectionTitle: {
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  hint: {
    opacity: 0.75,
    marginTop: 2,
  },
  cardsGrid: { marginTop: theme.spacing(1) },
  companyCard: {
    height: "100%",
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: theme.shadows[4],
      borderColor: theme.palette.primary.main,
    },
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  companyName: {
    fontWeight: 900,
    lineHeight: 1.15,
    wordBreak: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    minWidth: 0,
  },
  pill: {
    fontWeight: 900,
    borderRadius: 12,
  },
  pillPrimary: { backgroundColor: theme.palette.primary.main, color: "#fff" },
  metaRow: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(1.25),
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
    minWidth: 180,
  },
  metaLabel: { opacity: 0.75, fontWeight: 700, fontSize: 12, lineHeight: 1.2 },
  metaValue: { fontWeight: 900, fontSize: 13, lineHeight: 1.2, wordBreak: "break-word" },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(0.5),
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
  },
  iconBtn: { borderRadius: 10 },
  formSectionTitle: { marginTop: 12, fontWeight: 900 },
  inlineActions: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
  },
  removeMiniBtn: {
    borderRadius: 12,
  },
}));

const EMPTY_PJ = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  naturezaJuridica: "",
  dataAbertura: "",
  situacaoCadastral: "",
  cnaePrincipal: "",
  cnaesSecundarios: "",
  capitalSocial: "",
  regimeTributario: "",
  socios: [],
  endereco: {
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    complemento: "",
  },
};

const EMPTY_PF = {
  cpf: "",
  nomeCompleto: "",
  dataNascimento: "",
  nomeMae: "",
  sexo: "",
  estadoCivil: "",
  rg: { numero: "", orgaoEmissor: "", uf: "" },
  endereco: {
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    complemento: "",
  },
};

function buildBlankCompanyValues() {
  return {
    id: undefined,
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    dueDate: "",
    recurrence: "",
    personType: "PJ",
    pj: JSON.parse(JSON.stringify(EMPTY_PJ)),
    pf: JSON.parse(JSON.stringify(EMPTY_PF)),
  };
}

function dueChip(dueDateRaw, recurrenceRaw) {
  const due = dueDateRaw && moment(dueDateRaw).isValid() ? moment(dueDateRaw) : null;
  const recurrence = String(recurrenceRaw || "").trim();
  if (!due) return { label: "Sem vencimento", color: "default" };
  const now = moment();
  const diff = due.diff(now, "days");
  const base = `${due.format("DD/MM/YYYY")}${recurrence ? ` • ${recurrence}` : ""}`;
  if (diff < 0) return { label: `Vencido: ${base}`, color: "secondary" };
  if (diff <= 5) return { label: `Vence em ${diff}d: ${base}`, color: "secondary" };
  return { label: `Venc.: ${base}`, color: "default" };
}

function safeJsonParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
}

function normalizeCompanyProfile(rawProfile) {
  const p = safeJsonParse(rawProfile) || {};
  if (!p || typeof p !== "object") return { personType: "PJ", pj: {}, pf: {} };

  // Formato novo (que usamos no frontend): { personType, pj, pf }
  if ((p.personType === "PJ" || p.personType === "PF") && (p.pj || p.pf)) {
    return {
      personType: p.personType === "PF" ? "PF" : "PJ",
      pj: (p.pj && typeof p.pj === "object") ? p.pj : {},
      pf: (p.pf && typeof p.pf === "object") ? p.pf : {},
    };
  }

  // Formato antigo (backend type CompanyProfile): { personType, legalName, tradeName, document, address... }
  const documentDigits = onlyDigitsMask(p.document || "");
  const inferredType =
    p.personType === "PF" || p.personType === "PJ"
      ? p.personType
      : documentDigits.length === 11
        ? "PF"
        : "PJ";

  const addr = (p.address && typeof p.address === "object") ? p.address : {};
  const mappedAddress = {
    cep: maskCEP(addr.zip || ""),
    logradouro: addr.street || "",
    numero: addr.number || "",
    bairro: addr.district || "",
    cidade: addr.city || "",
    uf: addr.state || "",
    complemento: addr.complement || "",
  };

  if (inferredType === "PF") {
    return {
      personType: "PF",
      pj: {},
      pf: {
        cpf: maskCPF(p.document || ""),
        nomeCompleto: p.legalName || "",
        dataNascimento: p.birthDate ? String(p.birthDate).slice(0, 10) : "",
        endereco: mappedAddress,
      },
    };
  }

  return {
    personType: "PJ",
    pj: {
      cnpj: maskCNPJ(p.document || ""),
      razaoSocial: p.legalName || "",
      nomeFantasia: p.tradeName || "",
      dataAbertura: p.foundationDate ? String(p.foundationDate).slice(0, 10) : "",
      endereco: mappedAddress,
    },
    pf: {},
  };
}

function buildExtraData(values) {
  const personType = values?.personType === "PF" ? "PF" : "PJ";
  return {
    personType,
    pj: values?.pj || {},
    pf: values?.pf || {},
  };
}

function buildCompanyPayload(values) {
  // Mantém payload base como já era (compatível com backend atual)
  const base = {
    name: values?.name,
    email: values?.email,
    phone: values?.phone,
    planId: values?.planId,
    status: values?.status,
    dueDate: values?.dueDate,
    recurrence: values?.recurrence,
    campaignsEnabled: values?.campaignsEnabled,
  };
  // Compat: campos novos vão em extraData (e persistimos via /companies/:id/profile)
  return { ...base, extraData: buildExtraData(values) };
}

async function fetchCompanyProfile(companyId) {
  const { data } = await api.get(`/companies/${companyId}/profile`);
  return normalizeCompanyProfile(data?.profile || {});
}

async function saveCompanyProfile(companyId, profile) {
  await api.put(`/companies/${companyId}/profile`, { profile: profile || {} });
}

export function CompanyForm(props) {
  const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
  const classes = useStyles();
  const [plans, setPlans] = useState([]);
  const [modalUser, setModalUser] = useState(false);
  const [firstUser, setFirstUser] = useState({});
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const [record, setRecord] = useState({
    ...buildBlankCompanyValues(),
    ...initialValue,
  });

  const { list: listPlans } = usePlans();
  const blankValues = useMemo(() => buildBlankCompanyValues(), []);

  useEffect(() => {
    async function fetchData() {
      const list = await listPlans();
      setPlans(list);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRecord((prev) => {
      const next = { ...initialValue };
      const d = next && next.dueDate ? moment(next.dueDate) : null;
      next.dueDate =
        d && d.isValid() ? d.format("YYYY-MM-DD") : "";

      // profile pode vir de /companies/:id/profile (Settings) ou de algum campo anterior
      const profileRaw = next?.profile || next?.extraData;
      const profile = normalizeCompanyProfile(profileRaw);
      const pType = profile.personType === "PF" ? "PF" : "PJ";
      next.personType = pType;
      if (profile.pj && typeof profile.pj === "object") next.pj = { ...prev.pj, ...profile.pj };
      if (profile.pf && typeof profile.pf === "object") next.pf = { ...prev.pf, ...profile.pf };
      return {
        ...prev,
        ...next,
      };
    });
  }, [initialValue]);

  const handleSubmit = async (data) => {
    if (data.dueDate === "" || moment(data.dueDate).isValid() === false) {
      data.dueDate = null;
    }
    onSubmit(data);
    setRecord({ ...initialValue, dueDate: "" });
  };

  const handleOpenModalUsers = async () => {
    try {
      const { data } = await api.get("/users/list", {
        params: {
          companyId: initialValue.id,
        },
      });
      if (isArray(data) && data.length) {
        setFirstUser(head(data));
      }
      setModalUser(true);
    } catch (e) {
      toast.error(e);
    }
  };

  const handleCloseModalUsers = () => {
    setFirstUser({});
    setModalUser(false);
  };

  const incrementDueDate = () => {
    const data = { ...record };
    if (data.dueDate !== "" && data.dueDate !== null) {
      switch (data.recurrence) {
        case "MENSAL":
          data.dueDate = moment(data.dueDate)
            .add(1, "month")
            .format("YYYY-MM-DD");
          break;
        case "BIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(2, "month")
            .format("YYYY-MM-DD");
          break;
        case "TRIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(3, "month")
            .format("YYYY-MM-DD");
          break;
        case "SEMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(6, "month")
            .format("YYYY-MM-DD");
          break;
        case "ANUAL":
          data.dueDate = moment(data.dueDate)
            .add(12, "month")
            .format("YYYY-MM-DD");
          break;
        default:
          break;
      }
    }
    setRecord(data);
  };

  const validate = (values) => {
    const errors = {};
    const personType = values?.personType === "PF" ? "PF" : "PJ";

    if (!values?.personType) {
      errors.personType = "Selecione PJ ou PF.";
    }

    if (personType === "PF") {
      const cpf = values?.pf?.cpf;
      if (!cpf) {
        errors.pf = { ...(errors.pf || {}), cpf: "CPF é obrigatório." };
      } else if (!isValidCPF(cpf)) {
        errors.pf = { ...(errors.pf || {}), cpf: "CPF inválido." };
      }
      if (!values?.pf?.nomeCompleto) {
        errors.pf = { ...(errors.pf || {}), nomeCompleto: "Nome completo é obrigatório." };
      }
    } else {
      const cnpj = values?.pj?.cnpj;
      if (!cnpj || onlyDigitsMask(cnpj).length !== 14) {
        errors.pj = { ...(errors.pj || {}), cnpj: "CNPJ é obrigatório." };
      }
      if (!values?.pj?.razaoSocial) {
        errors.pj = { ...(errors.pj || {}), razaoSocial: "Razão Social é obrigatória." };
      }
      if (!values?.pj?.nomeFantasia) {
        errors.pj = { ...(errors.pj || {}), nomeFantasia: "Nome Fantasia é obrigatório." };
      }
    }

    return errors;
  };

  const handleBuscarCnpj = async (values, setFieldValue) => {
    const raw = onlyDigitsMask(values?.pj?.cnpj);
    if (!raw || raw.length !== 14) {
      toast.error("Informe um CNPJ válido (14 dígitos) para buscar.");
      return;
    }
    setCnpjLoading(true);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (!resp.ok) throw new Error("not_found");
      const data = await resp.json();

      const razao = data?.razao_social || "";
      const fantasia = data?.nome_fantasia || "";
      const natureza = data?.natureza_juridica || "";
      const situacao = data?.descricao_situacao_cadastral || data?.situacao_cadastral || "";
      const abertura = data?.data_inicio_atividade || data?.data_abertura || "";
      const cnaePrincipal = data?.cnae_fiscal_descricao || data?.cnae_fiscal || "";
      const cnaesSec = Array.isArray(data?.cnaes_secundarios)
        ? data.cnaes_secundarios
            .map((c) => c?.descricao || c?.codigo || "")
            .filter(Boolean)
            .join("\n")
        : "";
      const capital = data?.capital_social || "";

      const cep = data?.cep || "";
      const logradouro = data?.logradouro || "";
      const numero = data?.numero || "";
      const bairro = data?.bairro || "";
      const cidade = data?.municipio || data?.cidade || "";
      const uf = data?.uf || "";
      const complemento = data?.complemento || "";

      setFieldValue("pj.razaoSocial", razao);
      setFieldValue("pj.nomeFantasia", fantasia);
      setFieldValue("pj.naturezaJuridica", natureza);
      setFieldValue("pj.situacaoCadastral", situacao);
      setFieldValue("pj.dataAbertura", abertura ? String(abertura).slice(0, 10) : "");
      setFieldValue("pj.cnaePrincipal", cnaePrincipal);
      setFieldValue("pj.cnaesSecundarios", cnaesSec);
      setFieldValue("pj.capitalSocial", capital ? String(capital) : "");

      setFieldValue("pj.endereco.cep", maskCEP(cep));
      setFieldValue("pj.endereco.logradouro", logradouro);
      setFieldValue("pj.endereco.numero", String(numero || ""));
      setFieldValue("pj.endereco.bairro", bairro);
      setFieldValue("pj.endereco.cidade", cidade);
      setFieldValue("pj.endereco.uf", uf);
      setFieldValue("pj.endereco.complemento", complemento);

      if (!String(values?.name || "").trim()) {
        setFieldValue("name", fantasia || razao || "");
      }

      toast.success("CNPJ encontrado. Dados preenchidos!");
    } catch (e) {
      toast.error("CNPJ não encontrado ou inválido.");
    } finally {
      setCnpjLoading(false);
    }
  };

  return (
    <>
      <ModalUsers
        userId={firstUser.id}
        companyId={initialValue.id}
        open={modalUser}
        onClose={handleCloseModalUsers}
      />
      <Formik
        enableReinitialize
        className={classes.fullWidth}
        initialValues={record}
        validate={validate}
        onSubmit={(values, { resetForm }) =>
          setTimeout(() => {
            handleSubmit(values);
            resetForm();
          }, 500)
        }
      >
        {({ values, errors, touched, setFieldValue, resetForm }) => (
          <Form className={classes.fullWidth}>
            <Grid spacing={2} justifyContent="flex-end" container className={classes.formGrid}>
              {/* Dados principais */}
              <Grid xs={12} item>
                <div className={classes.subSection}>
                  <Typography variant="subtitle2" className={classes.subSectionTitle}>
                    <BusinessIcon fontSize="small" color="primary" />
                    Dados principais
                  </Typography>
                  <Typography variant="caption" className={classes.hint}>
                    Nome/contato e tipo de cadastro (PJ/PF).
                  </Typography>
                  <Divider style={{ margin: "12px 0" }} />

                  <Grid container spacing={2}>
                    <Grid xs={12} sm={6} md={4} item>
                      <FormControl margin="dense" variant="outlined" fullWidth size="small">
                        <InputLabel htmlFor="personType-selection">Tipo de Cadastro *</InputLabel>
                        <Field
                          as={Select}
                          id="personType-selection"
                          label="Tipo de Cadastro *"
                          labelId="personType-selection-label"
                          name="personType"
                          margin="dense"
                          required
                        >
                          <MenuItem value="PJ">Pessoa Jurídica (PJ)</MenuItem>
                          <MenuItem value="PF">Pessoa Física (PF)</MenuItem>
                        </Field>
                      </FormControl>
                      {touched?.personType && errors?.personType ? (
                        <Typography variant="caption" color="error">
                          {errors.personType}
                        </Typography>
                      ) : null}
                    </Grid>

                    <Grid xs={12} item>
                      <Field
                        as={TextField}
                        label="Nome"
                        name="name"
                        variant="outlined"
                        className={classes.fullWidth}
                        margin="dense"
                        size="small"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <BusinessIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid xs={12} sm={6} md={4} item>
                      <Field
                        as={TextField}
                        label="E-mail"
                        name="email"
                        variant="outlined"
                        className={classes.fullWidth}
                        margin="dense"
                        size="small"
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid xs={12} sm={6} md={4} item>
                      <Field name="phone">
                        {({ field }) => (
                          <TextField
                            {...field}
                            label="Telefone"
                            variant="outlined"
                            className={classes.fullWidth}
                            margin="dense"
                            size="small"
                            value={field.value || ""}
                            onChange={(e) => setFieldValue("phone", maskPhoneBR(e.target.value))}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PhoneIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                      </Field>
                    </Grid>
                  </Grid>
                </div>
              </Grid>

              {/* Plano e status */}
              <Grid xs={12} item>
                <div className={classes.subSection}>
                  <Typography variant="subtitle2" className={classes.subSectionTitle}>
                    <AssignmentIcon fontSize="small" color="primary" />
                    Plano e status
                  </Typography>
                  <Typography variant="caption" className={classes.hint}>
                    Defina plano, status e campanhas.
                  </Typography>
                  <Divider style={{ margin: "12px 0" }} />

                  <Grid container spacing={2}>
                    <Grid xs={12} sm={6} md={4} item>
                      <FormControl margin="dense" variant="outlined" fullWidth size="small">
                        <InputLabel htmlFor="plan-selection">Plano</InputLabel>
                        <Field
                          as={Select}
                          id="plan-selection"
                          label="Plano"
                          labelId="plan-selection-label"
                          name="planId"
                          margin="dense"
                          required
                        >
                          {plans.map((plan, key) => (
                            <MenuItem key={key} value={plan.id}>
                              {plan.name}
                            </MenuItem>
                          ))}
                        </Field>
                      </FormControl>
                    </Grid>
                    <Grid xs={12} sm={6} md={4} item>
                      <FormControl margin="dense" variant="outlined" fullWidth size="small">
                        <InputLabel htmlFor="status-selection">Status</InputLabel>
                        <Field
                          as={Select}
                          id="status-selection"
                          label="Status"
                          labelId="status-selection-label"
                          name="status"
                          margin="dense"
                        >
                          <MenuItem value={true}>Sim</MenuItem>
                          <MenuItem value={false}>Não</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>
                    <Grid xs={12} sm={6} md={4} item>
                      <FormControl margin="dense" variant="outlined" fullWidth size="small">
                        <InputLabel htmlFor="campaigns-selection">Campanhas</InputLabel>
                        <Field
                          as={Select}
                          id="campaigns-selection"
                          label="Campanhas"
                          labelId="campaigns-selection-label"
                          name="campaignsEnabled"
                          margin="dense"
                        >
                          <MenuItem value={true}>Habilitadas</MenuItem>
                          <MenuItem value={false}>Desabilitadas</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>
                  </Grid>
                </div>
              </Grid>

              {/* Cobrança */}
              <Grid xs={12} item>
                <div className={classes.subSection}>
                  <Typography variant="subtitle2" className={classes.subSectionTitle}>
                    <EventIcon fontSize="small" color="primary" />
                    Cobrança
                  </Typography>
                  <Typography variant="caption" className={classes.hint}>
                    Controle de vencimento e recorrência.
                  </Typography>
                  <Divider style={{ margin: "12px 0" }} />

                  <Grid container spacing={2}>
                    <Grid xs={12} sm={6} md={4} item>
                      <FormControl variant="outlined" fullWidth size="small">
                        <Field
                          as={TextField}
                          label="Data de Vencimento"
                          type="date"
                          name="dueDate"
                          InputLabelProps={{ shrink: true }}
                          variant="outlined"
                          fullWidth
                          margin="dense"
                          size="small"
                        />
                      </FormControl>
                    </Grid>
                    <Grid xs={12} sm={6} md={4} item>
                      <FormControl margin="dense" variant="outlined" fullWidth size="small">
                        <InputLabel htmlFor="recorrencia-selection">Recorrência</InputLabel>
                        <Field
                          as={Select}
                          label="Recorrência"
                          labelId="recorrencia-selection-label"
                          id="recorrencia-selection"
                          name="recurrence"
                          margin="dense"
                        >
                          <MenuItem value="MENSAL">Mensal</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>
                  </Grid>
                </div>
              </Grid>

              {/* Campos PJ/PF (salvos em /companies/:id/profile) */}
              {values.personType === "PJ" ? (
                <>
                  <Grid xs={12} item>
                    <div className={classes.subSection}>
                      <Typography variant="subtitle2" className={classes.subSectionTitle}>
                        <AssignmentIndIcon fontSize="small" color="primary" />
                        Pessoa Jurídica (PJ)
                      </Typography>
                      <Typography variant="caption" className={classes.hint}>
                        CNPJ + dados cadastrais. Você pode buscar pela BrasilAPI.
                      </Typography>
                      <Divider style={{ margin: "12px 0" }} />

                      <Grid container spacing={2}>
                        <Grid xs={12} md={8} item>
                          <Field name="pj.cnpj">
                            {({ field }) => (
                              <TextField
                                {...field}
                                label="CNPJ *"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                size="small"
                                value={field.value || ""}
                                onChange={(e) => setFieldValue("pj.cnpj", maskCNPJ(e.target.value))}
                                error={Boolean(touched?.pj?.cnpj && errors?.pj?.cnpj)}
                                helperText={touched?.pj?.cnpj && errors?.pj?.cnpj ? errors.pj.cnpj : " "}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <AssignmentIndIcon fontSize="small" />
                                    </InputAdornment>
                                  ),
                                }}
                              />
                            )}
                          </Field>
                        </Grid>
                        <Grid xs={12} md={4} item style={{ display: "flex", alignItems: "center" }}>
                          <ButtonWithSpinner
                            loading={cnpjLoading}
                            variant="contained"
                            color="primary"
                            onClick={() => handleBuscarCnpj(values, setFieldValue)}
                            className={classes.fullWidth}
                            style={{ marginTop: 6 }}
                          >
                            Buscar CNPJ
                          </ButtonWithSpinner>
                        </Grid>

                        <Grid xs={12} item>
                          <Field
                            as={TextField}
                            label="Razão Social *"
                            name="pj.razaoSocial"
                            variant="outlined"
                            className={classes.fullWidth}
                            margin="dense"
                            size="small"
                            required
                            error={Boolean(touched?.pj?.razaoSocial && errors?.pj?.razaoSocial)}
                            helperText={touched?.pj?.razaoSocial && errors?.pj?.razaoSocial ? errors.pj.razaoSocial : " "}
                          />
                        </Grid>
                        <Grid xs={12} item>
                          <Field
                            as={TextField}
                            label="Nome Fantasia *"
                            name="pj.nomeFantasia"
                            variant="outlined"
                            className={classes.fullWidth}
                            margin="dense"
                            size="small"
                            required
                            error={Boolean(touched?.pj?.nomeFantasia && errors?.pj?.nomeFantasia)}
                            helperText={touched?.pj?.nomeFantasia && errors?.pj?.nomeFantasia ? errors.pj.nomeFantasia : " "}
                          />
                        </Grid>

                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Natureza Jurídica" name="pj.naturezaJuridica" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Data de abertura" name="pj.dataAbertura" type="date" InputLabelProps={{ shrink: true }} variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Situação cadastral" name="pj.situacaoCadastral" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={6} item>
                          <Field as={TextField} size="small" label="CNAE principal" name="pj.cnaePrincipal" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} item>
                          <Field as={TextField} size="small" label="CNAEs secundários" name="pj.cnaesSecundarios" variant="outlined" className={classes.fullWidth} margin="dense" multiline rows={3} />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Capital social" name="pj.capitalSocial" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <FormControl margin="dense" variant="outlined" fullWidth size="small">
                            <InputLabel htmlFor="regime-selection">Regime tributário</InputLabel>
                            <Field as={Select} id="regime-selection" label="Regime tributário" name="pj.regimeTributario" margin="dense">
                              <MenuItem value="">Não informado</MenuItem>
                              <MenuItem value="Simples">Simples</MenuItem>
                              <MenuItem value="Lucro Presumido">Lucro Presumido</MenuItem>
                              <MenuItem value="Lucro Real">Lucro Real</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>

                        {/* Sócios / Administradores */}
                        <Grid xs={12} item>
                          <Divider style={{ margin: "12px 0" }} />
                          <Typography variant="subtitle2" className={classes.subSectionTitle}>
                            <GroupAddIcon fontSize="small" color="primary" />
                            Sócios / Administradores (opcional)
                          </Typography>
                          <Typography variant="caption" className={classes.hint}>
                            Lista simples — fica salva em <b>extraData.pj.socios</b>.
                          </Typography>
                        </Grid>

                        <Grid xs={12} item>
                          <FieldArray
                            name="pj.socios"
                            render={(arrayHelpers) => (
                              <Grid container spacing={2}>
                                {(Array.isArray(values?.pj?.socios) ? values.pj.socios : []).map((s, idx) => (
                                  <Grid key={idx} xs={12} item>
                                    <div className={classes.subSection}>
                                      <Grid container spacing={2} alignItems="center">
                                        <Grid xs={12} md={4} item>
                                          <Field
                                            as={TextField}
                                            size="small"
                                            label="Nome"
                                            name={`pj.socios.${idx}.nome`}
                                            variant="outlined"
                                            className={classes.fullWidth}
                                            margin="dense"
                                          />
                                        </Grid>
                                        <Grid xs={12} md={3} item>
                                          <Field name={`pj.socios.${idx}.cpf`}>
                                            {({ field }) => (
                                              <TextField
                                                {...field}
                                                size="small"
                                                label="CPF"
                                                variant="outlined"
                                                className={classes.fullWidth}
                                                margin="dense"
                                                value={field.value || ""}
                                                onChange={(e) => setFieldValue(`pj.socios.${idx}.cpf`, maskCPF(e.target.value))}
                                              />
                                            )}
                                          </Field>
                                        </Grid>
                                        <Grid xs={12} md={4} item>
                                          <Field
                                            as={TextField}
                                            size="small"
                                            label="Qualificação"
                                            name={`pj.socios.${idx}.qualificacao`}
                                            variant="outlined"
                                            className={classes.fullWidth}
                                            margin="dense"
                                          />
                                        </Grid>
                                        <Grid xs={12} md={1} item>
                                          <div className={classes.inlineActions}>
                                            <IconButton
                                              size="small"
                                              className={classes.removeMiniBtn}
                                              onClick={() => arrayHelpers.remove(idx)}
                                              aria-label="Remover sócio"
                                            >
                                              <HighlightOffIcon fontSize="small" style={{ color: "#d32f2f" }} />
                                            </IconButton>
                                          </div>
                                        </Grid>
                                      </Grid>
                                    </div>
                                  </Grid>
                                ))}

                                <Grid xs={12} sm={6} md={4} item>
                                  <ButtonWithSpinner
                                    variant="contained"
                                    onClick={() => arrayHelpers.push({ nome: "", cpf: "", qualificacao: "" })}
                                    className={classes.fullWidth}
                                  >
                                    Adicionar sócio
                                  </ButtonWithSpinner>
                                </Grid>
                              </Grid>
                            )}
                          />
                        </Grid>

                        {/* Endereço PJ */}
                        <Grid xs={12} item>
                          <Divider style={{ margin: "12px 0" }} />
                          <Typography variant="subtitle2" className={classes.subSectionTitle}>
                            <HomeOutlinedIcon fontSize="small" color="primary" />
                            Endereço (PJ)
                          </Typography>
                        </Grid>
                        <Grid xs={12} sm={6} md={3} item>
                          <Field name="pj.endereco.cep">
                            {({ field }) => (
                              <TextField
                                {...field}
                                label="CEP"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                size="small"
                                value={field.value || ""}
                                onChange={(e) => setFieldValue("pj.endereco.cep", maskCEP(e.target.value))}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <HomeOutlinedIcon fontSize="small" />
                                    </InputAdornment>
                                  ),
                                }}
                              />
                            )}
                          </Field>
                        </Grid>
                        <Grid xs={12} sm={6} md={7} item>
                          <Field as={TextField} size="small" label="Logradouro" name="pj.endereco.logradouro" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={2} item>
                          <Field as={TextField} size="small" label="Número" name="pj.endereco.numero" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Bairro" name="pj.endereco.bairro" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={6} item>
                          <Field as={TextField} size="small" label="Cidade" name="pj.endereco.cidade" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={2} item>
                          <Field as={TextField} size="small" label="UF" name="pj.endereco.uf" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} item>
                          <Field as={TextField} size="small" label="Complemento" name="pj.endereco.complemento" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                      </Grid>
                    </div>
                  </Grid>
                </>
              ) : (
                <>
                  <Grid xs={12} item>
                    <div className={classes.subSection}>
                      <Typography variant="subtitle2" className={classes.subSectionTitle}>
                        <AssignmentIndIcon fontSize="small" color="primary" />
                        Pessoa Física (PF)
                      </Typography>
                      <Typography variant="caption" className={classes.hint}>
                        CPF com validação matemática + dados pessoais.
                      </Typography>
                      <Divider style={{ margin: "12px 0" }} />

                      <Grid container spacing={2}>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field name="pf.cpf">
                            {({ field }) => (
                              <TextField
                                {...field}
                                label="CPF *"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                size="small"
                                value={field.value || ""}
                                onChange={(e) => setFieldValue("pf.cpf", maskCPF(e.target.value))}
                                error={Boolean(touched?.pf?.cpf && errors?.pf?.cpf)}
                                helperText={touched?.pf?.cpf && errors?.pf?.cpf ? errors.pf.cpf : " "}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <AssignmentIndIcon fontSize="small" />
                                    </InputAdornment>
                                  ),
                                }}
                              />
                            )}
                          </Field>
                        </Grid>
                        <Grid xs={12} item>
                          <Field
                            as={TextField}
                            label="Nome completo *"
                            name="pf.nomeCompleto"
                            variant="outlined"
                            className={classes.fullWidth}
                            margin="dense"
                            size="small"
                            required
                            error={Boolean(touched?.pf?.nomeCompleto && errors?.pf?.nomeCompleto)}
                            helperText={touched?.pf?.nomeCompleto && errors?.pf?.nomeCompleto ? errors.pf.nomeCompleto : " "}
                          />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Data de nascimento" name="pf.dataNascimento" type="date" InputLabelProps={{ shrink: true }} variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Nome da mãe" name="pf.nomeMae" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <FormControl margin="dense" variant="outlined" fullWidth size="small">
                            <InputLabel htmlFor="sexo-selection">Sexo</InputLabel>
                            <Field as={Select} id="sexo-selection" label="Sexo" name="pf.sexo" margin="dense">
                              <MenuItem value="">Não informado</MenuItem>
                              <MenuItem value="F">Feminino</MenuItem>
                              <MenuItem value="M">Masculino</MenuItem>
                              <MenuItem value="O">Outro</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Estado civil" name="pf.estadoCivil" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>

                        <Grid xs={12} item>
                          <Divider style={{ margin: "12px 0" }} />
                          <Typography variant="subtitle2" className={classes.subSectionTitle}>
                            <AssignmentIcon fontSize="small" color="primary" />
                            RG (opcional)
                          </Typography>
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Número" name="pf.rg.numero" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Órgão emissor" name="pf.rg.orgaoEmissor" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="UF" name="pf.rg.uf" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>

                        {/* Endereço PF */}
                        <Grid xs={12} item>
                          <Divider style={{ margin: "12px 0" }} />
                          <Typography variant="subtitle2" className={classes.subSectionTitle}>
                            <HomeOutlinedIcon fontSize="small" color="primary" />
                            Endereço (PF)
                          </Typography>
                        </Grid>
                        <Grid xs={12} sm={6} md={3} item>
                          <Field name="pf.endereco.cep">
                            {({ field }) => (
                              <TextField
                                {...field}
                                label="CEP"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                size="small"
                                value={field.value || ""}
                                onChange={(e) => setFieldValue("pf.endereco.cep", maskCEP(e.target.value))}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <HomeOutlinedIcon fontSize="small" />
                                    </InputAdornment>
                                  ),
                                }}
                              />
                            )}
                          </Field>
                        </Grid>
                        <Grid xs={12} sm={6} md={7} item>
                          <Field as={TextField} size="small" label="Logradouro" name="pf.endereco.logradouro" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={2} item>
                          <Field as={TextField} size="small" label="Número" name="pf.endereco.numero" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={4} item>
                          <Field as={TextField} size="small" label="Bairro" name="pf.endereco.bairro" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={6} item>
                          <Field as={TextField} size="small" label="Cidade" name="pf.endereco.cidade" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} sm={6} md={2} item>
                          <Field as={TextField} size="small" label="UF" name="pf.endereco.uf" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                        <Grid xs={12} item>
                          <Field as={TextField} size="small" label="Complemento" name="pf.endereco.complemento" variant="outlined" className={classes.fullWidth} margin="dense" />
                        </Grid>
                      </Grid>
                    </div>
                  </Grid>
                </>
              )}

              <Grid xs={12} item>
                <Grid justifyContent="flex-end" spacing={2} container style={{ marginTop: 4 }}>
                  <Grid xs={12} sm={4} md={3} item>
                    <ButtonWithSpinner
                      className={classes.fullWidth}
                      style={{ marginTop: 7 }}
                      loading={loading}
                      onClick={() => {
                        // Importante: limpar precisa resetar o form imediatamente (mesmo enquanto digita),
                        // e também sair do modo edição (onCancel).
                        const nextBlank = {
                          ...blankValues,
                          // preserva seleção atual se quiser manter contexto
                          personType: values?.personType === "PF" ? "PF" : "PJ",
                        };
                        resetForm({ values: nextBlank });
                        onCancel();
                      }}
                      variant="contained"
                    >
                      Limpar
                    </ButtonWithSpinner>
                  </Grid>
                  {record.id !== undefined ? (
                    <>
                      <Grid xs={12} sm={4} md={3} item>
                        <ButtonWithSpinner
                          style={{ marginTop: 7 }}
                          className={classes.fullWidth}
                          loading={loading}
                          onClick={() => onDelete(record)}
                          variant="contained"
                          color="secondary"
                        >
                          Excluir
                        </ButtonWithSpinner>
                      </Grid>
                      <Grid xs={12} sm={4} md={3} item>
                        <ButtonWithSpinner
                          style={{ marginTop: 7 }}
                          className={classes.fullWidth}
                          loading={loading}
                          onClick={() => incrementDueDate()}
                          variant="contained"
                          color="primary"
                        >
                          + Vencimento
                        </ButtonWithSpinner>
                      </Grid>
                      <Grid xs={12} sm={4} md={3} item>
                        <ButtonWithSpinner
                          style={{ marginTop: 7 }}
                          className={classes.fullWidth}
                          loading={loading}
                          onClick={() => handleOpenModalUsers()}
                          variant="contained"
                          color="primary"
                        >
                          Usuário
                        </ButtonWithSpinner>
                      </Grid>
                    </>
                  ) : null}
                  <Grid xs={12} sm={4} md={3} item>
                    <ButtonWithSpinner
                      className={classes.fullWidth}
                      style={{ marginTop: 7 }}
                      loading={loading}
                      type="submit"
                      variant="contained"
                      color="primary"
                    >
                      Salvar
                    </ButtonWithSpinner>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    </>
  );
}

export function CompaniesManagerGrid(props) {
  const { records, onSelect, onDelete, profilesById } = props;
  const classes = useStyles();
  const { dateToClient } = useDate();

  const renderStatus = (row) => {
    return row.status === false ? "Não" : "Sim";
  };

  const renderPlan = (row) => {
    if (row && row.plan && row.plan.name) return row.plan.name;
    if (row && (row.planId || row.planId === 0)) return String(row.planId);
    return "-";
  };

  const renderCampaignsStatus = (row) => {
    if (
      has(row, "settings") &&
      isArray(row.settings) &&
      row.settings.length > 0
    ) {
      const setting = row.settings.find((s) => s.key === "campaignsEnabled");
      if (setting) {
        return setting.value === "true" ? "Habilitadas" : "Desabilitadas";
      }
    }
    return "Desabilitadas";
  };

  return (
    <Grid container spacing={2} className={classes.cardsGrid}>
      {(records || []).filter(Boolean).map((row) => {
        const profile = profilesById && row?.id ? profilesById[row.id] : null;
        const pType = profile?.personType === "PF" ? "PF" : profile?.personType === "PJ" ? "PJ" : "";
        const due = dueChip(row.dueDate, row.recurrence);
        const planName = renderPlan(row);
        const campaigns = renderCampaignsStatus(row);
        const status = renderStatus(row);
        return (
          <Grid item xs={12} sm={6} md={4} key={row.id || row.name}>
            <Card className={classes.companyCard} elevation={0}>
              <CardContent>
                <div className={classes.titleRow}>
                  <Typography variant="subtitle1" className={classes.companyName}>
                    {row.name || "-"}
                  </Typography>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {pType ? (
                      <Chip size="small" variant="outlined" className={classes.pill} label={pType} />
                    ) : null}
                    <Chip
                      size="small"
                      className={`${classes.pill} ${classes.pillPrimary}`}
                      icon={<AssignmentIcon fontSize="small" />}
                      label={planName}
                    />
                  </div>
                </div>

                {pType === "PJ" ? (
                  <Typography variant="body2" style={{ marginTop: 8, opacity: 0.9 }}>
                    <b>CNPJ:</b> {profile?.pj?.cnpj || "-"} {profile?.pj?.razaoSocial ? `• ${profile.pj.razaoSocial}` : ""}
                  </Typography>
                ) : pType === "PF" ? (
                  <Typography variant="body2" style={{ marginTop: 8, opacity: 0.9 }}>
                    <b>CPF:</b> {profile?.pf?.cpf || "-"} {profile?.pf?.nomeCompleto ? `• ${profile.pf.nomeCompleto}` : ""}
                  </Typography>
                ) : null}

                <div className={classes.metaRow}>
                  <div className={classes.metaItem}>
                    <EmailIcon fontSize="small" style={{ opacity: 0.85 }} />
                    <div>
                      <div className={classes.metaLabel}>E-mail</div>
                      <div className={classes.metaValue}>{row.email || "-"}</div>
                    </div>
                  </div>
                  <div className={classes.metaItem}>
                    <PhoneIcon fontSize="small" style={{ opacity: 0.85 }} />
                    <div>
                      <div className={classes.metaLabel}>Telefone</div>
                      <div className={classes.metaValue}>{row.phone || "-"}</div>
                    </div>
                  </div>
                  <div className={classes.metaItem}>
                    <EventIcon fontSize="small" style={{ opacity: 0.85 }} />
                    <div>
                      <div className={classes.metaLabel}>Criada em</div>
                      <div className={classes.metaValue}>{dateToClient(row.createdAt)}</div>
                    </div>
                  </div>
                </div>

                <Divider style={{ margin: "12px 0" }} />

                <div className={classes.metaRow} style={{ marginTop: 0 }}>
                  <Chip size="small" variant="outlined" className={classes.pill} label={`Status: ${status}`} />
                  <Chip size="small" variant="outlined" className={classes.pill} label={`Campanhas: ${campaigns}`} />
                  <Chip size="small" color={due.color} className={classes.pill} label={due.label} />
                </div>
              </CardContent>

              <div className={classes.actions}>
                <IconButton
                  className={classes.iconBtn}
                  size="small"
                  color="primary"
                  onClick={() => onSelect(row)}
                  aria-label={`Editar empresa ${row.name || ""}`}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  className={classes.iconBtn}
                  size="small"
                  style={{ color: "#d32f2f" }}
                  onClick={() => onDelete && onDelete(row)}
                  aria-label={`Excluir empresa ${row.name || ""}`}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </div>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

export default function CompaniesManager() {
  const classes = useStyles();
  const { list, save, update, remove } = useCompanies();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    dueDate: "",
    recurrence: "",
  });

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const companyList = await list();
      const safe = Array.isArray(companyList)
        ? companyList.filter((c) => c && typeof c === "object" && (c.id !== undefined || c.name !== undefined))
        : [];
      setRecords(safe);

      // Cache perfis PJ/PF (não bloquear caso falhe)
      try {
        const ids = safe.map((c) => c?.id).filter(Boolean);
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const profile = await fetchCompanyProfile(id);
              return [id, profile];
            } catch {
              return [id, null];
            }
          })
        );
        const map = {};
        results.forEach(([id, profile]) => {
          if (id) map[id] = profile || {};
        });
        setProfilesById(map);
      } catch {}
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoading(false);
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = buildCompanyPayload(data);
      let savedCompany = null;
      if (data.id !== undefined) {
        // IMPORTANTE: o hook de update usa data.id para montar a URL.
        // Sem isso vira /companies/undefined.
        savedCompany = await update({ id: data.id, ...payload });
      } else {
        savedCompany = await save(payload);
      }

      // Persistência segura dos novos campos (Settings -> companyProfile)
      const companyId = Number(savedCompany?.id || data?.id || 0);
      if (companyId) {
        try {
          await saveCompanyProfile(companyId, payload.extraData);
          setProfilesById((prev) => ({ ...(prev || {}), [companyId]: payload.extraData }));
        } catch {}
      }
      await loadPlans();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error(
        "Não foi possível realizar a operação. Verifique se já existe uma empresa com o mesmo nome ou se os campos foram preenchidos corretamente"
      );
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await remove(record.id);
      await loadPlans();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setLoading(false);
  };

  const handleOpenDeleteDialog = () => {
    setShowConfirmDialog(true);
  };

  const handleCancel = () => {
    setRecord((prev) => ({
      ...prev,
      id: undefined,
      name: "",
      email: "",
      phone: "",
      planId: "",
      status: true,
      campaignsEnabled: false,
      dueDate: "",
      recurrence: "",
      profile: undefined,
    }));
  };

  const handleSelect = async (data) => {
    let campaignsEnabled = false;

    const setting = Array.isArray(data?.settings)
      ? data.settings.find((s) => String(s?.key || "").indexOf("campaignsEnabled") > -1)
      : null;
    if (setting) {
      campaignsEnabled =
        setting.value === "true" || setting.value === "enabled";
    }

    const selectedId = data?.id;

    // Seta imediatamente o básico (UI responsiva) e tenta usar cache de profile se existir
    setRecord((prev) => ({
      ...prev,
      id: data.id,
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      planId: data.planId || "",
      status: data.status === false ? false : true,
      campaignsEnabled,
      dueDate: data.dueDate || "",
      recurrence: data.recurrence || "",
      profile: profilesById && data?.id ? profilesById[data.id] : undefined,
    }));

    // Garantia: ao editar, sempre buscar o profile PJ/PF (Settings) sob demanda.
    // Isso evita abrir o form sem os campos preenchidos caso o prefetch falhe/atraso.
    if (!selectedId) return;
    const cached = profilesById && profilesById[selectedId];
    const hasCached = cached && typeof cached === "object" && (cached.personType || cached.pj || cached.pf);
    if (hasCached) return;

    try {
      const profile = await fetchCompanyProfile(selectedId);
      setProfilesById((prev) => ({ ...(prev || {}), [selectedId]: profile || {} }));
      // só aplica se ainda for a empresa selecionada (evita race)
      setRecord((prev) => {
        if (prev?.id !== selectedId) return prev;
        return { ...prev, profile: profile || {} };
      });
    } catch {
      // silencioso: o form ainda funciona com dados básicos
    }
  };

  return (
    <Grid spacing={2} container>
      <Grid xs={12} item>
        <Card className={classes.softCard} elevation={0}>
          <CardHeader
            className={classes.sectionHeader}
            avatar={<BusinessIcon color="primary" />}
            title={record?.id ? "Editar empresa" : "Cadastro de Empresas"}
            subheader="Gerencie nome, contato, plano e recorrência"
          />
          <CardContent>
            <CompanyForm
              initialValue={record}
              onDelete={handleOpenDeleteDialog}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              loading={loading}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid xs={12} item>
        <Card className={classes.softCard} elevation={0}>
          <CardHeader
            className={classes.sectionHeader}
            avatar={<ListAltIcon color="primary" />}
            title="Empresas cadastradas"
            subheader={`${Array.isArray(records) ? records.length : 0} item(ns)`}
          />
          <CardContent>
            <CompaniesManagerGrid
              records={records}
              onSelect={handleSelect}
              profilesById={profilesById}
              onDelete={(row) => {
                handleSelect(row);
                handleOpenDeleteDialog();
              }}
            />
          </CardContent>
        </Card>
      </Grid>
      <ConfirmationModal
        title="Exclusão de Registro"
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleDelete()}
      >
        Deseja realmente excluir esse registro?
      </ConfirmationModal>
    </Grid>
  );
}
