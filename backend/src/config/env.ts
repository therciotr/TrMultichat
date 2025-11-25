import dotenv from "dotenv";

dotenv.config();

type Env = {
  NODE_ENV: string;
  PORT: number;
  DEV_MODE?: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  MULTI_TENANT: boolean;
  DEFAULT_PLAN_MAX_USERS?: number;
  DEFAULT_PLAN_MAX_WHATS?: number;
  API_BASE_URL?: string;
  APP_BASE_URL?: string;
  ALLOW_ORIGIN?: string;
  VERSION?: string;
};

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return n;
}

const env: Env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toNumber(process.env.PORT, 4004),
  DEV_MODE: process.env.DEV_MODE,
  JWT_SECRET: required("JWT_SECRET", process.env.JWT_SECRET),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", process.env.JWT_REFRESH_SECRET),
  POSTGRES_HOST: process.env.POSTGRES_HOST || "localhost",
  POSTGRES_PORT: toNumber(process.env.POSTGRES_PORT, 5432),
  POSTGRES_DB: process.env.POSTGRES_DB || "trmultichat",
  POSTGRES_USER: process.env.POSTGRES_USER || "postgres",
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "postgres",
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: toNumber(process.env.REDIS_PORT, 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  MULTI_TENANT: String(process.env.MULTI_TENANT || "true").toLowerCase() === "true",
  DEFAULT_PLAN_MAX_USERS: process.env.DEFAULT_PLAN_MAX_USERS ? Number(process.env.DEFAULT_PLAN_MAX_USERS) : undefined,
  DEFAULT_PLAN_MAX_WHATS: process.env.DEFAULT_PLAN_MAX_WHATS ? Number(process.env.DEFAULT_PLAN_MAX_WHATS) : undefined,
  API_BASE_URL: process.env.API_BASE_URL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  ALLOW_ORIGIN: process.env.ALLOW_ORIGIN,
  VERSION: process.env.VERSION || "1.0.0"
};

export default env;



