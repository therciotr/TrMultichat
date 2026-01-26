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
import { useHistory } from "react-router-dom";

import notifySound from "../../assets/chat_notify.mp3";
import useSound from "use-sound";

// OBS: este componente foi reaproveitado como o ícone do "Chat - Interno" (painel /informativos)
// Ele notifica via socket quando há novo informativo ou resposta e abre o painel ao clicar.

export default function ChatPopover() {
  const { user } = useContext(AuthContext);
  const history = useHistory();

  const [invisible, setInvisible] = useState(true);
  const [play] = useSound(notifySound);
  const soundAlertRef = useRef();

  useEffect(() => {
    soundAlertRef.current = play;

    if (!("Notification" in window)) {
      console.log("This browser doesn't support notifications");
    } else {
      Notification.requestPermission();
    }
  }, [play]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
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
        return Number(targetUserId) === Number(user?.id || 0);
      })();

      if (visibleToMe && (data?.action === "create" || data?.action === "update" || data?.action === "reply")) {
        setInvisible(false);
        // toca som se foi resposta de outro usuário (ex.: admin recebeu resposta do usuário, ou vice-versa)
        if (data?.action === "reply" && Number(data?.reply?.userId || 0) !== Number(user?.id || 0)) {
          try { soundAlertRef.current(); } catch {}
        }
      }
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (event) => {
    setInvisible(true);
    history.push("/informativos");
  };

  return (
    <div>
      <IconButton
        variant="contained"
        color={invisible ? "default" : "inherit"}
        onClick={handleClick}
        style={{ color: "white" }}
        title="Chat - Interno"
      >
        <Badge color="secondary" variant="dot" invisible={invisible}>
          <ForumIcon />
        </Badge>
      </IconButton>
    </div>
  );
}
