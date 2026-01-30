import React, { useState, useEffect, useContext, useRef } from "react";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
import MicRecorder from "mic-recorder-to-mp3";
import clsx from "clsx";
import { isNil } from "lodash";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import IconButton from "@material-ui/core/IconButton";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import { FormControlLabel, Switch } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { isString, isEmpty, isObject, has } from "lodash";
import StarBorderOutlinedIcon from "@material-ui/icons/StarBorderOutlined";
import StarOutlinedIcon from "@material-ui/icons/StarOutlined";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import axios from "axios";

import RecordingTimer from "./RecordingTimer";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import toastError from "../../errors/toastError";

import useQuickMessages from "../../hooks/useQuickMessages";

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    backgroundColor: theme.palette.bordabox, //DARK MODE PLW DESIGN//
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },

  newMessageBox: {
    backgroundColor: theme.palette.newmessagebox, //DARK MODE PLW DESIGN//
    width: "100%",
    display: "flex",
    padding: "7px",
    alignItems: "center",
  },

  messageInputWrapper: {
    padding: 6,
    marginRight: 7,
    backgroundColor: theme.palette.inputdigita, //DARK MODE PLW DESIGN//
    display: "flex",
    borderRadius: 20,
    flex: 1,
  },

  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
  },

  sendMessageIcons: {
    color: "grey",
  },

  uploadInput: {
    display: "none",
  },

  viewMediaInputWrapper: {
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eee",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },

  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: "1px solid #e8e8e8",
  },

  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },

  audioLoading: {
    color: green[500],
    opacity: "70%",
  },

  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },

  cancelAudioIcon: {
    color: "red",
  },

  sendAudioIcon: {
    color: "green",
  },

  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7,
  },

  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },
}));

const EmojiOptions = (props) => {
  const { disabled, showEmoji, setShowEmoji, handleAddEmoji } = props;
  const classes = useStyles();
  return (
    <>
      <IconButton
        aria-label="emojiPicker"
        component="span"
        disabled={disabled}
        onClick={(e) => setShowEmoji((prevState) => !prevState)}
      >
        <MoodIcon className={classes.sendMessageIcons} />
      </IconButton>
      {showEmoji ? (
        <div className={classes.emojiBox}>
          <Picker
            perLine={16}
            showPreview={false}
            showSkinTones={false}
            onSelect={handleAddEmoji}
          />
        </div>
      ) : null}
    </>
  );
};

const SignSwitch = (props) => {
  const { width, setSignMessage, signMessage } = props;
  if (isWidthUp("md", width)) {
    return (
      <FormControlLabel
        style={{ marginRight: 7, color: "gray" }}
        label={i18n.t("messagesInput.signMessage")}
        labelPlacement="start"
        control={
          <Switch
            size="small"
            checked={signMessage}
            onChange={(e) => {
              setSignMessage(e.target.checked);
            }}
            name="showAllTickets"
            color="primary"
          />
        }
      />
    );
  }
  return null;
};

const FileInput = (props) => {
  const { handleChangeMedias, disableOption } = props;
  const classes = useStyles();
  return (
    <>
      <input
        multiple
        type="file"
        id="upload-button"
        disabled={disableOption()}
        className={classes.uploadInput}
        onChange={handleChangeMedias}
      />
      <label htmlFor="upload-button">
        <IconButton
          aria-label="upload"
          component="span"
          disabled={disableOption()}
        >
          <AttachFileIcon className={classes.sendMessageIcons} />
        </IconButton>
      </label>
    </>
  );
};

const ActionButtons = (props) => {
  const {
    inputMessage,
    loading,
    recording,
    ticketStatus,
    handleSendMessage,
    handleCancelAudio,
    handleUploadAudio,
    handleStartRecording,
  } = props;
  const classes = useStyles();
  if (inputMessage) {
    return (
      <IconButton
        aria-label="sendMessage"
        component="span"
        onClick={handleSendMessage}
        disabled={loading}
      >
        <SendIcon className={classes.sendMessageIcons} />
      </IconButton>
    );
  } else if (recording) {
    return (
      <div className={classes.recorderWrapper}>
        <IconButton
          aria-label="cancelRecording"
          component="span"
          fontSize="large"
          disabled={loading}
          onClick={handleCancelAudio}
        >
          <HighlightOffIcon className={classes.cancelAudioIcon} />
        </IconButton>
        {loading ? (
          <div>
            <CircularProgress className={classes.audioLoading} />
          </div>
        ) : (
          <RecordingTimer />
        )}

        <IconButton
          aria-label="sendRecordedAudio"
          component="span"
          onClick={handleUploadAudio}
          disabled={loading}
        >
          <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
        </IconButton>
      </div>
    );
  } else {
    return (
      <IconButton
        aria-label="showRecorder"
        component="span"
        disabled={loading || ticketStatus !== "open"}
        onClick={handleStartRecording}
      >
        <MicIcon className={classes.sendMessageIcons} />
      </IconButton>
    );
  }
};

const CustomInput = (props) => {
  const {
    loading,
    inputRef,
    ticketStatus,
    inputMessage,
    setInputMessage,
    handleSendMessage,
    handleInputPaste,
    disableOption,
    handleQuickAnswersClick,
  } = props;
  const classes = useStyles();
  const [quickMessages, setQuickMessages] = useState([]);
  const [options, setOptions] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);

  const { user } = useContext(AuthContext);
  const companyId = localStorage.getItem("companyId");
  const pinKey = `qm:pins:${companyId}:${user?.id || "me"}`;
  const usageKey = `qm:usage:${companyId}:${user?.id || "me"}`;

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  const [pinnedMap, setPinnedMap] = useState(() => readJson(pinKey, {}));
  const [usageMap, setUsageMap] = useState(() => readJson(usageKey, {}));
  const pendingUsageRef = useRef({});
  const flushTimerRef = useRef(null);

  const { list: listQuickMessages } = useQuickMessages();

  useEffect(() => {
    async function fetchData() {
      const messages = await listQuickMessages({ companyId, userId: user.id });
      const options = messages.map((m) => {
        let truncatedMessage = m.message;
        if (isString(truncatedMessage) && truncatedMessage.length > 35) {
          truncatedMessage = m.message.substring(0, 35) + "...";
        }
        return {
          value: m.message,
          shortcode: m.shortcode,
          id: m.id,
          category: m.category,
          label: `/${m.shortcode} - ${truncatedMessage}`,
          mediaPath: m.mediaPath,
        };
      });
      setQuickMessages(options);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // keep localStorage in sync when keys change (tenant/user)
    setPinnedMap(readJson(pinKey, {}));
    setUsageMap(readJson(usageKey, {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, usageKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // authoritative source: backend (falls back to local storage if it fails)
        const { data } = await api.get("/quick-messages/meta");
        if (!alive) return;
        const pinnedIds = Array.isArray(data?.pinnedIds) ? data.pinnedIds : [];
        const usageById = data?.usageById && typeof data.usageById === "object" ? data.usageById : {};

        const pinMap = {};
        for (const id of pinnedIds) {
          const k = String(Number(id || 0));
          if (k && k !== "0") pinMap[k] = true;
        }
        setPinnedMap(pinMap);
        setUsageMap({ ...(usageById || {}) });

        // keep in localStorage for fast startup
        writeJson(pinKey, pinMap);
        writeJson(usageKey, { ...(usageById || {}) });
      } catch (_) {
        // silent
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPinned = (opt) => {
    const id = String(opt?.id ?? opt?.shortcode ?? "");
    return Boolean(pinnedMap?.[id]);
  };

  const togglePinned = (opt) => {
    const id = String(opt?.id ?? opt?.shortcode ?? "");
    if (!id) return;
    // optimistic update + sync with backend
    const willPin = !Boolean(pinnedMap?.[id]);
    setPinnedMap((prev) => {
      const next = { ...(prev || {}) };
      next[id] = willPin;
      if (!next[id]) delete next[id];
      writeJson(pinKey, next);
      return next;
    });
    (async () => {
      try {
        if (willPin) await api.post(`/quick-messages/pins/${Number(id)}`);
        else await api.delete(`/quick-messages/pins/${Number(id)}`);
      } catch (_) {
        // revert on failure
        setPinnedMap((prev) => {
          const next = { ...(prev || {}) };
          next[id] = !willPin;
          if (!next[id]) delete next[id];
          writeJson(pinKey, next);
          return next;
        });
      }
    })();
  };

  const flushUsage = async () => {
    const pending = pendingUsageRef.current || {};
    const keys = Object.keys(pending);
    if (!keys.length) return;
    pendingUsageRef.current = {};
    try {
      const increments = keys
        .map((k) => ({ id: Number(k), delta: Number(pending[k] || 0) }))
        .filter((x) => x.id && x.delta > 0)
        .slice(0, 50);
      if (!increments.length) return;
      await api.post("/quick-messages/usage", { increments });
    } catch (_) {
      // restore pending to retry next time
      const restore = pendingUsageRef.current || {};
      for (const k of keys) {
        restore[k] = (Number(restore[k]) || 0) + (Number(pending[k]) || 0);
      }
      pendingUsageRef.current = restore;
    }
  };

  const queueUsage = (idStr, delta = 1) => {
    const id = String(idStr || "").trim();
    if (!id) return;
    const pending = pendingUsageRef.current || {};
    pending[id] = (Number(pending[id]) || 0) + (Number(delta) || 1);
    pendingUsageRef.current = pending;

    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(async () => {
      flushTimerRef.current = null;
      await flushUsage();
    }, 1500);
  };

  const bumpUsage = (opt) => {
    const id = String(opt?.id ?? opt?.shortcode ?? "");
    if (!id) return;
    setUsageMap((prev) => {
      const next = { ...(prev || {}) };
      next[id] = (Number(next[id]) || 0) + 1;
      writeJson(usageKey, next);
      return next;
    });
    queueUsage(id, 1);
  };

  const sortPremium = (arr) => {
    const a = Array.isArray(arr) ? [...arr] : [];
    a.sort((x, y) => {
      const px = isPinned(x) ? 1 : 0;
      const py = isPinned(y) ? 1 : 0;
      if (px !== py) return py - px;
      const ux = Number(usageMap?.[String(x?.id ?? x?.shortcode ?? "")] || 0);
      const uy = Number(usageMap?.[String(y?.id ?? y?.shortcode ?? "")] || 0);
      if (ux !== uy) return uy - ux;
      return String(x?.shortcode || "").localeCompare(String(y?.shortcode || ""));
    });
    return a;
  };

  useEffect(() => {
    if (
      isString(inputMessage) &&
      !isEmpty(inputMessage) &&
      inputMessage.length > 1
    ) {
      const firstChar = inputMessage.charAt(0);
      const isQuick = firstChar === "/";
      setPopupOpen(isQuick);

      if (isQuick) {
        const q = String(inputMessage || "").toLowerCase();
        let filteredOptions = quickMessages
          .filter((m) => {
            const sc = String(m.shortcode || "").toLowerCase();
            const lbl = String(m.label || "").toLowerCase();
            const val = String(m.value || "").toLowerCase();
            return sc.startsWith(q.replace("/", "")) || lbl.includes(q) || val.includes(q.replace("/", ""));
          })
          .slice(0, 40);

        // Special cases:
        // "/" or very short query -> show pinned + most used on top
        const naked = q === "/" || q === "/ " || q === "/\n";
        if (naked || q.length <= 2) {
          const byUsage = [...quickMessages].sort((a, b) => {
            const ua = Number(usageMap?.[String(a?.id ?? a?.shortcode ?? "")] || 0);
            const ub = Number(usageMap?.[String(b?.id ?? b?.shortcode ?? "")] || 0);
            return ub - ua;
          });
          const pinned = quickMessages.filter((m) => isPinned(m));
          const topUsed = byUsage.filter((m) => (Number(usageMap?.[String(m?.id ?? m?.shortcode ?? "")] || 0) > 0)).slice(0, 8);
          const merged = [];
          const seen = new Set();
          for (const m of [...pinned, ...topUsed, ...filteredOptions]) {
            const k = String(m?.id ?? m?.shortcode ?? "");
            if (!k || seen.has(k)) continue;
            seen.add(k);
            merged.push(m);
            if (merged.length >= 18) break;
          }
          filteredOptions = merged;
        }

        setOptions(sortPremium(filteredOptions).slice(0, 18));
      } else {
        setOptions([]);
      }
    } else {
      setPopupOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage]);

  const onKeyPress = (e) => {
    if (loading || e.shiftKey) return;
    else if (e.key === "Enter") {
      // Premium UX: se o usuário digitou exatamente "/atalho", já envia a resposta rápida
      const raw = String(inputMessage || "").trim();
      if (raw.startsWith("/")) {
        const typed = raw.replace(/^\//, "").trim().toLowerCase();
        const exact = quickMessages.find((m) => String(m.shortcode || "").toLowerCase() === typed);
        if (exact) {
          // com anexo: já dispara envio; sem anexo: envia o texto diretamente
          if (!isNil(exact.mediaPath)) {
            handleQuickAnswersClick(exact);
            bumpUsage(exact);
            return;
          }
          handleSendMessage(exact.value);
          bumpUsage(exact);
          return;
        }
      }
      handleSendMessage();
    }
  };

  const onPaste = (e) => {
    if (ticketStatus === "open") {
      handleInputPaste(e);
    }
  };

  const renderPlaceholder = () => {
    if (ticketStatus === "open") {
      return i18n.t("messagesInput.placeholderOpen");
    }
    return i18n.t("messagesInput.placeholderClosed");
  };


  const setInputRef = (input) => {
    if (input) {
      input.focus();
      inputRef.current = input;
    }
  };

  return (
    <div className={classes.messageInputWrapper}>
      <Autocomplete
        freeSolo
        open={popupOpen}
        id="grouped-demo"
        value={inputMessage}
        options={options}
        closeIcon={null}
        groupBy={(opt) => {
          if (!isObject(opt)) return "";
          if (isPinned(opt)) return "Fixados";
          const used = Number(usageMap?.[String(opt?.id ?? opt?.shortcode ?? "")] || 0);
          if (used > 0) return (opt?.category ? String(opt.category) : "Mais usados");
          return opt?.category ? String(opt.category) : "Outros";
        }}
        getOptionLabel={(option) => {
          if (isObject(option)) {
            return option.label;
          } else {
            return option;
          }
        }}
        onChange={(event, opt) => {
         
          if (isObject(opt) && has(opt, "value") && isNil(opt.mediaPath)) {
            setInputMessage(opt.value);
            bumpUsage(opt);
            setTimeout(() => {
              inputRef.current.scrollTop = inputRef.current.scrollHeight;
            }, 200);
          } else if (isObject(opt) && has(opt, "value") && !isNil(opt.mediaPath)) {
            handleQuickAnswersClick(opt);
            bumpUsage(opt);

            setTimeout(() => {
              inputRef.current.scrollTop = inputRef.current.scrollHeight;
            }, 200);
          }
        }}
        onInputChange={(event, opt, reason) => {
          if (reason === "input") {
            setInputMessage(event.target.value);
          }
        }}
        onPaste={onPaste}
        onKeyPress={onKeyPress}
        style={{ width: "100%" }}
        renderOption={(opt) => {
          try {
            const shortcode = String(opt?.shortcode || "").trim();
            const hasMedia = !isNil(opt?.mediaPath);
            const preview = String(opt?.value || "").replace(/\s+/g, " ").trim();
            const pinned = isPinned(opt);
            return (
              <div style={{ width: "100%", padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(15,23,42,0.92)" }}>
                      /{shortcode || "atalho"}
                      {hasMedia ? (
                        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8 }} role="img" aria-label="Anexo">
                          📎
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {preview || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <IconButton
                      size="small"
                      style={{ padding: 6 }}
                      title={pinned ? "Desafixar" : "Fixar"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePinned(opt);
                      }}
                    >
                      {pinned ? <StarOutlinedIcon style={{ fontSize: 18 }} /> : <StarBorderOutlinedIcon style={{ fontSize: 18 }} />}
                    </IconButton>
                    <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 800 }}>Enter</div>
                  </div>
                </div>
              </div>
            );
          } catch {
            return String(opt?.label || opt);
          }
        }}
        renderInput={(params) => {
          const { InputLabelProps, InputProps, ...rest } = params;
          return (
            <InputBase
              {...params.InputProps}
              {...rest}
              disabled={disableOption()}
              inputRef={setInputRef}
              placeholder={renderPlaceholder()}
              multiline
              className={classes.messageInput}
              maxRows={5}
            />
          );
        }}
      />
    </div>
  );
};

const MessageInputCustom = (props) => {
  const { ticketStatus, ticketId } = props;
  const classes = useStyles();

  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef();
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  useEffect(() => {
    inputRef.current.focus();
  }, [replyingMessage]);

  useEffect(() => {
    inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMedias([]);
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage]);

  // const handleChangeInput = e => {
  // 	if (isObject(e) && has(e, 'value')) {
  // 		setInputMessage(e.value);
  // 	} else {
  // 		setInputMessage(e.target.value)
  // 	}
  // };

  const handleAddEmoji = (e) => {
    let emoji = e.native;
    setInputMessage((prevState) => prevState + emoji);
  };

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }

    const selectedMedias = Array.from(e.target.files);
    setMedias(selectedMedias);
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleUploadQuickMessageMedia = async (blob, message) => {
    setLoading(true);
    try {
      const extension = blob.type.split("/")[1];

      const formData = new FormData();
      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("body",  message);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setLoading(false);
  };
  
  const handleQuickAnswersClick = async (value) => {
    if (value.mediaPath) {
      try {
        const { data } = await axios.get(value.mediaPath, {
          responseType: "blob",
        });

        handleUploadQuickMessageMedia(data, value.value);
        setInputMessage("");
        return;
        //  handleChangeMedias(response)
      } catch (err) {
        toastError(err);
      }
    }

    setInputMessage("");
    setInputMessage(value.value);
  };

  const handleUploadMedia = async (e) => {
    setLoading(true);
    e.preventDefault();

    const formData = new FormData();
    formData.append("fromMe", true);
    medias.forEach((media) => {
      formData.append("medias", media);
      formData.append("body", media.name);
    });

    try {
      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
    setMedias([]);
  };

  const handleSendMessage = async (overrideMessage) => {
    const bodyRaw = typeof overrideMessage === "string" ? overrideMessage : inputMessage;
    if (String(bodyRaw || "").trim() === "") return;
    setLoading(true);

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${user?.name}:*\n${String(bodyRaw || "").trim()}`
        : String(bodyRaw || "").trim(),
      quotedMsg: replyingMessage,
    };
    try {
      await api.post(`/messages/${ticketId}`, message);
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await Mp3Recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const [, blob] = await Mp3Recorder.stop().getMp3();
      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();
      const filename = `audio-record-site-${new Date().getTime()}.mp3`;
      formData.append("medias", blob, filename);
      formData.append("body", filename);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setRecording(false);
    setLoading(false);
  };

  const handleCancelAudio = async () => {
    try {
      await Mp3Recorder.stop().getMp3();
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const disableOption = () => {
    return loading || recording || ticketStatus !== "open";
  };

  const renderReplyingMessage = (message) => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && (
              <span className={classes.messageContactName}>
                {message.contact?.name}
              </span>
            )}
            {message.body}
          </div>
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={loading || ticketStatus !== "open"}
          onClick={() => setReplyingMessage(null)}
        >
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (medias.length > 0)
    return (
      <Paper elevation={0} square className={classes.viewMediaInputWrapper}>
        <IconButton
          aria-label="cancel-upload"
          component="span"
          onClick={(e) => setMedias([])}
        >
          <CancelIcon className={classes.sendMessageIcons} />
        </IconButton>

        {loading ? (
          <div>
            <CircularProgress className={classes.circleLoading} />
          </div>
        ) : (
          <span>
            {medias[0]?.name}
            {/* <img src={media.preview} alt=""></img> */}
          </span>
        )}
        <IconButton
          aria-label="send-upload"
          component="span"
          onClick={handleUploadMedia}
          disabled={loading}
        >
          <SendIcon className={classes.sendMessageIcons} />
        </IconButton>
      </Paper>
    );
  else {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        <div className={classes.newMessageBox}>
          <EmojiOptions
            disabled={disableOption()}
            handleAddEmoji={handleAddEmoji}
            showEmoji={showEmoji}
            setShowEmoji={setShowEmoji}
          />

          <FileInput
            disableOption={disableOption}
            handleChangeMedias={handleChangeMedias}
          />

          <SignSwitch
            width={props.width}
            setSignMessage={setSignMessage}
            signMessage={signMessage}
          />

          <CustomInput
            loading={loading}
            inputRef={inputRef}
            ticketStatus={ticketStatus}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            // handleChangeInput={handleChangeInput}
            handleSendMessage={handleSendMessage}
            handleInputPaste={handleInputPaste}
            disableOption={disableOption}
            handleQuickAnswersClick={handleQuickAnswersClick}
          />

          <ActionButtons
            inputMessage={inputMessage}
            loading={loading}
            recording={recording}
            ticketStatus={ticketStatus}
            handleSendMessage={handleSendMessage}
            handleCancelAudio={handleCancelAudio}
            handleUploadAudio={handleUploadAudio}
            handleStartRecording={handleStartRecording}
          />
        </div>
      </Paper>
    );
  }
};

export default withWidth()(MessageInputCustom);
