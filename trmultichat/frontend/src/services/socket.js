import openSocket from "socket.io-client";
import { isObject } from "lodash";
import api from "./api";

export function socketConnection(params) {
  try {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    // Evitar tentar conectar antes do login
    if (!token) {
      return {
        on: () => {},
        emit: () => {},
        disconnect: () => {},
      };
    }
    let userId = null;
    if (localStorage.getItem("userId")) {
      userId = localStorage.getItem("userId");
    }
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      (api && api.defaults && api.defaults.baseURL) ||
      "http://localhost:4004";
    return openSocket(backendUrl, {
      transports: ["websocket", "polling", "flashsocket"],
      pingTimeout: 18000,
      pingInterval: 18000,
      query: isObject(params) ? { ...params} : { userId: params?.userId || userId },
    });
  } catch (_) {
    return { on: () => {}, emit: () => {}, disconnect: () => {} };
  }
}
