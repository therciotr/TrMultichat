import React, { useCallback, useEffect, useRef, useState, useContext } from "react";
import clsx from "clsx";
import { toast } from "react-toastify";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
} from "@material-ui/core";

import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import AccountCircle from "@material-ui/icons/AccountCircle";
import CachedIcon from "@material-ui/icons/Cached";

import MainListItems from "./MainListItems";
import { useThemeBranding } from "../context/ThemeContext";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";

import logo from "../assets/logo-tr.png";
import { socketConnection } from "../services/socket";
import api from "../services/api";
import ChatPopover from "../pages/Chat/ChatPopover";
import AudioUnlock from "../components/AudioUnlock";
import { playAgendaChime } from "../utils/notificationAudio";

import { useDate } from "../hooks/useDate";

import ColorModeContext from "../layout/themeContext";
import Brightness4Icon from '@material-ui/icons/Brightness4';
import Brightness7Icon from '@material-ui/icons/Brightness7';

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    [theme.breakpoints.down("sm")]: {
      height: "calc(100vh - 56px)",
    },
    backgroundColor: theme.palette.fancyBackground,
    '& .MuiButton-outlinedPrimary': {
      color: theme.mode === 'light' ? '#00BFFF' : '#FFF',
      border: theme.mode === 'light' ? '1px solid rgba(0 124 102)' : '1px solid rgba(255, 255, 255, 0.5)',
    },
    '& .MuiTab-textColorPrimary.Mui-selected': {
      color: theme.mode === 'light' ? '#00BFFF' : '#FFF',
    }
  },
  avatar: {
    width: "100%",
  },
  toolbar: {
    paddingRight: 24, // keep right padding when drawer closed
    color: '#fff',
    background: theme.palette.barraSuperior,
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px",
    minHeight: "48px",
    [theme.breakpoints.down("sm")]: {
      height: "48px"
    }
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      display: "none"
    }
  },
  menuButton: {
    marginRight: 36,
  },
  menuButtonHidden: {
    display: "none",
  },
  title: {
    flexGrow: 1,
    fontSize: 14,
    color: "white",
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      width: "100%"
    },
    ...theme.scrollbarStylesSoft,
    background: theme.palette.type === "dark"
      ? "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.92) 100%)"
      : "linear-gradient(180deg, var(--tr-primary) 0%, rgba(0,0,0,0.25) 100%)",
    color: '#fff',
  },
  drawerPaperClose: {
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
    [theme.breakpoints.down("sm")]: {
      width: "100%"
    }
  },
  appBarSpacer: {
    minHeight: "48px",
  },
  content: {
    flex: 1,
    overflow: "auto",

  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column"
  },
  containerWithScroll: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  NotificationsPopOver: {
    // color: theme.barraSuperior.secondary.main,
  },
  logo: {
    width: "80%",
    height: "auto",
    maxWidth: 180,
    [theme.breakpoints.down("sm")]: {
      width: "auto",
      height: "80%",
      maxWidth: 180,
    },
    logo: theme.logo
  },
}));

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  // const [dueDate, setDueDate] = useState("");
  const { user } = useContext(AuthContext);
  const currentUserId = Number(user?.id || 0);

  const theme = useTheme();
  const { branding } = useThemeBranding();
  const { toggleColorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));

  const [volume, setVolume] = useState(Number(localStorage.getItem("volume") || 1));
  const volumeNum = Number(volume || 0);

  const { dateToClient } = useDate();

  // Idle logout (company setting)
  const idleIntervalRef = useRef(null);
  const lastActivityAtRef = useRef(Date.now());
  const didIdleLogoutRef = useRef(false);
  const [idleCfg, setIdleCfg] = useState({ enabled: false, minutes: 0 });

  const clearIdleTimer = useCallback(() => {
    try {
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
    } catch (_) {}
    idleIntervalRef.current = null;
    didIdleLogoutRef.current = false;
  }, []);

  const startIdleWatch = useCallback((cfg) => {
    clearIdleTimer();
    const enabled = Boolean(cfg?.enabled);
    const minutes = Number(cfg?.minutes || 0);
    if (!enabled || !(minutes > 0)) return;

    // marca "agora" como última atividade ao habilitar/reconfigurar
    lastActivityAtRef.current = Date.now();
    didIdleLogoutRef.current = false;

    const msLimit = Math.max(10_000, Math.floor(minutes * 60 * 1000));
    idleIntervalRef.current = setInterval(() => {
      try {
        if (didIdleLogoutRef.current) return;
        const now = Date.now();
        const last = Number(lastActivityAtRef.current || 0);
        if (now - last < msLimit) return;
        didIdleLogoutRef.current = true;
        try {
          localStorage.setItem("tr-idle-logout", String(Date.now()));
        } catch (_) {}
        try {
          toast.info("Sessão encerrada por inatividade.");
        } catch (_) {}
        // Preferir logout padrão, mas garantir fallback caso falhe (API /auth/logout pode falhar)
        try {
          const p = handleLogout?.();
          // se não redirecionar, força limpeza local
          setTimeout(() => {
            try {
              if (String(window.location.pathname || "").startsWith("/login")) return;
              localStorage.removeItem("token");
              localStorage.removeItem("refreshToken");
              localStorage.removeItem("companyId");
              localStorage.removeItem("userId");
              localStorage.removeItem("cshow");
            } catch (_) {}
            try {
              window.location.href = "/login";
            } catch (_) {}
          }, 2500);
          return p;
        } catch (_) {
          try {
            localStorage.removeItem("token");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("companyId");
            localStorage.removeItem("userId");
            localStorage.removeItem("cshow");
          } catch (_) {}
          try {
            window.location.href = "/login";
          } catch (_) {}
        }
      } catch (_) {}
    }, 2000);
  }, [clearIdleTimer, handleLogout]);

  const loadIdleConfig = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      const list = Array.isArray(data) ? data : [];
      const enabledRow = list.find((s) => String(s?.key) === "idleLogoutEnabled");
      const minutesRow = list.find((s) => String(s?.key) === "idleLogoutMinutes");
      const enabled = String(enabledRow?.value || "").toLowerCase() === "enabled";
      const minutes = Number(minutesRow?.value || 0);
      const next = { enabled, minutes: Number.isFinite(minutes) ? minutes : 0 };
      setIdleCfg(next);
    } catch (_) {
      // fail silent
      setIdleCfg({ enabled: false, minutes: 0 });
      clearIdleTimer();
    }
  }, [clearIdleTimer]);


  //################### CODIGOS DE TESTE #########################################
  // useEffect(() => {
  //   navigator.getBattery().then((battery) => {
  //     console.log(`Battery Charging: ${battery.charging}`);
  //     console.log(`Battery Level: ${battery.level * 100}%`);
  //     console.log(`Charging Time: ${battery.chargingTime}`);
  //     console.log(`Discharging Time: ${battery.dischargingTime}`);
  //   })
  // }, []);

  // useEffect(() => {
  //   const geoLocation = navigator.geolocation

  //   geoLocation.getCurrentPosition((position) => {
  //     let lat = position.coords.latitude;
  //     let long = position.coords.longitude;

  //     console.log('latitude: ', lat)
  //     console.log('longitude: ', long)
  //   })
  // }, []);

  // useEffect(() => {
  //   const nucleos = window.navigator.hardwareConcurrency;

  //   console.log('Nucleos: ', nucleos)
  // }, []);

  // useEffect(() => {
  //   console.log('userAgent', navigator.userAgent)
  //   if (
  //     navigator.userAgent.match(/Android/i)
  //     || navigator.userAgent.match(/webOS/i)
  //     || navigator.userAgent.match(/iPhone/i)
  //     || navigator.userAgent.match(/iPad/i)
  //     || navigator.userAgent.match(/iPod/i)
  //     || navigator.userAgent.match(/BlackBerry/i)
  //     || navigator.userAgent.match(/Windows Phone/i)
  //   ) {
  //     console.log('é mobile ', true) //celular
  //   }
  //   else {
  //     console.log('não é mobile: ', false) //nao é celular
  //   }
  // }, []);
  //##############################################################################

  useEffect(() => {
    if (document.body.offsetWidth > 600) {
      setDrawerOpen(true);
    }
  }, [loadIdleConfig, clearIdleTimer]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadIdleConfig();
      if (!alive) return;
    })();

    const onUpdated = () => loadIdleConfig();
    window.addEventListener("tr-settings-updated", onUpdated);
    return () => {
      alive = false;
      window.removeEventListener("tr-settings-updated", onUpdated);
      clearIdleTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idleEnabled = Boolean(idleCfg && idleCfg.enabled);
  const idleMinutes = Number((idleCfg && idleCfg.minutes) || 0);

  useEffect(() => {
    const enabled = idleEnabled;
    const minutes = idleMinutes;
    if (!enabled || !(minutes > 0)) {
      clearIdleTimer();
      return;
    }

    const onActivity = () => {
      // throttle to avoid excessive writes on mousemove
      const now = Date.now();
      const last = Number(lastActivityAtRef.current || 0);
      if (now - last < 800) return;
      lastActivityAtRef.current = now;
      didIdleLogoutRef.current = false;
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "touchmove",
      "wheel",
      "scroll",
      "pointerdown",
    ];
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    );

    // Cross-tab: if any tab logs out by idle, all tabs follow.
    const onStorage = (e) => {
      try {
        if (!e) return;
        if (String(e.key || "") !== "tr-idle-logout") return;
        if (String(window.location.pathname || "").startsWith("/login")) return;
        didIdleLogoutRef.current = true;
        if (typeof handleLogout === "function") {
          handleLogout();
        } else {
          try {
            localStorage.removeItem("token");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("companyId");
            localStorage.removeItem("userId");
            localStorage.removeItem("cshow");
          } catch (_) {}
          try {
            window.location.href = "/login";
          } catch (_) {}
        }
      } catch (_) {}
    };
    window.addEventListener("storage", onStorage);

    // When user returns to the app (focus/visible), count as activity.
    // Leaving the app (blur/hidden) does not reset the timer, so it still counts as inactivity.
    const onFocus = () => onActivity();
    const onVisibility = () => {
      try {
        if (!document.hidden) onActivity();
      } catch (_) {}
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // Start watcher immediately
    startIdleWatch({ enabled, minutes });

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearIdleTimer();
    };
  }, [idleEnabled, idleMinutes, startIdleWatch, clearIdleTimer, handleLogout]);

  useEffect(() => {
    if (document.body.offsetWidth < 600) {
      setDrawerVariant("temporary");
    } else {
      setDrawerVariant("permanent");
    }
  }, [drawerOpen]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = localStorage.getItem("userId");

    const socket = socketConnection({ companyId });

    socket.on(`company-${companyId}-auth`, (data) => {
      if (data.user.id === +userId) {
        toastError("Sua conta foi acessada em outro computador.");
        setTimeout(() => {
          localStorage.clear();
          window.location.reload();
        }, 1000);
      }
    });

    socket.emit("userStatus");
    const interval = setInterval(() => {
      socket.emit("userStatus");
    }, 1000 * 60 * 5);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Agenda premium: polling de lembretes (gera alerta + pode enviar no Chat - Interno)
  useEffect(() => {
    let mounted = true;
    let timer;

    const tick = async () => {
      try {
        if (!currentUserId) return;
        const { data } = await api.get("/agenda/reminders/due");
        const arr = Array.isArray(data?.records) ? data.records : [];
        if (!mounted || !arr.length) return;
        // Som específico da Agenda (1 por ciclo - evita spam)
        try { playAgendaChime(volumeNum); } catch {}
        for (const r of arr) {
          const when = r?.startAt ? new Date(r.startAt).toLocaleString("pt-BR") : "";
          const msg = `⏰ Lembrete: ${r?.title || "Evento"}${when ? ` • ${when}` : ""}`;
          toast.info(msg, {
            autoClose: 9000,
            onClick: () => {
              try {
                const href = String(r?.link || "/agenda");
                window.location.href = href;
              } catch {}
            },
          });
        }
      } catch (_) {
        // silent (no spam)
      }
    };

    // initial + interval
    tick();
    timer = setInterval(tick, 30000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [currentUserId, volumeNum]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (document.body.offsetWidth < 600) {
      setDrawerOpen(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload(false);
  }

  const handleMenuItemClick = () => {
    const { innerWidth: width } = window;
    if (width <= 600) {
      setDrawerOpen(false);
    }
  };

  const handleToggleColorMode = () => {
    if (typeof toggleColorMode === "function") toggleColorMode();
  };

  if (loading) {
    return <BackdropLoading />;
  }

  const resolvedLogo = branding?.logoUrl || logo;
  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          ),
        }}
        open={drawerOpen}
        PaperProps={{
          style: {
            // In dark mode we keep a premium dark surface (avoid brand-green "persisting").
            // In light mode we respect the branding sidebar variant.
            background:
              theme.palette.type === "dark"
                ? "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.92) 100%)"
                : (branding?.sidebarVariant === "solid"
                    ? "var(--tr-primary)"
                    : "linear-gradient(180deg, var(--tr-primary) 0%, rgba(0,0,0,0.25) 100%)"),
            color: "#fff",
          },
        }}
      >
        <div className={classes.toolbarIcon}>
          <img src={resolvedLogo} className={classes.logo} alt="logo" />
          <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
            <ChevronLeftIcon />
          </IconButton>
        </div>
        <Divider />
        <List className={classes.containerWithScroll}>
          <MainListItems drawerClose={drawerClose} collapsed={!drawerOpen} />
        </List>
        <Divider />
      </Drawer>
      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />
      <AppBar
        position="absolute"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
        color="primary"
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            variant="contained"
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(
              classes.menuButton,
              drawerOpen && classes.menuButtonHidden
            )}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            component="h2"
            variant="h6"
            color="inherit"
            noWrap
            className={classes.title}
          >
            {/* {greaterThenSm && user?.profile === "admin" && getDateAndDifDays(user?.company?.dueDate).difData < 7 ? ( */}
            {greaterThenSm && user?.profile === "admin" && user?.company?.dueDate && !user?.super ? (
              <>
                Olá <b>{user.name}</b>, Bem vindo a <b>{user?.company?.name}</b>! (Ativo até {dateToClient(user?.company?.dueDate)})
              </>
            ) : (
              <>
                Olá  <b>{user.name}</b>, Bem vindo a <b>{user?.company?.name}</b>!
              </>
            )}
          </Typography>

          <IconButton edge="start" onClick={handleToggleColorMode}>
            {theme.mode === 'dark' ? <Brightness7Icon style={{ color: "white" }} /> : <Brightness4Icon style={{ color: "white" }} />}
          </IconButton>

          <NotificationsVolume
            setVolume={setVolume}
            volume={volume}
          />

          <IconButton
            onClick={handleRefreshPage}
            aria-label={i18n.t("mainDrawer.appBar.refresh")}
            color="inherit"
          >
            <CachedIcon style={{ color: "white" }} />
          </IconButton>

          {user.id && <NotificationsPopOver volume={Number(volumeNum || 1)} />}

          <ChatPopover volume={Number(volumeNum || 1)} />

          <div>
            <IconButton
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              variant="contained"
              style={{ color: "white" }}
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={menuOpen}
              onClose={handleCloseMenu}
            >
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>

            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <main className={classes.content}>
        <div className={classes.appBarSpacer} />

        {children ? children : null}
      </main>
      <AudioUnlock />
    </div>
  );
};

export default LoggedInLayout;