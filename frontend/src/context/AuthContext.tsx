/* eslint-disable react-hooks/rules-of-hooks */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
// Bridge com o contexto JS legado para evitar erro quando usado fora do TS Provider
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JsAuth = require("./Auth/AuthContext");
// Contexto fallback estável para evitar criar hooks condicionais
export const FallbackAuthContext: React.Context<any> = React.createContext<any>(undefined);
const JsAuthContext = (JsAuth && (JsAuth.AuthContext || JsAuth.default)) || FallbackAuthContext;

type User = { id: number; name: string; email: string; tenantId: number } | null;

type AuthContextType = {
  user: User;
  accessToken: string | null;
  tenantId: number | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem("accessToken"));
  const [tenantId, setTenantId] = useState<number | null>(localStorage.getItem("tenantId") ? Number(localStorage.getItem("tenantId")) : null);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    const { accessToken: at, refreshToken: rt, user: u } = data || {};
    localStorage.setItem("accessToken", at);
    localStorage.setItem("refreshToken", rt);
    localStorage.setItem("tenantId", String(u.tenantId));
    setAccessToken(at);
    setTenantId(u.tenantId);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("tenantId");
    setAccessToken(null);
    setTenantId(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    // no-op: could implement token refresh here
  }, []);

  const value = useMemo(() => ({ user, accessToken, tenantId, login, logout }), [user, accessToken, tenantId, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  // Sempre chamar hooks na mesma ordem
  const tsCtx = useContext(AuthContext);
  const jsCtx = useContext(JsAuthContext as React.Context<any>);

  if (tsCtx) return tsCtx;

  if (jsCtx) {
    const accessToken = localStorage.getItem("token") || localStorage.getItem("accessToken");
    const tenantIdStr = localStorage.getItem("companyId") || localStorage.getItem("tenantId");
    return {
      user: jsCtx.user || null,
      accessToken: accessToken || null,
      tenantId: tenantIdStr ? Number(tenantIdStr) : null,
      login: async (email: string, password: string) => jsCtx.handleLogin({ email, password }),
      logout: () => jsCtx.handleLogout()
    } as AuthContextType;
  }

  return {
    user: null,
    accessToken: null,
    tenantId: null,
    login: async () => {},
    logout: () => {}
  } as AuthContextType;
}



