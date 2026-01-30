import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { createMuiTheme, ThemeProvider as MuiThemeProvider, useTheme as useMuiTheme } from "@material-ui/core/styles";

const defaultBranding = {
  appTitle: "TR Multichat",
  faviconUrl: "/favicon.ico",
  primaryColor: "#0B4C46",
  secondaryColor: "#2BA9A5",
  buttonColor: "#2BA9A5",
  textColor: "#1F2937",
  backgroundType: "color",
  backgroundColor: "#F4F7F7",
  backgroundImage: "/uploads/bg-tech.png",
  logoUrl: "/uploads/logo-tr.png",
  fontFamily: "Inter, sans-serif",
  borderRadius: 12,
  sidebarVariant: "gradient",
  loginBackgroundType: "image"
};

const ThemeContext = createContext({ branding: defaultBranding, setBranding: () => {}, refreshBranding: async () => {}, updateBranding: async () => {}, muiTheme: null });

export const ThemeProvider = ({ children }) => {
  const [branding, setBranding] = useState(defaultBranding);
  const [muiTheme, setMuiTheme] = useState(createMuiTheme());
  const parentTheme = useMuiTheme();

  const parentMode =
    (parentTheme && parentTheme.palette && parentTheme.palette.type) ||
    (parentTheme && parentTheme.mode) ||
    window.localStorage.getItem("preferredTheme") ||
    "light";

  const darken = (hex, amount = 0.1) => {
    try {
      const h = hex.replace('#','');
      const bigint = parseInt(h.length === 3 ? h.split('').map(x=>x+x).join('') : h, 16);
      let r = (bigint >> 16) & 255;
      let g = (bigint >> 8) & 255;
      let b = bigint & 255;
      r = Math.max(0, Math.min(255, Math.floor(r * (1-amount))));
      g = Math.max(0, Math.min(255, Math.floor(g * (1-amount))));
      b = Math.max(0, Math.min(255, Math.floor(b * (1-amount))));
      const toHex = (n) => n.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (_) { return hex; }
  };

  const buildMuiTheme = (b) => {
    // Importante: herdar o tema base (inclui dark/light e superfícies).
    return createMuiTheme(parentTheme || {}, {
      palette: {
        type: parentMode === "dark" ? "dark" : "light",
        primary: { main: b.primaryColor || (parentTheme?.palette?.primary?.main || defaultBranding.primaryColor) },
        secondary: { main: b.secondaryColor || (parentTheme?.palette?.secondary?.main || defaultBranding.secondaryColor) },
        // não sobrescrever background/text do tema base no dark (evita "quebrar" o modo)
        text: {
          primary: parentMode === "dark" ? (parentTheme?.palette?.text?.primary || "#E5E7EB") : (b.textColor || parentTheme?.palette?.text?.primary || defaultBranding.textColor),
          secondary: parentTheme?.palette?.text?.secondary || (parentMode === "dark" ? "#94A3B8" : "#475569")
        }
      },
      typography: {
        fontFamily: b.fontFamily || parentTheme?.typography?.fontFamily || defaultBranding.fontFamily,
      },
      overrides: {
        MuiButton: {
          root: { borderRadius: 8, textTransform: 'none' },
          containedPrimary: {
            backgroundColor: b.buttonColor || b.primaryColor,
            '&:hover': { backgroundColor: darken(b.buttonColor || b.primaryColor, 0.1) }
          }
        },
        MuiAppBar: { colorPrimary: { backgroundColor: b.primaryColor } },
        MuiDrawer: {
          paper: {
            background: parentMode === "dark"
              ? `linear-gradient(180deg, ${b.primaryColor}, rgba(2,6,23,0.55))`
              : `linear-gradient(180deg, ${b.primaryColor}, rgba(0,0,0,0.20))`,
            color: '#fff'
          }
        },
        MuiCard: {
          root: {
            borderRadius: 12,
            border: `1px solid ${b.primaryColor}20`,
            backgroundColor: parentTheme?.palette?.background?.paper
          }
        },
        MuiChip: { colorPrimary: { backgroundColor: b.secondaryColor, color: '#fff' } },
        MuiTableHead: { root: { backgroundColor: `${b.primaryColor}10` } },
        MuiOutlinedInput: {
          root: {
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: b.primaryColor },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: b.primaryColor }
          }
        },
        MuiInputLabel: { root: { '&.Mui-focused': { color: b.primaryColor } } }
      }
    });
  };

  const applyBackground = (b) => {
    try {
      const body = document.body;
      if (!body) return;
      const isDark = String(parentMode || "").toLowerCase() === "dark";
      if (b.backgroundType === "image" && b.backgroundImage) {
        // No dark mode, aplica overlay para harmonizar com as superfícies
        body.style.backgroundImage = isDark
          ? `linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.78)), url(${b.backgroundImage})`
          : `url(${b.backgroundImage})`;
        body.style.backgroundSize = "cover";
        body.style.backgroundRepeat = "no-repeat";
        body.style.backgroundPosition = "center";
        body.style.backgroundColor = isDark ? "#0B1220" : (b.backgroundColor || "#F4F7F7");
      } else {
        body.style.backgroundImage = "none";
        body.style.background = isDark ? "#0B1220" : (b.backgroundColor || "#F4F7F7");
      }
    } catch (_) {}
  };

  const applyCssVars = (b) => {
    try {
      const root = document.documentElement;
      if (!root) return;
      const isDark = String(parentMode || "").toLowerCase() === "dark";
      root.style.setProperty("--tr-primary", b.primaryColor || defaultBranding.primaryColor);
      root.style.setProperty("--tr-secondary", b.secondaryColor || defaultBranding.secondaryColor);
      root.style.setProperty("--tr-button", b.buttonColor || b.primaryColor || defaultBranding.buttonColor);
      root.style.setProperty("--tr-text", b.textColor || defaultBranding.textColor);
      root.style.setProperty("--tr-bg", isDark ? "#0B1220" : (b.backgroundColor || defaultBranding.backgroundColor));
      root.style.setProperty("--tr-logo", b.logoUrl || defaultBranding.logoUrl);
      root.style.setProperty("--tr-font", b.fontFamily || defaultBranding.fontFamily);
      root.style.setProperty("--tr-radius", ((b.borderRadius ?? defaultBranding.borderRadius) + "px"));
      // tokens premium de superfície
      root.style.setProperty("--tr-surface", isDark ? "#0F172A" : "#FFFFFF");
      root.style.setProperty("--tr-surface2", isDark ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.03)");
      root.style.setProperty("--tr-border", isDark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.10)");
      root.style.setProperty("--tr-muted", isDark ? "rgba(148,163,184,0.85)" : "rgba(15,23,42,0.65)");
    } catch (_) {}
  };

  const applyMeta = (b) => {
    try {
      const title = String(b.appTitle || defaultBranding.appTitle || "").trim();
      if (title) document.title = title;

      const fav = b.faviconUrl ? toAbsoluteUrl(b.faviconUrl) : null;
      if (fav) {
        const links = Array.from(document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]'));
        if (links.length) {
          links.forEach((l) => l.setAttribute("href", fav));
        } else {
          const link = document.createElement("link");
          link.setAttribute("rel", "icon");
          link.setAttribute("href", fav);
          document.head.appendChild(link);
        }
      }

      const themeColor = String(b.primaryColor || "").trim();
      if (themeColor) {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "theme-color");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", themeColor);
      }
    } catch (_) {}
  };

  const toAbsoluteUrl = (url) => {
    try {
      if (!url) return url;
      if (/^https?:\/\//i.test(url)) return url;
      const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
      const path = String(url).startsWith("/") ? url : `/${url}`;
      return `${base}${path}`;
    } catch (_) {
      return url;
    }
  };

  const refreshBranding = useCallback(async () => {
    try {
      const { data } = await api.get("/branding");
      const merged = { ...defaultBranding, ...(data || {}) };
      // normalize asset URLs to absolute (backend origin)
      const normalized = {
        ...merged,
        logoUrl: toAbsoluteUrl(merged.logoUrl),
        backgroundImage: merged.backgroundImage ? toAbsoluteUrl(merged.backgroundImage) : merged.backgroundImage
      };
      setBranding(normalized);
      applyBackground(normalized);
      applyCssVars(normalized);
      applyMeta(normalized);
      setMuiTheme(buildMuiTheme(normalized));
    } catch (_) {
      setBranding(defaultBranding);
      applyBackground(defaultBranding);
      applyCssVars(defaultBranding);
      applyMeta(defaultBranding);
      setMuiTheme(buildMuiTheme(defaultBranding));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMode]);

  const updateBranding = useCallback(async (payload) => {
    const { data } = await api.put("/branding", payload);
    const merged = { ...defaultBranding, ...(data || {}) };
    const normalized = {
      ...merged,
      logoUrl: toAbsoluteUrl(merged.logoUrl),
      backgroundImage: merged.backgroundImage ? toAbsoluteUrl(merged.backgroundImage) : merged.backgroundImage
    };
    setBranding(normalized);
    applyBackground(normalized);
    applyCssVars(normalized);
    applyMeta(normalized);
    setMuiTheme(buildMuiTheme(normalized));
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMode]);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  useEffect(() => {
    // Rebuild branding theme when dark/light changes.
    try {
      setMuiTheme(buildMuiTheme(branding));
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMode]);

  const value = useMemo(
    () => ({ branding, setBranding, refreshBranding, updateBranding, muiTheme }),
    [branding, muiTheme, refreshBranding, updateBranding]
  );
  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeBranding = () => useContext(ThemeContext);


