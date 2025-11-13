import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Card, CardHeader, CardContent, CardActions, Grid, TextField, Chip, MenuItem, Table, TableHead, TableRow, TableCell, TableBody } from "@material-ui/core";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";
import WarningIcon from "@material-ui/icons/Warning";
import VpnKeyIcon from "@material-ui/icons/VpnKey";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import { TrButton } from "../../../components/ui";
import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import moment from "moment";
import { AuthContext } from "../../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  header: {
    borderRadius: 12,
    padding: theme.spacing(3),
    color: "#fff",
    background: "linear-gradient(135deg, #0f9b0f 0%, #00b09b 100%)",
    marginBottom: theme.spacing(2),
  },
  chipOk: { backgroundColor: "#2e7d32", color: "#fff", fontWeight: 600 },
  chipWarn: { backgroundColor: "#d32f2f", color: "#fff", fontWeight: 600 },
  tokenField: { fontFamily: "monospace" },
  card: { borderRadius: 12 },
  btnIcon: { marginRight: theme.spacing(1) }
}));

export default function LicenseManager() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [companyId, setCompanyId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [list, setList] = useState([]);
  const [gen, setGen] = useState({ subject: "", plan: "", maxUsers: 0, days: 365 });
  const tokenRef = useRef(null);

  const buildRow = (c, info) => {
    const payload = info || {};
    return {
      companyId: c.id,
      companyName: c.name || `Empresa ${c.id}`,
      plan: payload.plan || "",
      maxUsers: payload.maxUsers || 0,
      exp: payload.exp || null,
      valid: Boolean(payload.valid)
    };
  };

  async function refreshLicense() {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/companies/${companyId}/license`);
      setInfo(data);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    try {
      const { data } = await api.get("/companies");
      const safe = Array.isArray(data)
        ? data.filter((c) => c && typeof c === "object" && (c.id !== undefined || c.name !== undefined))
        : [];
      setCompanies(safe);
      if (!companyId) {
        const mine = user?.companyId || (safe.length && safe[0]?.id);
        setCompanyId(mine || null);
      }
    } catch (e) {
      toastError(e);
    }
  }

  async function loadLicenses() {
    try {
      const { data } = await api.get("/companies/licenses");
      const rows = Array.isArray(data) ? data : [];
      if (rows.length > 0) {
        setList(rows);
        return;
      }
      // Fallback: montar ao menos a empresa selecionada para permitir editar/excluir
      const cos = companies && companies.length ? companies : [];
      if ((companyId && cos.length) || cos.length) {
        const target = cos.find((c) => c.id === companyId) || cos[0];
        try {
          const { data: li } = await api.get(`/companies/${target.id}/license`);
          setList([buildRow(target, li || {})]);
        } catch {
          setList([buildRow(target, { valid: false })]);
        }
      } else {
        setList([]);
      }
    } catch (e) {
      // Fallback para seleção atual
      try {
        const cos = companies && companies.length ? companies : [];
        const target = cos.find((c) => c.id === companyId);
        if (target) {
          const { data: li } = await api.get(`/companies/${target.id}/license`);
          setList([buildRow(target, li || {})]);
          return;
        }
      } catch {}
      setList([]);
    }
  }

  useEffect(() => {
    loadCompanies();
    loadLicenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshLicense();
    // sempre garantir ao menos uma linha da empresa selecionada
    (async () => {
      try {
        const c = companies.find((x) => x.id === companyId);
        if (!c) return;
        const { data: li } = await api.get(`/companies/${companyId}/license`);
        const row = buildRow(c, li || {});
        // se lista estiver vazia ou não contiver a empresa selecionada, atualiza
        const has = list.some((r) => r.companyId === companyId);
        if (!has) setList([row, ...list]);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function save() {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await api.put(`/companies/${companyId}/license`, { token: token.trim() });
      setToken("");
      await refreshLicense();
      await loadLicenses();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  async function removeLicense() {
    if (!companyId) return;
    if (!window.confirm("Remover a licença desta empresa?")) return;
    try {
      // tenta DELETE; se falhar, tenta fallbacks (PUT vazio, POST delete)
      try {
        await api.delete(`/companies/${companyId}/license`);
      } catch (_) {
        try {
          await api.put(`/companies/${companyId}/license`, { token: "" });
        } catch (__e) {
          try {
            await api.post(`/companies/${companyId}/license/delete`);
          } catch (___e) {
            // fallback final: GET com query delete=1
            try {
              await api.get(`/companies/${companyId}/license?delete=1`);
            } catch (____e) {
              // último fallback: endpoint global com companyId
              await api.get(`/companies/license/remove`, { params: { companyId } });
            }
          }
        }
      }
      setInfo(null);
      setToken("");
      await loadLicenses();
    } catch (e) {
      toastError(e);
    }
  }

  async function generate() {
    if (!companyId) return;
    try {
      const { data } = await api.post(`/companies/${companyId}/license/generate`, {
        subject: gen.subject || `company:${companyId}`,
        plan: gen.plan || "",
        maxUsers: Number(gen.maxUsers || 0),
        days: Number(gen.days || 365)
      });
      if (data && data.token) {
        setToken(data.token);
      }
    } catch (e) {
      toastError(e);
    }
  }

  const statusChip = useMemo(() => {
    if (!info) return null;
    if (info.valid) {
      return (
        <Chip
          className={classes.chipOk}
          icon={<VerifiedUserIcon style={{ color: "#fff" }} />}
          label="Licença válida"
        />
      );
    }
    return (
      <Chip
        className={classes.chipWarn}
        icon={<WarningIcon style={{ color: "#fff" }} />}
        label="Licença ausente ou inválida"
      />
    );
  }, [info, classes.chipOk, classes.chipWarn]);

  return (
    <MainContainer>
      <div className={classes.header}>
        <Title>Gerenciar Licença</Title>
        <div>Ative, gere, edite ou remova licenças vinculadas às empresas.</div>
      </div>

      <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Status da Licença" action={statusChip} />
            <CardContent>
              {loading ? (
                <div>Carregando...</div>
              ) : info ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <TextField
                      select
                      label="Empresa"
                      value={companyId || ""}
                      onChange={(e) => setCompanyId(Number(e.target.value))}
                      variant="outlined"
                      fullWidth
                    >
                      {companies.filter(Boolean).map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name || `Empresa ${c.id}`}</MenuItem>
                      ))}
                    </TextField>
                  </div>
                  <div><b>Empresa:</b> {companyId}</div>
                  <div><b>Assunto:</b> {info.subject || "-"}</div>
                  <div><b>Plano:</b> {info.plan || "-"}</div>
                  <div><b>Máx. Usuários:</b> {info.maxUsers || 0}</div>
                  <div><b>Expira em:</b> {info.exp ? moment.unix(info.exp).format("DD/MM/YYYY") : "-"}</div>
                </>
              ) : (
                <div>Sem dados.</div>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Ativar/Atualizar Token" avatar={<VpnKeyIcon />} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Token de Licença (JWT RS256)"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="cole aqui o token..."
                    variant="outlined"
                    fullWidth
                    multiline
                    minRows={4}
                    InputProps={{ className: classes.tokenField }}
                    inputRef={tokenRef}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TrButton onClick={save} disabled={saving || !companyId || !token.trim()}>
                    <EditOutlinedIcon className={classes.btnIcon} />
                    Salvar
                  </TrButton>
                  <TrButton variant="outlined" onClick={refreshLicense} disabled={loading} style={{ marginLeft: 8 }}>
                    <AutorenewIcon className={classes.btnIcon} />
                    Atualizar
                  </TrButton>
                </Grid>
                <Grid item xs={12} md={6} style={{ textAlign: "right" }}>
                  <TrButton variant="outlined" onClick={removeLicense} disabled={!companyId}>
                    <DeleteOutlineIcon className={classes.btnIcon} />
                    Remover licença
                  </TrButton>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Gerador de Token" />
            <CardContent>
              <TextField
                label="Assunto (sub)"
                value={gen.subject}
                onChange={(e) => setGen({ ...gen, subject: e.target.value })}
                fullWidth
                variant="outlined"
                style={{ marginBottom: 8 }}
              />
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField label="Plano" value={gen.plan} onChange={(e) => setGen({ ...gen, plan: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Máx. Usuários" type="number" value={gen.maxUsers} onChange={(e) => setGen({ ...gen, maxUsers: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Dias de validade" type="number" value={gen.days} onChange={(e) => setGen({ ...gen, days: e.target.value })} fullWidth variant="outlined" />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <TrButton onClick={generate} disabled={!companyId}>
                Gerar token
              </TrButton>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Licenças por empresa" />
            <CardContent style={{ maxHeight: 420, overflowY: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Plano</TableCell>
                    <TableCell>Máx. Usuários</TableCell>
                    <TableCell>Expira em</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((row) => (
                    <TableRow
                      key={row.companyId}
                      hover
                      onClick={() => setCompanyId(row.companyId)}
                      style={{ cursor: "pointer" }}
                      selected={companyId === row.companyId}
                    >
                      <TableCell>{row.companyName}</TableCell>
                      <TableCell>{row.plan || "-"}</TableCell>
                      <TableCell>{row.maxUsers || 0}</TableCell>
                      <TableCell>{row.exp ? moment.unix(row.exp).format("DD/MM/YYYY") : "-"}</TableCell>
                      <TableCell align="center">
                        {row.valid ? (
                          <Chip className={classes.chipOk} label="Válida" />
                        ) : (
                          <Chip className={classes.chipWarn} label="Inválida" />
                        )}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <TrButton
                          size="small"
                          onClick={() => {
                            setCompanyId(row.companyId);
                            setTimeout(() => {
                              if (tokenRef.current) {
                                tokenRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                                tokenRef.current.focus();
                              }
                            }, 50);
                          }}
                        >
                          Editar
                        </TrButton>
                        <TrButton size="small" variant="outlined" onClick={async () => { setCompanyId(row.companyId); await removeLicense(); }}>Excluir</TrButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </div>
    </MainContainer>
  );
}


