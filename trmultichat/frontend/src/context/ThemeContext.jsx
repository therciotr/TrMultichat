import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { createMuiTheme, ThemeProvider as MuiThemeProvider } from "@material-ui/core/styles";

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
    return createMuiTheme({
      palette: {
        primary: { main: b.primaryColor },
        secondary: { main: b.secondaryColor },
        background: { default: b.backgroundColor || '#F4F7F7' },
        text: { primary: b.textColor }
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
        MuiDrawer: { paper: { background: `linear-gradient(180deg, ${b.primaryColor}, rgba(0,0,0,0.2))`, color: '#fff' } },
        MuiCard: { root: { borderRadius: 12, border: `1px solid ${b.primaryColor}20` } },
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
      if (b.backgroundType === "image" && b.backgroundImage) {
        body.style.backgroundImage = `url(${b.backgroundImage})`;
        body.style.backgroundSize = "cover";
        body.style.backgroundRepeat = "no-repeat";
        body.style.backgroundPosition = "center";
      } else {
        body.style.backgroundImage = "none";
        body.style.background = b.backgroundColor || "#F4F7F7";
      }
    } catch (_) {}
  };

  const applyCssVars = (b) => {
    try {
      const root = document.documentElement;
      if (!root) return;
      root.style.setProperty("--tr-primary", b.primaryColor || defaultBranding.primaryColor);
      root.style.setProperty("--tr-secondary", b.secondaryColor || defaultBranding.secondaryColor);
      root.style.setProperty("--tr-button", b.buttonColor || b.primaryColor || defaultBranding.buttonColor);
      root.style.setProperty("--tr-text", b.textColor || defaultBranding.textColor);
      root.style.setProperty("--tr-bg", b.backgroundColor || defaultBranding.backgroundColor);
      root.style.setProperty("--tr-logo", b.logoUrl || defaultBranding.logoUrl);
      root.style.setProperty("--tr-font", b.fontFamily || defaultBranding.fontFamily);
      root.style.setProperty("--tr-radius", ((b.borderRadius ?? defaultBranding.borderRadius) + "px"));
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

  const refreshBranding = async () => {
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
  };

  const updateBranding = async (payload) => {
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
  };

  useEffect(() => {
    refreshBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ branding, setBranding, refreshBranding, updateBranding, muiTheme }), [branding, muiTheme]);
  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeBranding = () => useContext(ThemeContext);


