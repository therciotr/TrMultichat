import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import ForumIcon from "@material-ui/icons/Forum";
import {
  Badge,
  IconButton,
} from "@material-ui/core";
import Snackbar from "@material-ui/core/Snackbar";
import SnackbarContent from "@material-ui/core/SnackbarContent";
import Slide from "@material-ui/core/Slide";
import Typography from "@material-ui/core/Typography";
import CloseIcon from "@material-ui/icons/Close";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";
import OpenInNewOutlinedIcon from "@material-ui/icons/OpenInNewOutlined";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import { socketConnection } from "../../services/socket";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useHistory, useLocation } from "react-router-dom";
import api from "../../services/api";

import notifySound from "../../assets/chat_notify.mp3";
import useSound from "use-sound";

// OBS: este componente foi reaproveitado como o ícone do "Chat - Interno" (painel /informativos)
// Ele notifica via socket quando há novo informativo ou resposta e abre o painel ao clicar.

const useStyles = makeStyles((theme) => ({
  snackRoot: {
    borderRadius: 14,
    background: "rgba(255,255,255,0.96)",
    color: "rgba(15, 23, 42, 0.92)",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
    backdropFilter: "blur(10px)",
    padding: theme.spacing(1.25, 1.5),
    position: "relative",
    overflow: "hidden",
    minWidth: 340,
    maxWidth: 440,
    [theme.breakpoints.down("xs")]: {
      minWidth: 280,
      maxWidth: "calc(100vw - 24px)",
    },
    "&:before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      background:
        "linear-gradient(180deg, rgba(16, 185, 129, 0.95), rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95))",
    },
  },
  snackRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
  },
  snackIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(59, 130, 246, 0.10)",
    color: "rgba(59, 130, 246, 0.95)",
    flex: "0 0 auto",
  },
  snackTexts: {
    flex: "1 1 auto",
    minWidth: 0,
  },
  snackTitle: {
    fontWeight: 900,
    fontSize: 13,
    lineHeight: "16px",
    margin: 0,
  },
  snackMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.62)",
    lineHeight: "16px",
  },
  snackPreview: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.70)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  snackActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginLeft: theme.spacing(0.5),
    flex: "0 0 auto",
  },
  snackBtn: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(59, 130, 246, 0.98)",
    border: "1px solid rgba(59, 130, 246, 0.25)",
    background: "rgba(59, 130, 246, 0.06)",
    textTransform: "none",
    minHeight: 32,
    "&:hover": { background: "rgba(59, 130, 246, 0.10)" },
  },
  snackClose: {
    color: "rgba(15, 23, 42, 0.55)",
  },
}));

function SlideUp(props) {
  return <Slide {...props} direction="up" />;
}

export default function ChatPopover({ volume }) {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();
  const pathname = location.pathname;
  const myUserId = Number(user?.id || localStorage.getItem("userId") || 0);
  const classes = useStyles();
  const profile = String(user?.profile || localStorage.getItem("profile") || "").toLowerCase();
  const isAdminLike = Boolean(user?.super) || profile === "admin" || profile === "super";

  const [unreadCount, setUnreadCount] = useState(0);
  const volumeNum = Math.max(0, Math.min(1, Number(volume ?? 1)));
  const [play] = useSound(notifySound, { volume: volumeNum });
  const soundAlertRef = useRef();
  const pathnameRef = useRef(pathname || "");
  const lastToastAtRef = useRef(0);
  const lastSoundAtRef = useRef(0);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackTitle, setSnackTitle] = useState("Chat - Interno");
  const [snackFrom, setSnackFrom] = useState("Sistema");
  const [snackTo, setSnackTo] = useState("Todos");
  const [snackPreview, setSnackPreview] = useState("Nova mensagem interna");

  useEffect(() => {
    soundAlertRef.current = play;

    if (!("Notification" in window)) {
      console.log("This browser doesn't support notifications");
    } else {
      Notification.requestPermission();
    }
  }, [play]);

  useEffect(() => {
    pathnameRef.current = String(pathname || "");
  }, [pathname]);

  const isVisibleToMeFromPayload = useCallback((data, myUserId) => {
    if (!data) return false;
    const sendToAll = data?.record?.sendToAll ?? data?.sendToAll;
    const targetUserId = data?.record?.targetUserId ?? data?.targetUserId;
    const status = data?.record?.status ?? data?.status ?? true;
    if (status === false) return false;
    // Admin/Super: notify for all active messages in the company
    if (isAdminLike) return true;
    if (sendToAll === true) return true;
    if (targetUserId === null || targetUserId === undefined) return false;
    return Number(targetUserId) === Number(myUserId || 0);
  }, [isAdminLike]);

  const formatRecipient = useCallback((data) => {
    const sendToAll = data?.record?.sendToAll ?? data?.sendToAll;
    const targetUserId = data?.record?.targetUserId ?? data?.targetUserId;
    const targetUserName = data?.record?.targetUserName ?? data?.targetUserName;
    if (sendToAll === true) return "Todos";
    if (targetUserName) return String(targetUserName);
    if (targetUserId !== null && targetUserId !== undefined && String(targetUserId) !== "") return `Usuário #${targetUserId}`;
    return "—";
  }, []);

  const formatSender = useCallback((data) => {
    if (data?.action === "reply") {
      return String(data?.reply?.userName || "Sistema");
    }
    return String(data?.record?.senderName || "Sistema");
  }, []);

  const bumpUnread = useCallback(({ storageKey }) => {
    const isOnPanel = String(pathnameRef.current || "").startsWith("/informativos");
    if (isOnPanel) return;
    setUnreadCount((prev) => {
      const next = (Number(prev) || 0) + 1;
      try { localStorage.setItem(storageKey, String(next)); } catch {}
      return next;
    });
  }, []);

  const maybeToast = useCallback(() => {
    const now = Date.now();
    if (now - (Number(lastToastAtRef.current) || 0) < 2500) return;
    lastToastAtRef.current = now;
    setSnackTitle("Chat - Interno");
    setSnackFrom("Sistema");
    setSnackTo("Todos");
    setSnackPreview("Nova mensagem interna");
    setSnackOpen(true);
  }, []);

  const maybeSound = useCallback(() => {
    const now = Date.now();
    if (now - (Number(lastSoundAtRef.current) || 0) < 2500) return;
    lastSoundAtRef.current = now;
    try { soundAlertRef.current && soundAlertRef.current(); } catch {}
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = Number(myUserId || 0);
    if (!companyId || !userId) return undefined;

    const storageKey = `chat-interno:unread:${companyId}:${userId}`;
    const lastSeenKey = `chat-interno:lastSeen:${companyId}:${userId}`;
    try {
      const stored = Number(localStorage.getItem(storageKey) || "0");
      if (Number.isFinite(stored) && stored > 0) setUnreadCount(stored);
    } catch {}
    try {
      // initialize lastSeen to "now" on first run to avoid counting historical items as new
      const existing = localStorage.getItem(lastSeenKey);
      if (!existing) localStorage.setItem(lastSeenKey, new Date().toISOString());
    } catch {}

    const socket = socketConnection({ companyId });

    socket.on(`company-announcement`, (data) => {
      const visibleToMe = isVisibleToMeFromPayload(data, userId);

      const actionOk = data?.action === "create" || data?.action === "update" || data?.action === "reply";
      if (visibleToMe && actionOk) {
        // Improve popup text with context when available
        try {
          const toLabel = formatRecipient(data);
          const fromLabel = formatSender(data);
          if (data?.action === "reply") {
            const txt = String(data?.reply?.text || "").trim();
            setSnackTitle(`Resposta de ${fromLabel}`);
            setSnackFrom(fromLabel);
            setSnackTo(toLabel);
            setSnackPreview(txt || "Nova resposta no Chat - Interno");
          } else if (data?.record) {
            const title = String(data?.record?.title || "Chat - Interno").trim();
            const txt = String(data?.record?.text || "").trim();
            setSnackTitle(title || "Chat - Interno");
            setSnackFrom(fromLabel);
            setSnackTo(toLabel);
            setSnackPreview(txt || "Novo informativo");
          }
        } catch {}
        bumpUnread({ storageKey });
        maybeToast();
        // som: qualquer mensagem/reply nova que NÃO foi enviada por mim
        const senderId =
          data?.action === "reply"
            ? Number(data?.reply?.userId || 0)
            : Number(data?.record?.userId || 0);
        if (senderId && senderId !== userId) {
          maybeSound();
        }
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [myUserId, bumpUnread, isVisibleToMeFromPayload, maybeToast, formatRecipient, formatSender, maybeSound]);

  // Fallback robusto: polling (caso o socket falhe no navegador/rede do usuário)
  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = Number(myUserId || 0);
    if (!companyId || !userId) return undefined;
    const storageKey = `chat-interno:unread:${companyId}:${userId}`;
    const lastSeenKey = `chat-interno:lastSeen:${companyId}:${userId}`;

    let timer = null;
    let cancelled = false;

    async function poll() {
      try {
        const isOnPanel = String(pathnameRef.current || "").startsWith("/informativos");
        if (isOnPanel) return;

        const { data } = await api.get("/announcements/", { params: { pageNumber: 1, searchParam: "" } });
        const records = Array.isArray(data?.records) ? data.records : [];
        if (!records.length) return;

        const lastSeenIso = String(localStorage.getItem(lastSeenKey) || "");
        const lastSeen = lastSeenIso ? new Date(lastSeenIso).getTime() : 0;

        let newest = lastSeen;
        let newestRec = null;
        let hasNew = false;
        for (const r of records) {
          const t = new Date(r?.lastReplyAt || r?.updatedAt || r?.createdAt || 0).getTime();
          if (!Number.isFinite(t) || t <= 0) continue;
          if (t > newest) newest = t;
          if (t > lastSeen) {
            hasNew = true;
            if (
              !newestRec ||
              t >
                new Date(
                  newestRec?.lastReplyAt || newestRec?.updatedAt || newestRec?.createdAt || 0
                ).getTime()
            ) {
              newestRec = r;
            }
          }
        }

        if (hasNew) {
          const toLabel =
            newestRec?.sendToAll === true
              ? "Todos"
              : String(
                  newestRec?.targetUserName ||
                    (newestRec?.targetUserId ? `Usuário #${newestRec?.targetUserId}` : "—")
                );
          const fromLabel = String(newestRec?.lastReplyUserName || newestRec?.senderName || "Sistema");
          const preview = String(newestRec?.lastReplyText || newestRec?.title || "Nova mensagem interna").trim();
          setSnackTitle("Chat - Interno");
          setSnackFrom(fromLabel);
          setSnackTo(toLabel);
          setSnackPreview(preview);
          bumpUnread({ storageKey });
          maybeToast();
          // som no fallback (se não fui eu que mandei)
          const senderId = Number(newestRec?.lastReplyUserId || newestRec?.userId || 0);
          if (senderId && senderId !== userId) {
            maybeSound();
          }
          try { localStorage.setItem(lastSeenKey, new Date(newest).toISOString()); } catch {}
        }
      } catch (_) {}
    }

    // initial + interval
    poll();
    timer = setInterval(() => {
      if (cancelled) return;
      poll();
    }, 30000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [myUserId, bumpUnread, maybeToast, maybeSound]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = Number(myUserId || 0);
    if (!companyId || !userId) return;
    const storageKey = `chat-interno:unread:${companyId}:${userId}`;
    const lastSeenKey = `chat-interno:lastSeen:${companyId}:${userId}`;
    const isOnPanel = String(pathname || "").startsWith("/informativos");
    if (isOnPanel) {
      setUnreadCount(0);
      try { localStorage.setItem(storageKey, "0"); } catch {}
      try { localStorage.setItem(lastSeenKey, new Date().toISOString()); } catch {}
    }
  }, [pathname, myUserId]);

  const handleClick = (event) => {
    const companyId = localStorage.getItem("companyId");
    const userId = Number(myUserId || 0);
    if (companyId && userId) {
      const storageKey = `chat-interno:unread:${companyId}:${userId}`;
      const lastSeenKey = `chat-interno:lastSeen:${companyId}:${userId}`;
      try { localStorage.setItem(storageKey, "0"); } catch {}
      try { localStorage.setItem(lastSeenKey, new Date().toISOString()); } catch {}
    }
    setUnreadCount(0);
    history.push("/informativos");
  };

  const hasUnread = unreadCount > 0;

  return (
    <div>
      <IconButton
        variant="contained"
        color={hasUnread ? "inherit" : "default"}
        onClick={handleClick}
        style={{ color: "white" }}
        title="Chat - Interno"
      >
        <Badge
          color="secondary"
          badgeContent={hasUnread ? unreadCount : 0}
          invisible={!hasUnread}
          max={99}
        >
          <ForumIcon />
        </Badge>
      </IconButton>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        open={snackOpen}
        onClose={() => setSnackOpen(false)}
        autoHideDuration={6000}
        TransitionComponent={SlideUp}
      >
        <SnackbarContent
          className={classes.snackRoot}
          message={
            <div className={classes.snackRow}>
              <div className={classes.snackIconWrap}>
                <ForumOutlinedIcon style={{ fontSize: 20 }} />
              </div>
              <div className={classes.snackTexts}>
                <Typography className={classes.snackTitle}>{snackTitle}</Typography>
                <div className={classes.snackMeta}>
                  <strong>De:</strong> {snackFrom}
                </div>
                <div className={classes.snackMeta}>
                  <strong>Para:</strong> {snackTo}
                </div>
                <div className={classes.snackPreview}>{snackPreview}</div>
              </div>
              <div className={classes.snackActions}>
                <Button
                  className={classes.snackBtn}
                  onClick={() => {
                    setSnackOpen(false);
                    handleClick();
                  }}
                  title="Abrir"
                >
                  <OpenInNewOutlinedIcon style={{ fontSize: 16, marginRight: 6 }} />
                  Abrir
                </Button>
                <IconButton
                  size="small"
                  onClick={() => setSnackOpen(false)}
                  className={classes.snackClose}
                  title="Fechar"
                >
                  <CloseIcon style={{ fontSize: 18 }} />
                </IconButton>
              </div>
            </div>
          }
        />
      </Snackbar>
    </div>
  );
}
