import axios from "axios";

// Detecta se está rodando em browser e em qual host
const isBrowser = typeof window !== "undefined";
const host = isBrowser ? window.location.host : "";
const isProdHost = /app\.trmultichat\.com\.br$/i.test(host);

// Ordem de prioridade para baseURL:
// 1) Variáveis de ambiente (build-time)
// 2) Host de produção conhecido (app.trmultichat.com.br -> api.trmultichat.com.br)
// 3) Fallback de desenvolvimento (localhost:4004)
const resolvedEnvBase =
  process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE_URL;

const baseURL = resolvedEnvBase
  ? resolvedEnvBase
  : isProdHost
  ? "https://api.trmultichat.com.br"
  : "http://localhost:4004";

axios.defaults.baseURL = baseURL;

const api = axios.create({ baseURL, withCredentials: true });

export const openApi = axios.create({
  baseURL:
    resolvedEnvBase ||
    (isProdHost ? "https://api.trmultichat.com.br" : "http://localhost:4004")
});

export default api;
// attach token for both clients
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${JSON.parse(token) || token}`;
  }
  return config;
});
openApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${JSON.parse(token) || token}`;
  }
  return config;
});

// global 401 handler -> redirect to /login
const onResponseError = (error) => {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { config, response } = error || {};
      // eslint-disable-next-line no-console
      console.warn("[API ERR]", config?.method, config?.url, response?.status, response?.data);
    }
  } catch (_) {}
  if (error?.response?.status === 401) {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("companyId");
      localStorage.removeItem("tenantId");
    } catch (_) {}
    if (typeof window !== "undefined") window.location.href = "/login";
    return Promise.resolve({});
  }
  return Promise.reject(error);
};

api.interceptors.response.use((r) => r, onResponseError);
openApi.interceptors.response.use((r) => r, onResponseError);
