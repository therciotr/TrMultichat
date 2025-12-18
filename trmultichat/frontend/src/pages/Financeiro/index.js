import React, { useState, useEffect, useMemo } from "react";
import { makeStyles } from "@material-ui/core/styles";
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
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import PieChartIcon from "@material-ui/icons/PieChart";
import PaymentIcon from "@material-ui/icons/Payment";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import WarningIcon from "@material-ui/icons/Warning";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import moment from "moment";

import MainContainer from "../../components/MainContainer";
import SubscriptionModal from "../../components/SubscriptionModal";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { TrButton } from "../../components/ui";

const useStyles = makeStyles((theme) => ({
  headerWrap: {
    borderRadius: 12,
    padding: theme.spacing(4),
    color: "#fff",
    background: "linear-gradient(135deg, #3f51b5 0%, #7c4dff 100%)",
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

const COLORS = ["#2e7d32", "#0288d1", "#d32f2f"];

const Financeiro = () => {
  const classes = useStyles();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    month: "all",
  });
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/invoices/all", { params: { pageNumber: 1 } });
        if (mounted) setInvoices(Array.isArray(data) ? data : []);
      } catch (e) {
        toastError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchInvoices();
    return () => {
      mounted = false;
    };
  }, []);

  const monthsOptions = useMemo(() => {
    const months = new Set();
    invoices.forEach((i) => months.add(moment(i.dueDate).format("YYYY-MM")));
    return ["all", ...Array.from(months).sort()];
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = (filters.q || "").toLowerCase().trim();
    const statusFilter = filters.status;
    const monthFilter = filters.month;
    return invoices.filter((inv) => {
      const s = classifyStatus(inv);
      const inStatus = statusFilter === "all" || statusFilter === s;
      const inMonth = monthFilter === "all" || moment(inv.dueDate).format("YYYY-MM") === monthFilter;
      const inText =
        !q ||
        String(inv.detail || "").toLowerCase().includes(q) ||
        String(inv.id || "").toLowerCase().includes(q);
      return inStatus && inMonth && inText;
    });
  }, [invoices, filters]);

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
        aria-labelledby="pay-dialog"
        Invoice={selectedInvoice}
        contactId={null}
      />

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className={classes.headerWrap}>
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <MonetizationOnIcon style={{ fontSize: 40, opacity: 0.95 }} />
            </Grid>
            <Grid item xs>
              <h1 className={classes.headerTitle}>📊 Painel Financeiro</h1>
              <div className={classes.headerSub}>
                Acompanhe suas receitas, despesas e faturas em tempo real.
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
                    <Line type="monotone" dataKey="valor" stroke="#3f51b5" strokeWidth={3} dot={false} />
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
      </Grid>

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
    </MainContainer>
  );
};

export default Financeiro;
