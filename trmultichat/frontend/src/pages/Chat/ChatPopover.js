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
import Button from "@material-ui/core/Button";
import { socketConnection } from "../../services/socket";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useHistory, useLocation } from "react-router-dom";
import api from "../../services/api";
import { toast } from "react-toastify";

import notifySound from "../../assets/chat_notify.mp3";
import useSound from "use-sound";

// OBS: este componente foi reaproveitado como o ícone do "Chat - Interno" (painel /informativos)
// Ele notifica via socket quando há novo informativo ou resposta e abre o painel ao clicar.

export default function ChatPopover() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();
  const pathname = location.pathname;
  const myUserId = Number(user?.id || localStorage.getItem("userId") || 0);

  const [unreadCount, setUnreadCount] = useState(0);
  const [play] = useSound(notifySound);
  const soundAlertRef = useRef();
  const pathnameRef = useRef(pathname || "");
  const lastToastAtRef = useRef(0);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackText, setSnackText] = useState("Nova mensagem no Chat - Interno");

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
    if (sendToAll === true) return true;
    if (targetUserId === null || targetUserId === undefined) return false;
    return Number(targetUserId) === Number(myUserId || 0);
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
    setSnackText("Nova mensagem no Chat - Interno");
    setSnackOpen(true);
    toast.info("Nova mensagem no Chat - Interno", {
      autoClose: 6000,
      closeOnClick: true,
      onClick: () => history.push("/informativos"),
    });
  }, [history]);

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
        bumpUnread({ storageKey });
        maybeToast();
        // toca som se foi resposta de outro usuário (ex.: admin recebeu resposta do usuário, ou vice-versa)
        if (data?.action === "reply" && Number(data?.reply?.userId || 0) !== userId) {
          try { soundAlertRef.current(); } catch {}
        }
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [myUserId, bumpUnread, isVisibleToMeFromPayload, maybeToast]);

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
        let hasNew = false;
        for (const r of records) {
          const t = new Date(r?.lastReplyAt || r?.updatedAt || r?.createdAt || 0).getTime();
          if (!Number.isFinite(t) || t <= 0) continue;
          if (t > newest) newest = t;
          if (t > lastSeen) hasNew = true;
        }

        if (hasNew) {
          bumpUnread({ storageKey });
          maybeToast();
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
  }, [myUserId, bumpUnread, maybeToast]);

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
        message={snackText}
        autoHideDuration={6000}
        action={
          <>
            <Button
              color="secondary"
              size="small"
              onClick={() => {
                setSnackOpen(false);
                handleClick();
              }}
            >
              Abrir
            </Button>
          </>
        }
      />
    </div>
  );
}
