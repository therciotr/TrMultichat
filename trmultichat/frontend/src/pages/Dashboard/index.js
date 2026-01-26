import React, { useContext, useEffect, useMemo, useState } from "react";

import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import TableBody from "@material-ui/core/TableBody";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import Skeleton from "@material-ui/lab/Skeleton";

import AssessmentOutlinedIcon from "@material-ui/icons/AssessmentOutlined";
import BusinessOutlinedIcon from "@material-ui/icons/BusinessOutlined";
import PersonOutlineOutlinedIcon from "@material-ui/icons/PersonOutlineOutlined";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import AssignmentTurnedInOutlinedIcon from "@material-ui/icons/AssignmentTurnedInOutlined";
import ScheduleOutlinedIcon from "@material-ui/icons/ScheduleOutlined";
import HourglassEmptyOutlinedIcon from "@material-ui/icons/HourglassEmptyOutlined";
import AllInboxOutlinedIcon from "@material-ui/icons/AllInboxOutlined";

import { makeStyles } from "@material-ui/core/styles";
import moment from "moment";

import useDashboard from "../../hooks/useDashboard";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import { TrCard, TrSectionTitle, TrButton } from "../../components/ui";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(4),
  },
  hero: {
    padding: theme.spacing(2.25),
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
    background:
      "linear-gradient(135deg, rgba(14, 116, 144, 0.14), rgba(59, 130, 246, 0.08) 55%, rgba(255,255,255,0.95))",
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: 900,
    margin: 0,
    color: "rgba(15, 23, 42, 0.92)",
  },
  heroSub: {
    marginTop: 4,
    marginBottom: 0,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.66)",
  },
  filtersCard: {
    padding: theme.spacing(2),
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
    backgroundColor: "#fff",
  },
  metric: {
    padding: theme.spacing(2),
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
    backgroundColor: "#fff",
    height: "100%",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(15, 23, 42, 0.58)",
    letterSpacing: 0.2,
    marginTop: 10,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 900,
    color: "rgba(15, 23, 42, 0.92)",
    marginTop: 4,
    lineHeight: 1.1,
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(59, 130, 246, 0.12)",
    color: "rgba(14, 116, 144, 1)",
  },
  tableCard: {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
    overflow: "hidden",
  },
  tableHead: {
    background: "rgba(15, 23, 42, 0.03)",
  },
  chipOk: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    color: "#065F46",
    fontWeight: 800,
  },
  chipWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    color: "#92400E",
    fontWeight: 800,
  },
  chipDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    color: "#7F1D1D",
    fontWeight: 800,
  },
}));

function formatMinutes(minutes) {
  const m = Number(minutes || 0) || 0;
  return moment().startOf("day").add(m, "minutes").format("HH[h] mm[m]");
}

export default function Dashboard() {
  const classes = useStyles();
  const { find } = useDashboard();
  const { user } = useContext(AuthContext);

  const isAdmin = String(user?.profile || "").toLowerCase() === "admin" || Boolean(user?.admin);
  const isSuper = Boolean(user?.super);

  const defaultScope = useMemo(() => {
    if (isSuper) return "system";
    if (isAdmin) return "company";
    return "user";
  }, [isSuper, isAdmin]);

  const [scope, setScope] = useState(defaultScope);
  const [companyId, setCompanyId] = useState(0); // 0 = all (system scope only)
  const [dateFrom, setDateFrom] = useState(moment().startOf("month").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);

  const [apiScope, setApiScope] = useState(null);
  const [counters, setCounters] = useState({
    supportPending: 0,
    supportHappening: 0,
    supportFinished: 0,
    leads: 0,
    avgSupportTime: 0,
    avgWaitTime: 0,
  });
  const [rankAttendants, setRankAttendants] = useState([]);
  const [rankQueues, setRankQueues] = useState([]);
  const [rankClients, setRankClients] = useState([]);

  useEffect(() => {
    setScope(defaultScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultScope]);

  const scopeLabel =
    scope === "system"
      ? "Sistema (todas as empresas)"
      : scope === "company"
      ? "Empresa"
      : `${user?.name || "Usuário"} (meu desempenho)`;

  const companies = Array.isArray(apiScope?.companies) ? apiScope.companies : [];
  const canSelectCompany = Boolean(apiScope?.canSelectCompany);

  const apiCompanyId = Number(apiScope?.companyId || 0);
  const userCompanyName = user?.company?.name || "";

  const companyLabel = useMemo(() => {
    const cid = apiCompanyId;
    if (cid > 0) {
      const c = companies.find((x) => Number(x?.id) === cid);
      return c?.name || userCompanyName || `Empresa #${cid}`;
    }
    return scope === "system" ? "Todas as empresas" : (userCompanyName || "—");
  }, [apiCompanyId, companies, scope, userCompanyName]);

  async function fetchData() {
    setLoading(true);
    try {
      const effectiveScope = defaultScope === "user" ? "user" : scope;
      const params = {
        scope: effectiveScope,
        companyId: effectiveScope === "system" ? (companyId > 0 ? companyId : undefined) : undefined,
        date_from: dateFrom,
        date_to: dateTo,
      };
      const data = await find(params);
      setApiScope(data?.scope || null);
      setCounters(data?.counters || {});
      setRankAttendants(Array.isArray(data?.rankings?.attendants) ? data.rankings.attendants : []);
      setRankQueues(Array.isArray(data?.rankings?.queues) ? data.rankings.queues : []);
      setRankClients(Array.isArray(data?.rankings?.clients) ? data.rankings.clients : []);
    } catch (e) {
      toastError(e);
      setApiScope(null);
      setCounters({
        supportPending: 0,
        supportHappening: 0,
        supportFinished: 0,
        leads: 0,
        avgSupportTime: 0,
        avgWaitTime: 0,
      });
      setRankAttendants([]);
      setRankQueues([]);
      setRankClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MetricCard = ({ icon, label, value, hint }) => (
    <Paper className={classes.metric} elevation={0}>
      <div className={classes.metricIcon}>{icon}</div>
      <div className={classes.metricLabel}>{label}</div>
      <div className={classes.metricValue}>{loading ? "—" : value}</div>
      {hint ? (
        <Typography style={{ marginTop: 6, fontSize: 12, color: "rgba(15, 23, 42, 0.58)" }}>
          {hint}
        </Typography>
      ) : null}
    </Paper>
  );

  return (
    <Container maxWidth="lg" className={classes.container}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper className={classes.hero} elevation={0}>
            <p className={classes.heroTitle}>Gerência (Dashboard)</p>
            <p className={classes.heroSub}>
              Visão: <strong>{scopeLabel}</strong>
              {companyLabel ? <> · Empresa: <strong>{companyLabel}</strong></> : null}
            </p>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper className={classes.filtersCard} elevation={0}>
            <Grid container spacing={2} alignItems="center">
              {isSuper ? (
                <Grid item xs={12} md={3}>
                  <FormControl variant="outlined" fullWidth size="small">
                    <InputLabel id="scope-label">Escopo</InputLabel>
                    <Select
                      labelId="scope-label"
                      value={scope}
                      onChange={(e) => setScope(String(e.target.value))}
                      label="Escopo"
                    >
                      <MenuItem value="system">Sistema</MenuItem>
                      <MenuItem value="company">Empresa</MenuItem>
                      <MenuItem value="user">Usuário</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              ) : (
                <Grid item xs={12} md={3}>
                  <FormControl variant="outlined" fullWidth size="small" disabled>
                    <InputLabel id="scope-label-fixed">Escopo</InputLabel>
                    <Select labelId="scope-label-fixed" value={scope} label="Escopo">
                      <MenuItem value={scope}>{scopeLabel}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {canSelectCompany && scope !== "user" ? (
                <Grid item xs={12} md={3}>
                  <FormControl variant="outlined" fullWidth size="small">
                    <InputLabel id="company-label">Empresa</InputLabel>
                    <Select
                      labelId="company-label"
                      value={companyId}
                      onChange={(e) => setCompanyId(Number(e.target.value))}
                      label="Empresa"
                    >
                      {scope === "system" ? <MenuItem value={0}>Todas</MenuItem> : null}
                      {companies.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name ? `${c.name} (#${c.id})` : `Empresa #${c.id}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ) : (
                <Grid item xs={12} md={3}>
                  <FormControl variant="outlined" fullWidth size="small" disabled>
                    <InputLabel id="company-label-fixed">Empresa</InputLabel>
                    <Select labelId="company-label-fixed" value={apiScope?.companyId || ""} label="Empresa">
                      <MenuItem value={apiScope?.companyId || ""}>
                        {companyLabel || "—"}
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} md={2}>
                <TextField
                  label="Data inicial"
                  type="date"
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  label="Data final"
                  type="date"
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <TrButton
                  onClick={fetchData}
                  disabled={loading}
                  style={{ width: "100%", height: 40, borderRadius: 12, fontWeight: 900 }}
                >
                  {loading ? "Carregando..." : "Aplicar filtros"}
                </TrButton>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <TrSectionTitle
            title="Indicadores"
            subtitle="Resumo do período selecionado"
            icon={<AssessmentOutlinedIcon />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard icon={<HourglassEmptyOutlinedIcon />} label="Pendentes" value={counters.supportPending || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard icon={<ForumOutlinedIcon />} label="Em atendimento" value={counters.supportHappening || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={<AssignmentTurnedInOutlinedIcon />}
            label="Finalizados"
            value={counters.supportFinished || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard icon={<AllInboxOutlinedIcon />} label="Leads (contatos)" value={counters.leads || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={<ScheduleOutlinedIcon />}
            label="Tempo médio de espera"
            value={formatMinutes(counters.avgWaitTime || 0)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={<ScheduleOutlinedIcon />}
            label="Tempo médio de atendimento"
            value={formatMinutes(counters.avgSupportTime || 0)}
          />
        </Grid>

        <Grid item xs={12}>
          <TrSectionTitle
            title="Rankings"
            subtitle="Usuários, filas e clientes com maior volume no período"
            icon={<AssessmentOutlinedIcon />}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TrCard className={classes.tableCard} titleAlign="left" title="Ranking de atendimentos (usuários)">
            {loading ? (
              <Skeleton variant="rect" height={220} />
            ) : (
              <Table size="small">
                <TableHead className={classes.tableHead}>
                  <TableRow>
                    <TableCell>Usuário</TableCell>
                    <TableCell align="right">Finalizados</TableCell>
                    <TableCell align="right">Em aberto</TableCell>
                    <TableCell align="right">Pendentes</TableCell>
                    <TableCell align="right">T.M. atendimento</TableCell>
                    <TableCell align="right">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rankAttendants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>Nenhum dado no período.</TableCell>
                    </TableRow>
                  ) : (
                    rankAttendants.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.name}</TableCell>
                        <TableCell align="right">{a.closedCount}</TableCell>
                        <TableCell align="right">{a.openCount}</TableCell>
                        <TableCell align="right">{a.pendingCount}</TableCell>
                        <TableCell align="right">{formatMinutes(a.avgSupportTime)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={a.online ? "Online" : "Offline"}
                            className={a.online ? classes.chipOk : classes.chipDanger}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TrCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <TrCard className={classes.tableCard} titleAlign="left" title="Ranking por filas">
            {loading ? (
              <Skeleton variant="rect" height={220} />
            ) : (
              <Table size="small">
                <TableHead className={classes.tableHead}>
                  <TableRow>
                    <TableCell>Fila</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Pendentes</TableCell>
                    <TableCell align="right">Em aberto</TableCell>
                    <TableCell align="right">Finalizados</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rankQueues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>Nenhum dado no período.</TableCell>
                    </TableRow>
                  ) : (
                    rankQueues.map((q) => (
                      <TableRow key={`${q.id}-${q.name}`}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gridGap={8}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: q.color || "#7c7c7c",
                                display: "inline-block",
                              }}
                            />
                            <span>{q.name}</span>
                          </Box>
                        </TableCell>
                        <TableCell align="right">{q.totalTickets}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={q.pendingTickets}
                            className={
                              q.pendingTickets >= 10
                                ? classes.chipDanger
                                : q.pendingTickets >= 5
                                  ? classes.chipWarn
                                  : classes.chipOk
                            }
                          />
                        </TableCell>
                        <TableCell align="right">{q.openTickets}</TableCell>
                        <TableCell align="right">{q.closedTickets}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TrCard>
        </Grid>

        <Grid item xs={12}>
          <TrCard className={classes.tableCard} titleAlign="left" title="Ranking de clientes (quem mais entra em contato)">
            {loading ? (
              <Skeleton variant="rect" height={220} />
            ) : (
              <Table size="small">
                <TableHead className={classes.tableHead}>
                  <TableRow>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Número</TableCell>
                    <TableCell align="right">Tickets</TableCell>
                    <TableCell align="right">Último contato</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rankClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>Nenhum dado no período.</TableCell>
                    </TableRow>
                  ) : (
                    rankClients.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.number}</TableCell>
                        <TableCell align="right">{c.ticketsCount}</TableCell>
                        <TableCell align="right">
                          {c.lastTicketAt ? moment(c.lastTicketAt).format("DD/MM/YYYY HH:mm") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TrCard>
        </Grid>

        {isSuper ? (
          <Grid item xs={12}>
            <TrCard className={classes.tableCard} titleAlign="left" title="Resumo do escopo">
              <Box p={2} display="flex" flexWrap="wrap" gridGap={10} alignItems="center">
                <Chip
                  icon={<BusinessOutlinedIcon />}
                  label={`Empresa: ${apiScope?.companyId ? `#${apiScope.companyId}` : "Todas"}`}
                />
                <Chip icon={<PersonOutlineOutlinedIcon />} label={`Usuário: ${apiScope?.userId || "—"}`} />
                <Chip icon={<AccountTreeOutlinedIcon />} label={`Escopo: ${scopeLabel}`} />
              </Box>
            </TrCard>
          </Grid>
        ) : null}
      </Grid>
    </Container>
  );
}


