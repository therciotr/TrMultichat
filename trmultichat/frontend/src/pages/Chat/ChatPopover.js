import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import ForumIcon from "@material-ui/icons/Forum";
import {
  Badge,
  IconButton,
} from "@material-ui/core";
import { socketConnection } from "../../services/socket";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useHistory, useLocation } from "react-router-dom";

import notifySound from "../../assets/chat_notify.mp3";
import useSound from "use-sound";

// OBS: este componente foi reaproveitado como o ícone do "Chat - Interno" (painel /informativos)
// Ele notifica via socket quando há novo informativo ou resposta e abre o painel ao clicar.

export default function ChatPopover() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();
  const pathname = location.pathname;
  const userIdDep = user?.id;

  const [unreadCount, setUnreadCount] = useState(0);
  const [play] = useSound(notifySound);
  const soundAlertRef = useRef();
  const pathnameRef = useRef(pathname || "");

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

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = Number(userIdDep || 0);
    if (!companyId || !userId) return undefined;

    const storageKey = `chat-interno:unread:${companyId}:${userId}`;
    try {
      const stored = Number(localStorage.getItem(storageKey) || "0");
      if (Number.isFinite(stored) && stored > 0) setUnreadCount(stored);
    } catch {}

    const socket = socketConnection({ companyId });

    socket.on(`company-announcement`, (data) => {
      // só notifica se o evento for visível para o usuário atual
      const visibleToMe = (() => {
        if (!data) return false;
        // create/update mandam record; reply manda sendToAll/targetUserId/status
        const sendToAll = data?.record?.sendToAll ?? data?.sendToAll;
        const targetUserId = data?.record?.targetUserId ?? data?.targetUserId;
        const status = data?.record?.status ?? data?.status ?? true;
        if (status === false) return false;
        if (sendToAll === true) return true;
        if (targetUserId === null || targetUserId === undefined) return false;
        return Number(targetUserId) === userId;
      })();

      const actionOk = data?.action === "create" || data?.action === "update" || data?.action === "reply";
      if (visibleToMe && actionOk) {
        // Não contar como "não lida" se o usuário já está no painel
        const isOnPanel = String(pathnameRef.current || "").startsWith("/informativos");
        if (!isOnPanel) {
          setUnreadCount((prev) => {
            const next = (Number(prev) || 0) + 1;
            try { localStorage.setItem(storageKey, String(next)); } catch {}
            return next;
          });
        }
        // toca som se foi resposta de outro usuário (ex.: admin recebeu resposta do usuário, ou vice-versa)
        if (data?.action === "reply" && Number(data?.reply?.userId || 0) !== userId) {
          try { soundAlertRef.current(); } catch {}
        }
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [userIdDep]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = Number(userIdDep || 0);
    if (!companyId || !userId) return;
    const storageKey = `chat-interno:unread:${companyId}:${userId}`;
    const isOnPanel = String(pathname || "").startsWith("/informativos");
    if (isOnPanel) {
      setUnreadCount(0);
      try { localStorage.setItem(storageKey, "0"); } catch {}
    }
  }, [pathname, userIdDep]);

  const handleClick = (event) => {
    const companyId = localStorage.getItem("companyId");
    const userId = Number(userIdDep || 0);
    if (companyId && userId) {
      const storageKey = `chat-interno:unread:${companyId}:${userId}`;
      try { localStorage.setItem(storageKey, "0"); } catch {}
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
    </div>
  );
}
