export function safeArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : Array.isArray(v?.tickets) ? (v.tickets as T[]) : [];
}

export function safeObj<T extends object = any>(v: any): T {
  return v && typeof v === "object" ? (v as T) : ({} as T);
}

export function safeNum(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function safeStr(v: any, d = ""): string {
  return typeof v === "string" ? v : d;
}


