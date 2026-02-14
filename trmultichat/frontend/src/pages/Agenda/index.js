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
import AttachFileOutlinedIcon from "@material-ui/icons/AttachFileOutlined";
import CloudUploadOutlinedIcon from "@material-ui/icons/CloudUploadOutlined";
import ChatBubbleOutlineOutlinedIcon from "@material-ui/icons/ChatBubbleOutlineOutlined";

import MainContainer from "../../components/MainContainer";
import { TrButton } from "../../components/ui";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = `1px solid ${theme.palette.divider}`;
  const softShadow = isDark ? "0 18px 44px rgba(0,0,0,0.35)" : "0 14px 36px rgba(15, 23, 42, 0.06)";

  return ({
  root: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  hero: {
    borderRadius: 18,
    border,
    boxShadow: softShadow,
    background: isDark
      ? "linear-gradient(135deg, rgba(var(--tr-heading-rgb, 11, 76, 70), 0.18), rgba(var(--tr-secondary-rgb, 43, 169, 165), 0.12) 52%, rgba(15,23,42,0.88))"
      : "linear-gradient(135deg, rgba(var(--tr-heading-rgb, 11, 76, 70), 0.14), rgba(var(--tr-secondary-rgb, 43, 169, 165), 0.10) 52%, rgba(255,255,255,0.96))",
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
    background: "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.12)",
    border: "1px solid rgba(var(--tr-heading-rgb, 11, 76, 70), 0.16)",
    color: "var(--tr-heading, var(--tr-primary))",
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: 1000,
    margin: 0,
    color: "var(--tr-heading, var(--tr-primary))",
  },
  heroSub: {
    marginTop: 4,
    marginBottom: 0,
    fontSize: 13,
    color: "var(--tr-muted, rgba(15,23,42,0.65))",
  },
  card: {
    borderRadius: 18,
    border,
    boxShadow: isDark ? "0 16px 40px rgba(0,0,0,0.35)" : "0 14px 34px rgba(15, 23, 42, 0.05)",
    backgroundColor: theme.palette.background.paper,
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
      background: isDark ? "rgba(15,23,42,0.92)" : "#fff",
    },
  },
  viewChip: {
    fontWeight: 1000,
    borderRadius: 999,
  },
  calendarWrap: {
    borderRadius: 16,
    border,
    overflow: "hidden",
    backgroundColor: theme.palette.background.paper,
    "& .fc": {
      // FullCalendar v5+ supports CSS variables
      "--fc-border-color": theme.palette.divider,
      "--fc-page-bg-color": theme.palette.background.paper,
      "--fc-neutral-bg-color": isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.03)",
      "--fc-today-bg-color": isDark ? "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.14)" : "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.08)",
      "--fc-list-event-hover-bg-color": isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.03)",
      color: theme.palette.text.primary,
    },
    "& .fc a": { color: "inherit" },
    "& .fc .fc-col-header-cell-cushion": { color: theme.palette.text.secondary },
    "& .fc .fc-daygrid-day-number": { color: theme.palette.text.secondary },
    "& .fc .fc-list-day-cushion": {
      backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "rgba(15,23,42,0.03)",
      color: theme.palette.text.primary,
    },
    "& .fc .fc-list-event:hover td": {
      backgroundColor: isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.03)",
    },
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
    background: "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.12)",
    border: "1px solid rgba(var(--tr-heading-rgb, 11, 76, 70), 0.16)",
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      background: isDark ? "rgba(15,23,42,0.92)" : "#fff",
    },
  },
  actionsRow: {
    display: "flex",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    flexWrap: "wrap",
    marginTop: theme.spacing(1.5),
  },
  sectionLabel: {
    fontWeight: 1000,
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.75),
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  hint: {
    fontSize: 12,
    opacity: 0.72,
    marginTop: 6,
  },
  attachmentItem: {
    borderRadius: 14,
    border,
    padding: theme.spacing(1, 1.25),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    background: isDark ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.92)",
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 360,
  },
})});

const DEFAULT_COLORS = [
  { label: "Azul", value: "#2563EB" },
  { label: "Verde", value: "#10B981" },
  { label: "Roxo", value: "#7C3AED" },
  { label: "Laranja", value: "#F97316" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Cinza", value: "#334155" },
];

const REMINDER_PRESETS = [
  { label: "Sem lembrete", minutes: 0 },
  { label: "5 minutos antes", minutes: 5 },
  { label: "10 minutos antes", minutes: 10 },
  { label: "30 minutos antes", minutes: 30 },
  { label: "1 hora antes", minutes: 60 },
  { label: "1 dia antes", minutes: 24 * 60 },
];

const RECURRENCE_TYPES = [
  { label: "Não repetir", value: "none" },
  { label: "Diário", value: "daily" },
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
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
  const uploadInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [view, setView] = useState("dayGridMonth"); // month/week/day/list

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const [form, setForm] = useState({
    id: "", // occurrence id (UI)
    seriesId: "", // base event id (API)
    title: "",
    description: "",
    location: "",
    color: "#2563EB",
    allDay: false,
    startAt: new Date(),
    endAt: new Date(Date.now() + 60 * 60 * 1000),
    recurrenceType: "none",
    recurrenceInterval: 1,
    recurrenceUntil: null,
    reminderMinutes: 0,
    notifyInChat: true,
    notifyOnCreate: true,
    responsibleUserId: currentUserId,
  });

  // Safe setter for pooled events / nullable events (prevents "Cannot read properties of null (reading 'value')")
  const setFormKey = (key, parser) => (eOrValue) => {
    const t = eOrValue && eOrValue.target ? eOrValue.target : null;
    const raw = t ? t.value : eOrValue;
    const nextVal = typeof parser === "function" ? parser(raw) : raw;
    setForm((f) => ({ ...(f || {}), [key]: nextVal }));
  };
  const setFormCheckedKey = (key) => (eOrChecked) => {
    const t = eOrChecked && eOrChecked.target ? eOrChecked.target : null;
    const raw = t ? t.checked : eOrChecked;
    setForm((f) => ({ ...(f || {}), [key]: Boolean(raw) }));
  };

  const canPickUser = isAdminLike;
  const selectedResponsible = canPickUser
    ? (users || []).find((u) => Number(u?.id || 0) === Number(form?.responsibleUserId || selectedUserId))
    : null;

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

  const getSeriesIdFromAnyId = (id) => {
    if (!id) return "";
    const s = String(id);
    const idx = s.indexOf("__");
    return idx > 0 ? s.slice(0, idx) : s;
  };

  const loadAttachments = async (seriesId) => {
    if (!seriesId) {
      setAttachments([]);
      return;
    }
    try {
      const { data } = await api.get(`/agenda/events/${seriesId}/attachments`);
      setAttachments(Array.isArray(data?.records) ? data.records : []);
    } catch (err) {
      setAttachments([]);
    }
  };

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
      seriesId: "",
      title: "",
      description: "",
      location: "",
      color: "#2563EB",
      allDay,
      startAt: startAt || new Date(),
      endAt: endAt || new Date(Date.now() + 60 * 60 * 1000),
      recurrenceType: "none",
      recurrenceInterval: 1,
      recurrenceUntil: null,
      reminderMinutes: 0,
      notifyInChat: true,
      notifyOnCreate: true,
      responsibleUserId: Number(selectedUserId || currentUserId || 0),
    });
    setAttachments([]);
    setModalOpen(true);
  };

  const openEdit = (record) => {
    const seriesId = record.seriesId || getSeriesIdFromAnyId(record.id);
    const reminder = Array.isArray(record.reminders) && record.reminders[0] ? record.reminders[0] : null;
    setForm({
      id: record.id,
      seriesId,
      title: record.title || "",
      description: record.description || "",
      location: record.location || "",
      color: record.color || "#2563EB",
      allDay: Boolean(record.allDay),
      startAt: new Date(record.startAt),
      endAt: new Date(record.endAt),
      recurrenceType: String(record.recurrenceType || "none"),
      recurrenceInterval: Number(record.recurrenceInterval || 1) || 1,
      recurrenceUntil: record.recurrenceUntil ? new Date(record.recurrenceUntil) : null,
      reminderMinutes: reminder ? Number(reminder.minutesBefore || 0) : 0,
      notifyInChat: reminder ? Boolean(reminder.notifyInChat) : true,
      notifyOnCreate: false,
      responsibleUserId: Number(record.userId || selectedUserId || currentUserId || 0),
    });
    loadAttachments(seriesId);
    setModalOpen(true);
  };

  const buildPayload = (forceTitle) => {
    const reminders =
      Number(form.reminderMinutes || 0) > 0
        ? [{ minutesBefore: Number(form.reminderMinutes || 0), notifyInChat: Boolean(form.notifyInChat) }]
        : [];
    const titleTrimmed = String(form.title || "").trim();
    const titleResolved = titleTrimmed || String(forceTitle || "").trim() || "Evento";
    return {
      title: titleResolved,
      description: form.description,
      location: form.location,
      color: form.color,
      allDay: form.allDay,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      recurrenceType: String(form.recurrenceType || "none"),
      recurrenceInterval: Number(form.recurrenceInterval || 1) || 1,
      recurrenceUntil:
        form.recurrenceType && String(form.recurrenceType) !== "none" && form.recurrenceUntil
          ? new Date(form.recurrenceUntil).toISOString()
          : null,
      reminders,
      ...(canPickUser ? { userId: Number(form.responsibleUserId || selectedUserId || currentUserId || 0) } : {}),
      notify: Boolean(form.notifyOnCreate),
    };
  };

  const saveEvent = async ({ closeModal = true } = {}) => {
    // Backend requires title; if user leaves it empty, we auto-fill to avoid errors
    const payload = buildPayload("Evento");
    if (!String(form.title || "").trim()) {
      setForm((f) => ({ ...(f || {}), title: payload.title }));
    }

    if (form.seriesId) {
      await api.put(`/agenda/events/${form.seriesId}`, payload);
      if (closeModal) {
        setModalOpen(false);
        await loadEventsForRange();
      }
      return String(form.seriesId || "");
    }

    const { data } = await api.post("/agenda/events", payload);
    const createdSeriesId = data?.id || "";
    if (createdSeriesId) {
      setForm((f) => ({ ...(f || {}), seriesId: createdSeriesId }));
      await loadAttachments(createdSeriesId);
    }
    if (closeModal) {
      setModalOpen(false);
      await loadEventsForRange();
    }
    return String(createdSeriesId || "");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEvent({ closeModal: true });
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!form.seriesId) return;
    setDeleting(true);
    try {
      await api.delete(`/agenda/events/${form.seriesId}`);
      setModalOpen(false);
      await loadEventsForRange();
    } catch (err) {
      toastError(err);
    }
    setDeleting(false);
  };

  const handleUploadAttachment = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      let seriesId = String(form.seriesId || "");
      if (!seriesId) {
        // Allow selecting an attachment before saving the event:
        // create the event first (keeps the modal open), then upload.
        seriesId = await saveEvent({ closeModal: false });
      }
      if (!seriesId) {
        toastError("Não foi possível salvar o evento para anexar o arquivo. Verifique os campos e tente novamente.");
        setUploading(false);
        return;
      }
      const data = new FormData();
      data.append("file", file);
      // Let the browser set the multipart boundary automatically
      await api.post(`/agenda/events/${seriesId}/attachments`, data);
      await loadAttachments(seriesId);
      await loadEventsForRange();
    } catch (err) {
      toastError(err);
    }
    setUploading(false);
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!attachmentId || !form.seriesId) return;
    try {
      await api.delete(`/agenda/events/${form.seriesId}/attachments/${attachmentId}`);
      await loadAttachments(form.seriesId);
    } catch (err) {
      toastError(err);
    }
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
              style={{ background: view === "dayGridMonth" ? "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.14)" : undefined }}
            />
            <Chip
              className={classes.viewChip}
              size="small"
              clickable
              icon={<ViewWeekOutlinedIcon />}
              label={`Semana`}
              onClick={() => setView("timeGridWeek")}
              style={{ background: view === "timeGridWeek" ? "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.14)" : undefined }}
            />
            <Chip
              className={classes.viewChip}
              size="small"
              clickable
              icon={<EventOutlinedIcon />}
              label={`Dia`}
              onClick={() => setView("timeGridDay")}
              style={{ background: view === "timeGridDay" ? "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.14)" : undefined }}
            />
            <Chip
              className={classes.viewChip}
              size="small"
              clickable
              icon={<ListAltOutlinedIcon />}
              label={`Agenda`}
              onClick={() => setView("listWeek")}
              style={{ background: view === "listWeek" ? "rgba(var(--tr-heading-rgb, 11, 76, 70), 0.14)" : undefined }}
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
                const seriesId = arg.event.extendedProps?.seriesId || getSeriesIdFromAnyId(arg.event.id);
                const reminder = Array.isArray(arg.event.extendedProps?.reminders) && arg.event.extendedProps.reminders[0] ? arg.event.extendedProps.reminders[0] : null;
                const reminders = reminder ? [{ minutesBefore: Number(reminder.minutesBefore || 0), notifyInChat: Boolean(reminder.notifyInChat) }] : [];
                await api.put(`/agenda/events/${seriesId}`, {
                  title: arg.event.title,
                  description: arg.event.extendedProps?.description || "",
                  location: arg.event.extendedProps?.location || "",
                  color: arg.event.backgroundColor || "#2563EB",
                  allDay: arg.event.allDay,
                  startAt: arg.event.start?.toISOString(),
                  endAt: (arg.event.end || arg.event.start)?.toISOString(),
                  recurrenceType: String(arg.event.extendedProps?.recurrenceType || "none"),
                  recurrenceInterval: Number(arg.event.extendedProps?.recurrenceInterval || 1) || 1,
                  recurrenceUntil: arg.event.extendedProps?.recurrenceUntil || null,
                  reminders,
                  ...(canPickUser ? { userId: selectedUserId } : {}),
                });
              } catch (err) {
                toastError(err);
                arg.revert();
              }
            }}
            eventResize={async (arg) => {
              try {
                const seriesId = arg.event.extendedProps?.seriesId || getSeriesIdFromAnyId(arg.event.id);
                const reminder = Array.isArray(arg.event.extendedProps?.reminders) && arg.event.extendedProps.reminders[0] ? arg.event.extendedProps.reminders[0] : null;
                const reminders = reminder ? [{ minutesBefore: Number(reminder.minutesBefore || 0), notifyInChat: Boolean(reminder.notifyInChat) }] : [];
                await api.put(`/agenda/events/${seriesId}`, {
                  title: arg.event.title,
                  description: arg.event.extendedProps?.description || "",
                  location: arg.event.extendedProps?.location || "",
                  color: arg.event.backgroundColor || "#2563EB",
                  allDay: arg.event.allDay,
                  startAt: arg.event.start?.toISOString(),
                  endAt: (arg.event.end || arg.event.start)?.toISOString(),
                  recurrenceType: String(arg.event.extendedProps?.recurrenceType || "none"),
                  recurrenceInterval: Number(arg.event.extendedProps?.recurrenceInterval || 1) || 1,
                  recurrenceUntil: arg.event.extendedProps?.recurrenceUntil || null,
                  reminders,
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
                {canPickUser
                  ? `Usuário: ${selectedResponsible?.name || selectedResponsible?.email || `#${form.responsibleUserId || selectedUserId}`}`
                  : `Visão: ${viewLabel(view)}`}
              </Typography>
            </div>
          </div>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {canPickUser ? (
              <Grid item xs={12}>
                <FormControl variant="outlined" size="small" className={classes.field} fullWidth>
                  <InputLabel id="agenda-modal-user">Usuário responsável</InputLabel>
                  <Select
                    labelId="agenda-modal-user"
                    label="Usuário responsável"
                    value={Number(form.responsibleUserId || selectedUserId || currentUserId || 0)}
                    onChange={setFormKey("responsibleUserId", (v) => Number(v || selectedUserId || currentUserId || 0))}
                  >
                    {(users || []).map((u) => (
                      <MenuItem key={u.id} value={Number(u.id)}>
                        {u.name || u.email || `Usuário #${u.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            ) : null}
            <Grid item xs={12}>
              <TextField
                className={classes.field}
                label="Título"
                variant="outlined"
                size="small"
                fullWidth
                value={form.title}
                onChange={setFormKey("title", (v) => String(v || ""))}
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
                onChange={setFormKey("description", (v) => String(v || ""))}
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
                onChange={setFormKey("location", (v) => String(v || ""))}
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
                onChange={setFormKey("color", (v) => String(v || "#2563EB"))}
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
              <div className={classes.sectionLabel}>
                <EventOutlinedIcon style={{ fontSize: 16, opacity: 0.75 }} />
                Recorrência
              </div>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                className={classes.field}
                select
                label="Repetir"
                variant="outlined"
                size="small"
                fullWidth
                value={String(form.recurrenceType || "none")}
                onChange={setFormKey("recurrenceType", (v) => String(v || "none"))}
              >
                {RECURRENCE_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                className={classes.field}
                label="Intervalo"
                variant="outlined"
                size="small"
                fullWidth
                type="number"
                inputProps={{ min: 1, max: 365 }}
                disabled={String(form.recurrenceType || "none") === "none"}
                value={Number(form.recurrenceInterval || 1)}
                onChange={setFormKey("recurrenceInterval", (v) => Number(v || 1) || 1)}
                helperText={
                  String(form.recurrenceType || "none") === "none"
                    ? "Sem repetição"
                    : `A cada ${Number(form.recurrenceInterval || 1)} ${String(form.recurrenceType) === "daily" ? "dia(s)" : String(form.recurrenceType) === "weekly" ? "semana(s)" : "mês(es)"}`
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                className={classes.field}
                label="Repetir até (opcional)"
                type="date"
                variant="outlined"
                size="small"
                fullWidth
                disabled={String(form.recurrenceType || "none") === "none"}
                value={form.recurrenceUntil ? toInputDateValue(form.recurrenceUntil) : ""}
                onChange={setFormKey("recurrenceUntil", (v) => (v ? new Date(`${v}T23:59`) : null))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <div className={classes.sectionLabel}>
                <EventOutlinedIcon style={{ fontSize: 16, opacity: 0.75 }} />
                Lembrete
              </div>
            </Grid>
            <Grid item xs={12} sm={7}>
              <TextField
                className={classes.field}
                select
                label="Avisar"
                variant="outlined"
                size="small"
                fullWidth
                value={Number(form.reminderMinutes || 0)}
                onChange={setFormKey("reminderMinutes", (v) => Number(v || 0) || 0)}
              >
                {REMINDER_PRESETS.map((p) => (
                  <MenuItem key={p.minutes} value={p.minutes}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
              <div className={classes.hint}>
                O lembrete aparece como alerta e também pode mandar um aviso no <strong>Chat - Interno</strong>.
              </div>
            </Grid>
            <Grid item xs={12} sm={5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.notifyInChat)}
                    onChange={setFormCheckedKey("notifyInChat")}
                    color="primary"
                    disabled={Number(form.reminderMinutes || 0) <= 0}
                  />
                }
                label={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <ChatBubbleOutlineOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
                    Notificar no Chat
                  </span>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.notifyOnCreate)}
                    onChange={setFormCheckedKey("notifyOnCreate")}
                    color="primary"
                  />
                }
                label={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <ChatBubbleOutlineOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
                    Notificar responsável ao criar
                  </span>
                }
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.allDay}
                    onChange={setFormCheckedKey("allDay")}
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
                      const v = e && e.target ? e.target.value : "";
                      const d = new Date(`${v}T00:00`);
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
                      const v = e && e.target ? e.target.value : "";
                      const d = new Date(`${v}T23:59`);
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
                    onChange={setFormKey("startAt", (v) => new Date(String(v || "")))}
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
                    onChange={setFormKey("endAt", (v) => new Date(String(v || "")))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <div className={classes.sectionLabel}>
                <AttachFileOutlinedIcon style={{ fontSize: 16, opacity: 0.75 }} />
                Anexos
              </div>
              <TrButton
                variant="outlined"
                startIcon={<CloudUploadOutlinedIcon />}
                disabled={uploading || saving}
                onClick={() => {
                  if (uploading || saving) return;
                  const el = uploadInputRef.current;
                  // Some browsers block clicking inputs with display:none (hidden attribute).
                  // Prefer showPicker when available, else click.
                  try {
                    if (el && typeof el.showPicker === "function") return el.showPicker();
                  } catch {}
                  if (el && typeof el.click === "function") el.click();
                }}
              >
                {uploading ? "Enviando..." : "Enviar anexo"}
              </TrButton>
              <input
                type="file"
                ref={uploadInputRef}
                tabIndex={-1}
                // Visually hidden (but NOT display:none), so programmatic click opens picker reliably
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
                onChange={(e) => {
                  const file = e?.target?.files?.[0];
                  // allow selecting same file again
                  try { e.target.value = ""; } catch {}
                  handleUploadAttachment(file);
                }}
              />
              <div className={classes.hint}>
                {form.seriesId
                  ? "Arquivos ficam salvos no evento."
                  : "Ao anexar, o evento será salvo automaticamente para guardar o arquivo."}
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {(attachments || []).length ? (
                  (attachments || []).map((a) => (
                    <div key={a.id} className={classes.attachmentItem}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <AttachFileOutlinedIcon style={{ fontSize: 18, opacity: 0.8 }} />
                        <a
                          href={`${String(api?.defaults?.baseURL || "").replace(/\/+$/, "")}/${String(a.filePath || "").replace(/^\/+/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={classes.attachmentName}
                          title={a.fileName}
                        >
                          {a.fileName}
                        </a>
                      </div>
                      <TrButton variant="outlined" onClick={() => handleDeleteAttachment(a.id)}>
                        Remover
                      </TrButton>
                    </div>
                  ))
                ) : (
                  <div className={classes.hint}>Nenhum anexo.</div>
                )}
              </div>
            </Grid>
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

