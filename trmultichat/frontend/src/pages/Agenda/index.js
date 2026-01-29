import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import EventOutlinedIcon from "@material-ui/icons/EventOutlined";
import AddOutlinedIcon from "@material-ui/icons/AddOutlined";
import DeleteOutlineOutlinedIcon from "@material-ui/icons/DeleteOutlineOutlined";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";
import PersonOutlineOutlinedIcon from "@material-ui/icons/PersonOutlineOutlined";
import ViewWeekOutlinedIcon from "@material-ui/icons/ViewWeekOutlined";
import ViewModuleOutlinedIcon from "@material-ui/icons/ViewModuleOutlined";
import ListAltOutlinedIcon from "@material-ui/icons/ListAltOutlined";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { TrButton } from "../../components/ui";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  hero: {
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.06)",
    background:
      "linear-gradient(135deg, rgba(59, 130, 246, 0.10), rgba(16, 185, 129, 0.08) 52%, rgba(255,255,255,0.96))",
    padding: theme.spacing(2),
    margin: theme.spacing(2, 2, 1.5, 2),
  },
  heroRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    flexWrap: "wrap",
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(59, 130, 246, 0.12)",
    border: "1px solid rgba(59, 130, 246, 0.16)",
    color: "rgba(14, 116, 144, 1)",
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: 1000,
    margin: 0,
    color: "rgba(15, 23, 42, 0.92)",
  },
  heroSub: {
    marginTop: 4,
    marginBottom: 0,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.66)",
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
    backgroundColor: "#fff",
    padding: theme.spacing(2),
    margin: theme.spacing(0, 2, 2, 2),
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1.25),
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  select: {
    minWidth: 240,
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      background: "#fff",
    },
  },
  viewChip: {
    fontWeight: 1000,
    borderRadius: 999,
  },
  calendarWrap: {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    overflow: "hidden",
  },
  modalTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(59, 130, 246, 0.12)",
    border: "1px solid rgba(59, 130, 246, 0.16)",
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      background: "#fff",
    },
  },
  actionsRow: {
    display: "flex",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    flexWrap: "wrap",
    marginTop: theme.spacing(1.5),
  },
}));

const DEFAULT_COLORS = [
  { label: "Azul", value: "#2563EB" },
  { label: "Verde", value: "#10B981" },
  { label: "Roxo", value: "#7C3AED" },
  { label: "Laranja", value: "#F97316" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Cinza", value: "#334155" },
];

function toInputDateTimeValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toInputDateValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export default function Agenda() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const currentUserId = Number(user?.id || 0);

  const email = String(user?.email || "").toLowerCase();
  const isMasterEmail = email === "thercio@trtecnologias.com.br";
  const isSuper = Boolean(user?.super || isMasterEmail);
  const isAdmin = Boolean(user?.admin);
  const profile = String(user?.profile || "").toLowerCase();
  const isAdminLike = isSuper || isAdmin || profile === "admin" || profile === "super";

  const calendarRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [view, setView] = useState("dayGridMonth"); // month/week/day/list

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    location: "",
    color: "#2563EB",
    allDay: false,
    startAt: new Date(),
    endAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const canPickUser = isAdminLike;

  const events = useMemo(() => {
    return (records || []).map((r) => ({
      id: r.id,
      title: r.title,
      start: r.startAt,
      end: r.endAt,
      allDay: Boolean(r.allDay),
      backgroundColor: r.color || "#2563EB",
      borderColor: r.color || "#2563EB",
      extendedProps: r,
    }));
  }, [records]);

  const loadUsers = async () => {
    if (!canPickUser) return;
    try {
      const { data } = await api.get("/users/list");
      const arr = Array.isArray(data) ? data : [];
      setUsers(arr);
    } catch (err) {
      // not critical
    }
  };

  const loadEventsForRange = async ({ dateFrom, dateTo } = {}) => {
    setLoading(true);
    try {
      const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
      const to = dateTo ? new Date(dateTo) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      const { data } = await api.get("/agenda/events", {
        params: {
          dateFrom: from.toISOString(),
          dateTo: to.toISOString(),
          ...(canPickUser ? { userId: selectedUserId } : {}),
        },
      });
      setRecords(Array.isArray(data?.records) ? data.records : []);
    } catch (err) {
      toastError(err);
      setRecords([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPickUser]);

  useEffect(() => {
    setSelectedUserId(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    loadEventsForRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const openCreate = (startAt, endAt, allDay = false) => {
    setForm({
      id: "",
      title: "",
      description: "",
      location: "",
      color: "#2563EB",
      allDay,
      startAt: startAt || new Date(),
      endAt: endAt || new Date(Date.now() + 60 * 60 * 1000),
    });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setForm({
      id: record.id,
      title: record.title || "",
      description: record.description || "",
      location: record.location || "",
      color: record.color || "#2563EB",
      allDay: Boolean(record.allDay),
      startAt: new Date(record.startAt),
      endAt: new Date(record.endAt),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        color: form.color,
        allDay: form.allDay,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        ...(canPickUser ? { userId: selectedUserId } : {}),
      };
      if (form.id) {
        await api.put(`/agenda/events/${form.id}`, payload);
      } else {
        await api.post("/agenda/events", payload);
      }
      setModalOpen(false);
      await loadEventsForRange();
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!form.id) return;
    setDeleting(true);
    try {
      await api.delete(`/agenda/events/${form.id}`);
      setModalOpen(false);
      await loadEventsForRange();
    } catch (err) {
      toastError(err);
    }
    setDeleting(false);
  };

  const viewLabel = (v) => {
    if (v === "dayGridMonth") return "Mês";
    if (v === "timeGridWeek") return "Semana";
    if (v === "timeGridDay") return "Dia";
    if (v === "listWeek") return "Agenda";
    return v;
  };

  return (
    <MainContainer className={classes.root}>
      <MainHeader>
        <Title>Agenda</Title>
        <MainHeaderButtonsWrapper />
      </MainHeader>

      <div className={classes.hero}>
        <div className={classes.heroRow}>
          <div className={classes.heroIcon}>
            <EventOutlinedIcon />
          </div>
          <div style={{ minWidth: 220 }}>
            <p className={classes.heroTitle}>Agenda do dia a dia</p>
            <p className={classes.heroSub}>Crie compromissos, lembretes e organize sua rotina com visão estilo Google/iPhone.</p>
          </div>
          <Box flex={1} />
          <Chip size="small" label={loading ? "Carregando..." : `${events.length} evento(s)`} style={{ fontWeight: 1000 }} />
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.toolbar}>
          <div className={classes.toolbarLeft}>
            {canPickUser ? (
              <FormControl variant="outlined" size="small" className={classes.select}>
                <InputLabel id="agenda-user">Usuário</InputLabel>
                <Select
                  labelId="agenda-user"
                  label="Usuário"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  startAdornment={
                    <Box mr={1} ml={1} display="flex" alignItems="center" style={{ opacity: 0.7 }}>
                      <PersonOutlineOutlinedIcon style={{ fontSize: 18 }} />
                    </Box>
                  }
                >
                  {(users || []).map((u) => (
                    <MenuItem key={u.id} value={Number(u.id)}>
                      {u.name || u.email || `Usuário #${u.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Chip size="small" icon={<PersonOutlineOutlinedIcon />} label={user?.name || "Meu calendário"} style={{ fontWeight: 1000 }} />
            )}
          </div>

          <div className={classes.toolbarRight}>
            <Chip
              className={classes.viewChip}
              size="small"
              clickable
              icon={<ViewModuleOutlinedIcon />}
              label={`Mês`}
              onClick={() => setView("dayGridMonth")}
              style={{ background: view === "dayGridMonth" ? "rgba(59,130,246,0.14)" : undefined }}
            />
            <Chip
              className={classes.viewChip}
              size="small"
              clickable
              icon={<ViewWeekOutlinedIcon />}
              label={`Semana`}
              onClick={() => setView("timeGridWeek")}
              style={{ background: view === "timeGridWeek" ? "rgba(59,130,246,0.14)" : undefined }}
            />
            <Chip
              className={classes.viewChip}
              size="small"
              clickable
              icon={<EventOutlinedIcon />}
              label={`Dia`}
              onClick={() => setView("timeGridDay")}
              style={{ background: view === "timeGridDay" ? "rgba(59,130,246,0.14)" : undefined }}
            />
            <Chip
              className={classes.viewChip}
              size="small"
              clickable
              icon={<ListAltOutlinedIcon />}
              label={`Agenda`}
              onClick={() => setView("listWeek")}
              style={{ background: view === "listWeek" ? "rgba(59,130,246,0.14)" : undefined }}
            />

            <TrButton variant="outlined" startIcon={<AddOutlinedIcon />} onClick={() => openCreate()}>
              Novo evento
            </TrButton>
          </div>
        </div>

        <div className={classes.calendarWrap}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={false}
            height="auto"
            locale="pt-br"
            editable
            selectable
            selectMirror
            dayMaxEvents
            nowIndicator
            events={events}
            datesSet={(arg) => {
              setView(arg.view.type);
              loadEventsForRange({ dateFrom: arg.start, dateTo: arg.end });
            }}
            select={(arg) => {
              const end = arg.end || new Date(arg.start.getTime() + 60 * 60 * 1000);
              openCreate(arg.start, end, arg.allDay);
            }}
            dateClick={(arg) => {
              const start = arg.date;
              const end = new Date(start.getTime() + 60 * 60 * 1000);
              openCreate(start, end, arg.allDay);
            }}
            eventClick={(arg) => {
              const rec = arg.event.extendedProps || {};
              openEdit({
                ...rec,
                startAt: arg.event.start,
                endAt: arg.event.end || arg.event.start,
                allDay: arg.event.allDay,
                title: arg.event.title,
              });
            }}
            eventDrop={async (arg) => {
              try {
                await api.put(`/agenda/events/${arg.event.id}`, {
                  title: arg.event.title,
                  description: arg.event.extendedProps?.description || "",
                  location: arg.event.extendedProps?.location || "",
                  color: arg.event.backgroundColor || "#2563EB",
                  allDay: arg.event.allDay,
                  startAt: arg.event.start?.toISOString(),
                  endAt: (arg.event.end || arg.event.start)?.toISOString(),
                  ...(canPickUser ? { userId: selectedUserId } : {}),
                });
              } catch (err) {
                toastError(err);
                arg.revert();
              }
            }}
            eventResize={async (arg) => {
              try {
                await api.put(`/agenda/events/${arg.event.id}`, {
                  title: arg.event.title,
                  description: arg.event.extendedProps?.description || "",
                  location: arg.event.extendedProps?.location || "",
                  color: arg.event.backgroundColor || "#2563EB",
                  allDay: arg.event.allDay,
                  startAt: arg.event.start?.toISOString(),
                  endAt: (arg.event.end || arg.event.start)?.toISOString(),
                  ...(canPickUser ? { userId: selectedUserId } : {}),
                });
              } catch (err) {
                toastError(err);
                arg.revert();
              }
            }}
          />
        </div>
      </div>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle disableTypography>
          <div className={classes.modalTitle}>
            <div className={classes.modalIcon}>
              <EventOutlinedIcon />
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography style={{ fontWeight: 1000, fontSize: 15 }}>
                {form.id ? "Editar evento" : "Novo evento"}
              </Typography>
              <Typography style={{ fontSize: 12, opacity: 0.7 }}>
                {canPickUser ? `Usuário: ${viewLabel(view)}` : `Visão: ${viewLabel(view)}`}
              </Typography>
            </div>
          </div>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                className={classes.field}
                label="Título"
                variant="outlined"
                size="small"
                fullWidth
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                className={classes.field}
                label="Descrição"
                variant="outlined"
                size="small"
                fullWidth
                multiline
                minRows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={7}>
              <TextField
                className={classes.field}
                label="Local"
                variant="outlined"
                size="small"
                fullWidth
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                className={classes.field}
                select
                label="Cor"
                variant="outlined"
                size="small"
                fullWidth
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              >
                {DEFAULT_COLORS.map((c) => (
                  <MenuItem key={c.value} value={c.value}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 99, background: c.value }} />
                      <span>{c.label}</span>
                    </span>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.allDay}
                    onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                    color="primary"
                  />
                }
                label="Dia inteiro"
              />
            </Grid>

            {form.allDay ? (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    label="Início"
                    type="date"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={toInputDateValue(form.startAt)}
                    onChange={(e) => {
                      const d = new Date(`${e.target.value}T00:00`);
                      const end = new Date(d.getTime() + 24 * 60 * 60 * 1000);
                      setForm((f) => ({ ...f, startAt: d, endAt: end }));
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    label="Fim"
                    type="date"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={toInputDateValue(form.endAt)}
                    onChange={(e) => {
                      const d = new Date(`${e.target.value}T23:59`);
                      if (d.getTime() > new Date(form.startAt).getTime()) {
                        setForm((f) => ({ ...f, endAt: d }));
                      }
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    label="Início"
                    type="datetime-local"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={toInputDateTimeValue(form.startAt)}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: new Date(e.target.value) }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    className={classes.field}
                    label="Fim"
                    type="datetime-local"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={toInputDateTimeValue(form.endAt)}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: new Date(e.target.value) }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}
          </Grid>

          <div className={classes.actionsRow}>
            {form.id ? (
              <TrButton
                variant="outlined"
                startIcon={<DeleteOutlineOutlinedIcon />}
                disabled={deleting || saving}
                onClick={handleDelete}
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </TrButton>
            ) : null}
            <TrButton variant="outlined" onClick={() => setModalOpen(false)} disabled={saving || deleting}>
              Cancelar
            </TrButton>
            <TrButton startIcon={<SaveOutlinedIcon />} disabled={saving || deleting} onClick={handleSave}>
              {saving ? "Salvando..." : "Salvar"}
            </TrButton>
          </div>
        </DialogContent>
      </Dialog>
    </MainContainer>
  );
}

