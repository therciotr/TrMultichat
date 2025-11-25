import api from "./api";
import { safeArray } from "../utils/safe";

export async function fetchTickets(params = {}) {
  try {
    const { data } = await api.get("/tickets", { params });
    return safeArray(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[tickets] GET /tickets falhou:", err?.response?.status, err?.response?.data);
    try {
      const { data } = await api.get("/public/tickets", { params });
      return safeArray(data);
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.warn("[tickets] fallback /public/tickets falhou:", e2?.response?.status, e2?.response?.data);
      return [];
    }
  }
}


