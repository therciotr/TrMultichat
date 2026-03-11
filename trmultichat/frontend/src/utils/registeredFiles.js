import api from "../services/api";

export const getRegisteredFileUrl = (path) => {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = String(api?.defaults?.baseURL || "").replace(/\/+$/, "");
  return `${base}/uploads/files/${raw.replace(/^\/+/, "")}`;
};

export const listRegisteredFiles = async () => {
  const { data } = await api.get("/files", { params: { pageNumber: 1 } });
  return Array.isArray(data?.files) ? data.files : [];
};

export const getRegisteredFileDetail = async (id) => {
  const { data } = await api.get(`/files/${id}`);
  return data || {};
};

export const pickUsableOptions = (detail) => {
  const options = Array.isArray(detail?.options) ? detail.options : [];
  return options.filter((item) => String(item?.path || "").trim());
};

export const downloadRegisteredOptionAsFile = async (option) => {
  const url = getRegisteredFileUrl(option?.path);
  const response = await api.get(url, { responseType: "blob" });
  const blob = response?.data;
  const filename = String(option?.path || "arquivo").split("/").pop() || "arquivo";
  const mimeType = String(option?.mediaType || blob?.type || "application/octet-stream");
  return new File([blob], filename, { type: mimeType });
};
