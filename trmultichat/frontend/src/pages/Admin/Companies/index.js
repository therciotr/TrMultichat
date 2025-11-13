import React, { useEffect, useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Grid,
  TextField,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from "@material-ui/core";
import MainContainer from "../../../components/MainContainer";
import Title from "../../../components/Title";
import { TrButton } from "../../../components/ui";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  card: { borderRadius: 12 },
  header: {
    borderRadius: 12,
    padding: theme.spacing(3),
    color: "#fff",
    background: "linear-gradient(135deg, #0f9b0f 0%, #00b09b 100%)",
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    fontWeight: 600,
    margin: theme.spacing(2, 0, 1)
  }
}));

export default function CompaniesAdmin() {
  const classes = useStyles();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(0);
  const [base, setBase] = useState({ id: 0, name: "", planId: "", token: "" });
  const [profile, setProfile] = useState({
    personType: "PJ",
    legalName: "",
    tradeName: "",
    document: "",
    stateRegistration: "",
    municipalRegistration: "",
    birthDate: "",
    foundationDate: "",
    email: "",
    phone: "",
    website: "",
    address: { zip: "", street: "", number: "", complement: "", district: "", city: "", state: "", country: "Brasil" },
    billingEmail: "",
    pixKey: "",
    notes: ""
  });

  const isEditing = useMemo(() => !!selectedId, [selectedId]);

  async function loadCompanies() {
    setLoading(true);
    try {
      const { data } = await api.get("/companies");
      const safe = Array.isArray(data)
        ? data.filter((c) => c && typeof c === "object" && (c.id !== undefined || c.name !== undefined))
        : [];
      setCompanies(safe);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(id) {
    if (!id) return;
    try {
      const { data } = await api.get(`/companies/${id}/profile`);
      const p = (data && data.profile) || {};
      setProfile({
        personType: p.personType || "PJ",
        legalName: p.legalName || "",
        tradeName: p.tradeName || "",
        document: p.document || "",
        stateRegistration: p.stateRegistration || "",
        municipalRegistration: p.municipalRegistration || "",
        birthDate: p.birthDate || "",
        foundationDate: p.foundationDate || "",
        email: p.email || "",
        phone: p.phone || "",
        website: p.website || "",
        address: {
          zip: (p.address && p.address.zip) || "",
          street: (p.address && p.address.street) || "",
          number: (p.address && p.address.number) || "",
          complement: (p.address && p.address.complement) || "",
          district: (p.address && p.address.district) || "",
          city: (p.address && p.address.city) || "",
          state: (p.address && p.address.state) || "",
          country: (p.address && p.address.country) || "Brasil"
        },
        billingEmail: p.billingEmail || "",
        pixKey: p.pixKey || "",
        notes: p.notes || ""
      });
    } catch (e) {
      toastError(e);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedId) {
      const found = companies.find((c) => c.id === selectedId);
      const nm = found?.name || "";
      setBase({ id: selectedId, name: nm, planId: String(found?.planId || ""), token: String(found?.token || "") });
      loadProfile(selectedId);
    } else {
      setBase({ id: 0, name: "", planId: "", token: "" });
      setProfile({
        personType: "PJ",
        legalName: "",
        tradeName: "",
        document: "",
        stateRegistration: "",
        municipalRegistration: "",
        birthDate: "",
        foundationDate: "",
        email: "",
        phone: "",
        website: "",
        address: { zip: "", street: "", number: "", complement: "", district: "", city: "", state: "", country: "Brasil" },
        billingEmail: "",
        pixKey: "",
        notes: ""
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function createCompany() {
    try {
      const { data } = await api.post("/companies", { name: base.name, planId: base.planId || null, token: base.token || "" });
      setSelectedId(Number(data?.id || 0));
      await loadCompanies();
    } catch (e) {
      toastError(e);
    }
  }

  async function updateCompany() {
    if (!selectedId) return;
    try {
      await api.put(`/companies/${selectedId}`, { name: base.name, planId: base.planId || null, token: base.token || "" });
      await loadCompanies();
    } catch (e) {
      toastError(e);
    }
  }

  async function saveProfile() {
    if (!selectedId) return;
    try {
      await api.put(`/companies/${selectedId}/profile`, { profile });
      await loadCompanies();
    } catch (e) {
      toastError(e);
    }
  }

  async function removeCompany(id) {
    if (!id) return;
    if (!window.confirm("Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.")) return;
    try {
      await api.delete(`/companies/${id}`);
      if (selectedId === id) setSelectedId(0);
      await loadCompanies();
    } catch (e) {
      toastError(e);
    }
  }

  // Helpers de máscara/formatacao
  const onlyDigits = (v) => (v || "").replace(/\D+/g, "");
  const formatCpfCnpj = (v) => {
    const d = onlyDigits(v).slice(0, 14);
    if (d.length <= 11) {
      // CPF 000.000.000-00
      return d
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }
    // CNPJ 00.000.000/0000-00
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };
  const formatCep = (v) => {
    const d = onlyDigits(v).slice(0, 8);
    return d.replace(/^(\d{5})(\d)/, "$1-$2");
  };
  const formatPhoneBr = (v) => {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length <= 10) {
      return d
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  async function tryCepLookup(zipRaw) {
    const cepDigits = onlyDigits(zipRaw);
    if (cepDigits.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await resp.json();
      if (data && !data.erro) {
        setProfile((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            zip: formatCep(cepDigits),
            street: data.logradouro || prev.address.street,
            complement: data.complemento || prev.address.complement,
            district: data.bairro || prev.address.district,
            city: data.localidade || prev.address.city,
            state: data.uf || prev.address.state,
            country: prev.address.country || "Brasil",
          },
        }));
      }
    } catch (_) {
      // ignorar erros de CEP
    }
  }

  return (
    <MainContainer>
      <div className={classes.header}>
        <Title>Cadastro de Empresas</Title>
        <div>Cadastre e edite dados completos de empresas (PF/PJ) para um onboarding profissional.</div>
      </div>
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title={isEditing ? "Editar empresa" : "Nova empresa"} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    select
                    fullWidth
                    label="Selecionar empresa para editar"
                    value={selectedId}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                    variant="outlined"
                  >
                    <MenuItem value={0}>— Nova empresa —</MenuItem>
                    {companies.filter(Boolean).map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name || `Empresa ${c.id}`}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <>
                  <Grid item xs={12}>
                    <TextField label="Nome (Fantasia ou Razão Social)" value={base.name} onChange={(e) => setBase({ ...base, name: e.target.value })} fullWidth variant="outlined" />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Plano (opcional)" value={base.planId} onChange={(e) => setBase({ ...base, planId: e.target.value })} fullWidth variant="outlined" />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Token (opcional)" value={base.token} onChange={(e) => setBase({ ...base, token: e.target.value })} fullWidth variant="outlined" />
                  </Grid>
                </>
              </Grid>
            </CardContent>
            <CardActions>
              {!isEditing && <TrButton onClick={createCompany} disabled={loading || !base.name}>Criar empresa</TrButton>}
              {isEditing && (
                <>
                  <TrButton onClick={updateCompany} disabled={loading || !base.name}>Salvar dados básicos</TrButton>
                  <TrButton variant="outlined" onClick={() => removeCompany(selectedId)}>Excluir empresa</TrButton>
                  <TrButton variant="outlined" onClick={() => setSelectedId(0)}>Nova empresa</TrButton>
                </>
              )}
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Perfil completo" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    fullWidth
                    label="Tipo de pessoa"
                    value={profile.personType}
                    onChange={(e) => setProfile({ ...profile, personType: e.target.value })}
                    variant="outlined"
                  >
                    <MenuItem value="PJ">Pessoa Jurídica (PJ)</MenuItem>
                    <MenuItem value="PF">Pessoa Física (PF)</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    label={profile.personType === "PJ" ? "Razão Social" : "Nome completo"}
                    value={profile.legalName}
                    onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                    fullWidth
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={profile.personType === "PJ" ? "Nome Fantasia" : "Apelido"}
                    value={profile.tradeName}
                    onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })}
                    fullWidth
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={profile.personType === "PJ" ? "CNPJ" : "CPF"}
                    value={profile.document}
                    onChange={(e) => setProfile({ ...profile, document: formatCpfCnpj(e.target.value) })}
                    fullWidth
                    variant="outlined"
                  />
                </Grid>
                {profile.personType === "PJ" ? (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField label="Inscrição Estadual (IE)" value={profile.stateRegistration} onChange={(e) => setProfile({ ...profile, stateRegistration: e.target.value })} fullWidth variant="outlined" />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField label="Inscrição Municipal (IM)" value={profile.municipalRegistration} onChange={(e) => setProfile({ ...profile, municipalRegistration: e.target.value })} fullWidth variant="outlined" />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField label="Data de fundação" type="date" value={profile.foundationDate} onChange={(e) => setProfile({ ...profile, foundationDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} variant="outlined" />
                    </Grid>
                  </>
                ) : (
                  <Grid item xs={12} md={6}>
                    <TextField label="Data de nascimento" type="date" value={profile.birthDate} onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} variant="outlined" />
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <TextField label="E-mail" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Telefone/WhatsApp" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: formatPhoneBr(e.target.value) })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Site" value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} fullWidth variant="outlined" />
                </Grid>

                <Grid item xs={12}>
                  <div className={classes.sectionTitle}>Endereço</div>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="CEP"
                    value={profile.address.zip}
                    onChange={(e) => {
                      const value = formatCep(e.target.value);
                      setProfile({ ...profile, address: { ...profile.address, zip: value } });
                    }}
                    onBlur={(e) => tryCepLookup(e.target.value)}
                    fullWidth
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Logradouro" value={profile.address.street} onChange={(e) => setProfile({ ...profile, address: { ...profile.address, street: e.target.value } })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField label="Número" value={profile.address.number} onChange={(e) => setProfile({ ...profile, address: { ...profile.address, number: e.target.value } })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Complemento" value={profile.address.complement} onChange={(e) => setProfile({ ...profile, address: { ...profile.address, complement: e.target.value } })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Bairro" value={profile.address.district} onChange={(e) => setProfile({ ...profile, address: { ...profile.address, district: e.target.value } })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Cidade" value={profile.address.city} onChange={(e) => setProfile({ ...profile, address: { ...profile.address, city: e.target.value } })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField label="UF" value={profile.address.state} onChange={(e) => setProfile({ ...profile, address: { ...profile.address, state: e.target.value } })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={9}>
                  <TextField label="País" value={profile.address.country} onChange={(e) => setProfile({ ...profile, address: { ...profile.address, country: e.target.value } })} fullWidth variant="outlined" />
                </Grid>

                <Grid item xs={12}>
                  <div className={classes.sectionTitle}>Cobrança</div>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="E-mail de cobrança" value={profile.billingEmail} onChange={(e) => setProfile({ ...profile, billingEmail: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Chave Pix" value={profile.pixKey} onChange={(e) => setProfile({ ...profile, pixKey: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Observações" value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} fullWidth multiline rows={3} variant="outlined" />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <TrButton onClick={saveProfile} disabled={!isEditing || loading}>Salvar perfil</TrButton>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Empresas cadastradas" />
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Plano</TableCell>
                    <TableCell>Documento</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>Telefone</TableCell>
                    <TableCell align="center">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {companies.filter(Boolean).map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.planId || "-"}</TableCell>
                      <TableCell>{c.document || "-"}</TableCell>
                      <TableCell>{c.email || "-"}</TableCell>
                      <TableCell>{c.phone || "-"}</TableCell>
                      <TableCell align="center">
                        <TrButton size="small" onClick={() => setSelectedId(c.id)}>Editar</TrButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </MainContainer>
  );
}


