import React, { useState, useEffect, useMemo, useContext } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { motion } from "framer-motion";
import {
  Paper,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Chip,
  TextField,
  MenuItem,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import PieChartIcon from "@material-ui/icons/PieChart";
import PaymentIcon from "@material-ui/icons/Payment";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import WarningIcon from "@material-ui/icons/Warning";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import EditIcon from "@material-ui/icons/Edit";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import moment from "moment";

import MainContainer from "../../components/MainContainer";
import SubscriptionModal from "../../components/SubscriptionModal";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { TrButton } from "../../components/ui";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  scrollArea: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingBottom: theme.spacing(2),
    ...theme.scrollbarStyles,
  },
  headerWrap: {
    borderRadius: 12,
    padding: theme.spacing(4),
    color: "#fff",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.92) 100%)"
        : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    marginBottom: theme.spacing(3),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
  },
  headerSub: {
    opacity: 0.95,
    marginTop: theme.spacing(1),
  },
  summaryCard: {
    borderRadius: 12,
  },
  statusChip: {
    fontWeight: 600,
    color: "#fff",
  },
  paid: { backgroundColor: "#2e7d32" },
  open: { backgroundColor: "#0288d1" },
  overdue: { backgroundColor: "#d32f2f" },
  filtersBar: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  tablePaper: {
    borderRadius: 12,
    padding: theme.spacing(2),
  },
  zebraRow: {
    "&:nth-of-type(odd)": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  roundedTable: {
    borderRadius: 8,
    overflow: "hidden",
  },
  companyCard: {
    borderRadius: 14,
    overflow: "hidden",
  },
  companyHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    flexWrap: "wrap",
  },
  companyTitle: {
    fontWeight: 800,
    marginRight: theme.spacing(1),
  },
  chip: {
    fontWeight: 700,
  },
  chipOverdue: { backgroundColor: "#d32f2f", color: "#fff" },
  chipOpen: { backgroundColor: "#0288d1", color: "#fff" },
  chipPaid: { backgroundColor: "#2e7d32", color: "#fff" },
}));

function classifyStatus(inv) {
  const isPaid = String(inv.status || "").toLowerCase() === "paid";
  if (isPaid) return "paid";
  const today = moment().startOf("day");
  const due = moment(inv.dueDate);
  return due.isBefore(today) ? "overdue" : "open";
}

function currencyBRL(v) {
  const n = Number(v || 0);
  try {
    return n.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function sumBy(list, predicate) {
  return list.reduce((acc, inv) => {
    if (!predicate(inv)) return acc;
    return acc + Number(inv.value || 0);
  }, 0);
}

const COLORS = ["#2e7d32", "#0288d1", "#d32f2f"];

const Financeiro = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const email = String(user?.email || "").toLowerCase();
  const isMasterEmail = email === "thercio@trtecnologias.com.br";
  const isSuper = Boolean(user?.super || isMasterEmail);
  const myCompanyId = Number(localStorage.getItem("companyId") || 0);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    month: "all",
    companyId: "all",
  });
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualInv, setManualInv] = useState(null);
  const [manualForm, setManualForm] = useState({ discountValue: "", markPaid: false, paidMethod: "dinheiro", paidNote: "" });

  const reloadInvoices = async () => {
    setLoading(true);
    try {
      if (isSuper) {
        const { data } = await api.get("/invoices/admin/all", { params: { pageNumber: 1, ensureUpcoming: 1 } });
        setInvoices(Array.isArray(data) ? data : []);
      } else {
        const { data } = await api.get("/invoices/all", { params: { pageNumber: 1 } });
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);

  const monthsOptions = useMemo(() => {
    const months = new Set();
    invoices.forEach((i) => months.add(moment(i.dueDate).format("YYYY-MM")));
    return ["all", ...Array.from(months).sort()];
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = (filters.q || "").toLowerCase().trim();
    const statusFilter = filters.status;
    const monthFilter = filters.month;
    const companyFilter = filters.companyId;
    return invoices.filter((inv) => {
      const s = classifyStatus(inv);
      const inStatus = statusFilter === "all" || statusFilter === s;
      const inMonth = monthFilter === "all" || moment(inv.dueDate).format("YYYY-MM") === monthFilter;
      const inCompany =
        !isSuper ||
        companyFilter === "all" ||
        String(inv.companyId || "") === String(companyFilter);
      const inText =
        !q ||
        String(inv.detail || "").toLowerCase().includes(q) ||
        String(inv.id || "").toLowerCase().includes(q) ||
        String(inv.companyName || "").toLowerCase().includes(q) ||
        String(inv.companyEmail || "").toLowerCase().includes(q);
      return inStatus && inMonth && inCompany && inText;
    });
  }, [invoices, filters, isSuper]);

  const chartPrimary = theme?.palette?.primary?.main || "#3f51b5";

  const companyOptions = useMemo(() => {
    if (!isSuper) return [];
    const map = new Map();
    invoices.forEach((inv) => {
      const cid = String(inv.companyId || "");
      if (!cid) return;
      if (!map.has(cid)) map.set(cid, inv.companyName || `Empresa ${cid}`);
    });
    const list = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list;
  }, [invoices, isSuper]);

  const groupedByCompany = useMemo(() => {
    if (!isSuper) return [];
    const map = new Map();
    filtered.forEach((inv) => {
      const cid = String(inv.companyId || "");
      if (!cid) return;
      if (!map.has(cid)) {
        map.set(cid, { companyId: cid, companyName: inv.companyName || `Empresa ${cid}`, invoices: [] });
      }
      map.get(cid).invoices.push(inv);
    });
    const list = Array.from(map.values());
    // Ordena por maior valor vencido (quem está devendo mais) e depois por nome
    list.sort((a, b) => {
      const aOver = sumBy(a.invoices, (x) => classifyStatus(x) === "overdue");
      const bOver = sumBy(b.invoices, (x) => classifyStatus(x) === "overdue");
      if (bOver !== aOver) return bOver - aOver;
      return String(a.companyName).localeCompare(String(b.companyName));
    });
    return list;
  }, [filtered, isSuper]);

  const summary = useMemo(() => {
    const totalInvoices = filtered.length;
    let totalPaid = 0;
    let totalOpen = 0;
    let totalOverdue = 0;
    filtered.forEach((inv) => {
      const s = classifyStatus(inv);
      const val = Number(inv.value || 0);
      if (s === "paid") totalPaid += val;
      if (s === "open") totalOpen += val;
      if (s === "overdue") totalOverdue += val;
    });
    return { totalInvoices, totalPaid, totalOpen, totalOverdue };
  }, [filtered]);

  const lineData = useMemo(() => {
    // evolução mensal de valores pagos
    const map = {};
    filtered
      .filter((inv) => classifyStatus(inv) === "paid")
      .forEach((inv) => {
        const key = moment(inv.dueDate).format("YYYY-MM");
        map[key] = (map[key] || 0) + Number(inv.value || 0);
      });
    return Object.keys(map)
      .sort()
      .map((k) => ({ month: k, valor: map[k] }));
  }, [filtered]);

  const pieData = useMemo(() => {
    const counts = { paid: 0, open: 0, overdue: 0 };
    filtered.forEach((inv) => {
      counts[classifyStatus(inv)] += 1;
    });
    return [
      { name: "Pago", value: counts.paid },
      { name: "Em Aberto", value: counts.open },
      { name: "Vencido", value: counts.overdue },
    ];
  }, [filtered]);

  const onPay = async (inv) => {
    try {
      // No painel master, não permitir gerar pagamento para outras empresas
      if (isSuper && Number(inv.companyId || 0) !== myCompanyId) {
        toastError("Este pagamento deve ser realizado pelo cliente (empresa proprietária da fatura).");
        return;
      }
      // Garante que o valor da fatura esteja sincronizado com o plano atual da empresa
      // antes de gerar o PIX (evita mostrar 10 no plano e cobrar 30 no QR).
      const { data } = await api.patch(`/invoices/${inv.id}/sync-plan-value`);
      const updated = data && data.id ? data : inv;
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, ...updated } : i)));
      setSelectedInvoice(updated);
      setPayModalOpen(true);
    } catch (e) {
      toastError(e);
    }
  };

  const closePay = () => {
    setSelectedInvoice(null);
    setPayModalOpen(false);
  };

  const handlePaid = async () => {
    closePay();
    await reloadInvoices();
  };

  const openManual = (inv) => {
    setManualInv(inv);
    setManualForm({
      discountValue: "",
      markPaid: true,
      paidMethod: "dinheiro",
      paidNote: ""
    });
    setManualOpen(true);
  };

  const closeManual = () => {
    setManualOpen(false);
    setManualInv(null);
  };

  const submitManual = async () => {
    if (!manualInv) return;
    try {
      const payload = {
        markPaid: Boolean(manualForm.markPaid),
        paidMethod: manualForm.paidMethod,
        paidNote: manualForm.paidNote,
        discountValue: manualForm.discountValue === "" ? null : Number(manualForm.discountValue)
      };
      await api.patch(`/invoices/admin/${manualInv.id}/manual-settlement`, payload);
      closeManual();
      await reloadInvoices();
    } catch (e) {
      toastError(e);
    }
  };

  const statusChip = (inv) => {
    const s = classifyStatus(inv);
    if (s === "paid")
      return (
        <Chip
          className={`${classes.statusChip} ${classes.paid}`}
          icon={<CheckCircleIcon style={{ color: "#fff" }} />}
          label="Pago"
          size="small"
        />
      );
    if (s === "overdue")
      return (
        <Chip
          className={`${classes.statusChip} ${classes.overdue}`}
          icon={<WarningIcon style={{ color: "#fff" }} />}
          label="Vencido"
          size="small"
        />
      );
    return (
      <Chip
        className={`${classes.statusChip} ${classes.open}`}
        icon={<AccessTimeIcon style={{ color: "#fff" }} />}
        label="Em Aberto"
        size="small"
      />
    );
  };

  return (
    <MainContainer>
      <SubscriptionModal
        open={payModalOpen}
        onClose={closePay}
        onPaid={handlePaid}
        aria-labelledby="pay-dialog"
        Invoice={selectedInvoice}
        contactId={null}
      />

      <div className={classes.scrollArea}>
      <Dialog open={manualOpen} onClose={closeManual} maxWidth="xs" fullWidth>
        <DialogTitle>Baixa manual / desconto</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" style={{ display: "block", opacity: 0.85, marginBottom: 8 }}>
            {manualInv ? `${manualInv.companyName || ""} • Fatura #${manualInv.id}` : ""}
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Desconto (R$)"
            placeholder="Ex.: 10"
            value={manualForm.discountValue}
            onChange={(e) => setManualForm({ ...manualForm, discountValue: e.target.value })}
            style={{ marginBottom: 12 }}
          />
          <FormControl fullWidth variant="outlined" size="small" style={{ marginBottom: 12 }}>
            <InputLabel id="paid-method-label">Método</InputLabel>
            <Select
              labelId="paid-method-label"
              value={manualForm.paidMethod}
              onChange={(e) => setManualForm({ ...manualForm, paidMethod: e.target.value })}
              label="Método"
            >
              <MenuItem value="dinheiro">Dinheiro</MenuItem>
              <MenuItem value="pix">PIX</MenuItem>
              <MenuItem value="transferencia">Transferência</MenuItem>
              <MenuItem value="cartao">Cartão</MenuItem>
              <MenuItem value="boleto">Boleto</MenuItem>
              <MenuItem value="outro">Outro</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Observação"
            placeholder="Ex.: Pagou em dinheiro no balcão"
            value={manualForm.paidNote}
            onChange={(e) => setManualForm({ ...manualForm, paidNote: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeManual}>Cancelar</Button>
          <Button color="primary" variant="contained" onClick={submitManual}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className={classes.headerWrap}>
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <MonetizationOnIcon style={{ fontSize: 40, opacity: 0.95 }} />
            </Grid>
            <Grid item xs>
              <h1 className={classes.headerTitle}>
                {isSuper ? "📊 Painel Financeiro (Admin)" : "📊 Painel Financeiro"}
              </h1>
              <div className={classes.headerSub}>
                {isSuper
                  ? "Gerencie e acompanhe faturas de todas as empresas (multi-tenant)."
                  : "Acompanhe suas receitas, despesas e faturas em tempo real."}
              </div>
            </Grid>
          </Grid>
        </div>
      </motion.div>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={classes.summaryCard} elevation={3}>
              <CardHeader title="💼 Total de Faturas" />
              <CardContent style={{ fontSize: 26, fontWeight: 700 }}>{summary.totalInvoices}</CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={classes.summaryCard} elevation={3}>
              <CardHeader title="✅ Total Pago" />
              <CardContent style={{ fontSize: 22, fontWeight: 700 }}>{currencyBRL(summary.totalPaid)}</CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={classes.summaryCard} elevation={3}>
              <CardHeader title="🕐 Em Aberto" />
              <CardContent style={{ fontSize: 22, fontWeight: 700 }}>{currencyBRL(summary.totalOpen)}</CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={classes.summaryCard} elevation={3}>
              <CardHeader title="⚠️ Vencido" />
              <CardContent style={{ fontSize: 22, fontWeight: 700 }}>{currencyBRL(summary.totalOverdue)}</CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      <Grid container spacing={2} style={{ marginTop: 8 }}>
        <Grid item xs={12} md={8}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={classes.summaryCard} elevation={3}>
              <CardHeader title="📈 Evolução Mensal (Pagos)" avatar={<TrendingUpIcon />} />
              <CardContent style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid stroke="#f5f5f5" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RTooltip formatter={(v) => currencyBRL(v)} />
                    <Line type="monotone" dataKey="valor" stroke={chartPrimary} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} md={4}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={classes.summaryCard} elevation={3}>
              <CardHeader title="🥧 Distribuição por Status" avatar={<PieChartIcon />} />
              <CardContent style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" label>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      <Grid container spacing={2} className={classes.filtersBar}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Buscar por ID ou detalhes"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField
            select
            fullWidth
            variant="outlined"
            size="small"
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="paid">Pago</MenuItem>
            <MenuItem value="open">Em Aberto</MenuItem>
            <MenuItem value="overdue">Vencido</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField
            select
            fullWidth
            variant="outlined"
            size="small"
            label="Mês"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
          >
            {monthsOptions.map((m) => (
              <MenuItem key={m} value={m}>
                {m === "all" ? "Todos" : moment(m, "YYYY-MM").format("MM/YYYY")}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        {isSuper && (
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              variant="outlined"
              size="small"
              label="Cliente"
              value={filters.companyId}
              onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
            >
              <MenuItem value="all">Todos</MenuItem>
              {companyOptions.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
      </Grid>

      {isSuper ? (
        <div>
          {groupedByCompany.map((g) => {
            const counts = { paid: 0, open: 0, overdue: 0 };
            g.invoices.forEach((inv) => { counts[classifyStatus(inv)] += 1; });
            const overdueAmount = sumBy(g.invoices, (x) => classifyStatus(x) === "overdue");
            const openAmount = sumBy(g.invoices, (x) => classifyStatus(x) === "open");
            const paidAmount = sumBy(g.invoices, (x) => classifyStatus(x) === "paid");
            return (
              <Accordion key={g.companyId} defaultExpanded={counts.overdue > 0} className={classes.companyCard} elevation={3}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <div className={classes.companyHeader}>
                    <Typography variant="h6" className={classes.companyTitle}>
                      {g.companyName}
                    </Typography>
                    <Chip className={`${classes.chip} ${classes.chipOverdue}`} size="small" label={`Vencido: ${currencyBRL(overdueAmount)} (${counts.overdue})`} />
                    <Chip className={`${classes.chip} ${classes.chipOpen}`} size="small" label={`Em aberto: ${currencyBRL(openAmount)} (${counts.open})`} />
                    <Chip className={`${classes.chip} ${classes.chipPaid}`} size="small" label={`Pago: ${currencyBRL(paidAmount)} (${counts.paid})`} />
                  </div>
                </AccordionSummary>
                <AccordionDetails style={{ display: "block" }}>
                  <div className={classes.roundedTable}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell align="center">Id</TableCell>
                          <TableCell>Detalhes</TableCell>
                          <TableCell align="right">Valor</TableCell>
                          <TableCell align="center">Vencimento</TableCell>
                          <TableCell align="center">Status</TableCell>
                      <TableCell align="center">Ações</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {g.invoices.map((inv) => (
                          <TableRow key={inv.id} className={classes.zebraRow}>
                            <TableCell align="center">{inv.id}</TableCell>
                            <TableCell>
                              <Tooltip title={`Emitido em: ${moment(inv.createdAt || inv.dueDate).format("DD/MM/YYYY")}`}>
                                <span>{inv.detail || "-"}</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right" style={{ fontWeight: 800 }}>
                              {currencyBRL(inv.value)}
                            </TableCell>
                            <TableCell align="center">{moment(inv.dueDate).format("DD/MM/YYYY")}</TableCell>
                            <TableCell align="center">{statusChip(inv)}</TableCell>
                        <TableCell align="center">
                          <TrButton
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => openManual(inv)}
                          >
                            Baixar
                          </TrButton>
                        </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </div>
      ) : (
        <Paper className={classes.tablePaper} elevation={3}>
          <div className={classes.roundedTable}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">Id</TableCell>
                  <TableCell>Detalhes</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell align="center">Vencimento</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id} className={classes.zebraRow}>
                    <TableCell align="center">{inv.id}</TableCell>
                    <TableCell>
                      <Tooltip title={`Emitido em: ${moment(inv.createdAt || inv.dueDate).format("DD/MM/YYYY")}`}>
                        <span>{inv.detail || "-"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" style={{ fontWeight: 700 }}>
                      {currencyBRL(inv.value)}
                    </TableCell>
                    <TableCell align="center">{moment(inv.dueDate).format("DD/MM/YYYY")}</TableCell>
                    <TableCell align="center">{statusChip(inv)}</TableCell>
                    <TableCell align="center">
                      {classifyStatus(inv) !== "paid" ? (
                        <TrButton size="small" onClick={() => onPay(inv)} startIcon={<PaymentIcon />}>
                          Pagar
                        </TrButton>
                      ) : (
                        <TrButton size="small" disabled startIcon={<CheckCircleIcon />}>
                          Pago
                        </TrButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Paper>
      )}
      </div>
    </MainContainer>
  );
};

export default Financeiro;
