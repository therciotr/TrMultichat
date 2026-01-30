import React, { useState, useEffect } from "react";

import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";

import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";

import Routes from "./routes";

const queryClient = new QueryClient();

const App = () => {
    const [locale, setLocale] = useState();

    const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
    const preferredTheme = window.localStorage.getItem("preferredTheme");
    const [mode, setMode] = useState(preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light");

    const toggleColorMode = React.useMemo(() => {
        return () => setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
    }, []);

    const isDark = mode === "dark";

    const theme = createTheme(
        {
            scrollbarStyles: {
                "&::-webkit-scrollbar": {
                    width: '8px',
                    height: '8px',
                },
                "&::-webkit-scrollbar-thumb": {
                    boxShadow: 'inset 0 0 6px rgba(0, 0, 0, 0.3)',
                    backgroundColor: "#e8e8e8",
                },
            },
            scrollbarStylesSoft: {
                "&::-webkit-scrollbar": {
                    width: "8px",
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: isDark ? "rgba(148,163,184,0.28)" : "rgba(15,23,42,0.18)",
                },
            },
            palette: {
                type: mode,
                // Usa tokens do Branding via CSS vars (sem perder modo)
                primary: { main: "var(--tr-primary)" },
                secondary: { main: "var(--tr-secondary)" },
                background: {
                    default: isDark ? "#0B1220" : "#F6F8FC",
                    paper: isDark ? "#0F172A" : "#FFFFFF",
                },
                text: {
                    primary: isDark ? "#E5E7EB" : "#0F172A",
                    secondary: isDark ? "#94A3B8" : "#475569",
                },
                divider: isDark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.12)",

                // Campos/keys usados no projeto (mantém compatibilidade)
                textPrimary: isDark ? "#E5E7EB" : "var(--tr-primary)",
                borderPrimary: isDark ? "rgba(148,163,184,0.30)" : "rgba(15,23,42,0.18)",
                dark: { main: isDark ? "#E5E7EB" : "#0F172A" },
                light: { main: isDark ? "#0F172A" : "#FFFFFF" },
                tabHeaderBackground: isDark ? "rgba(15,23,42,0.90)" : "rgba(15,23,42,0.04)",
                optionsBackground: isDark ? "rgba(15,23,42,0.90)" : "rgba(15,23,42,0.04)",
				options: isDark ? "rgba(15,23,42,0.90)" : "rgba(15,23,42,0.04)",
				fontecor: isDark ? "#E5E7EB" : "#0F172A",
                fancyBackground: isDark ? "#0B1220" : "#F6F8FC",
				bordabox: isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.10)",
				newmessagebox: isDark ? "rgba(15,23,42,0.92)" : "#FFFFFF",
				inputdigita: isDark ? "rgba(15,23,42,0.92)" : "#FFFFFF",
				contactdrawer: isDark ? "rgba(15,23,42,0.92)" : "#FFFFFF",
				announcements: isDark ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.03)",
				login: isDark ? "#0B1220" : "#FFFFFF",
				announcementspopover: isDark ? "rgba(15,23,42,0.92)" : "#FFFFFF",
				chatlist: isDark ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.03)",
				boxlist: isDark ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.03)",
				boxchatlist: isDark ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.03)",
                total: isDark ? "rgba(15,23,42,0.92)" : "#FFFFFF",
                messageIcons: isDark ? "rgba(226,232,240,0.90)" : "rgba(100,116,139,0.9)",
                inputBackground: isDark ? "rgba(15,23,42,0.92)" : "#FFFFFF",
                barraSuperior: isDark ? "linear-gradient(to right, rgba(15,23,42,0.92), rgba(15,23,42,0.86))" : "linear-gradient(to right, var(--tr-primary), #0ea5e9, var(--tr-primary))",
				boxticket: isDark ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.03)",
				campaigntab: isDark ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.03)",
            },
            mode,
        },
        locale
    );

    useEffect(() => {
        const i18nlocale = localStorage.getItem("i18nextLng");
        const browserLocale =
            i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

        if (browserLocale === "ptBR") {
            setLocale(ptBR);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem("preferredTheme", mode);
    }, [mode]);



    return (
        <ColorModeContext.Provider value={{ toggleColorMode }}>
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={queryClient}>
                    <Routes />
                </QueryClientProvider>
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export default App;
