import axios from "axios";

const devBase = "http://localhost:4004";
const prodBase = "https://api.trmultichat.com.br";

export const api = axios.create({
  baseURL: __DEV__ ? devBase : prodBase
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;



