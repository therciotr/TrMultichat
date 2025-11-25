import axios from "axios";

const baseURL = process.env.REACT_APP_API_BASE_URL || "http://localhost:4004";
axios.defaults.baseURL = baseURL;

export const api = axios.create({ baseURL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    try {
      if (process.env.NODE_ENV !== "production") {
        const { config, response } = err || {};
        // eslint-disable-next-line no-console
        console.warn("[API ERR]", config?.method, config?.url, response?.status, response?.data);
      }
    } catch (_) {}
    if (err?.response?.status === 401) {
      try {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      } catch (_) {}
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.resolve({});
    }
    return Promise.reject(err);
  }
);

export default api;



