import env from "../config/env";

// ioredis is a transitive dependency via bull; require at runtime to avoid typing issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IORedis = require("ioredis");

const redisUrl = `redis://${
  env.REDIS_PASSWORD ? `:${encodeURIComponent(env.REDIS_PASSWORD)}@` : ""
}${env.REDIS_HOST}:${env.REDIS_PORT}`;

const redis = new IORedis(redisUrl, {
  // Don't crash the app if Redis is down; keep retrying in the background.
  // Also prevents "Unhandled error event" when connection is refused.
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    // exponential-ish backoff capped
    const delay = Math.min(times * 500, 5000);
    return delay;
  }
});

// Prevent unhandled error event (e.g. ECONNREFUSED 127.0.0.1:6379)
redis.on("error", (err: any) => {
  // eslint-disable-next-line no-console
  console.warn("[redis] error:", err?.message || err);
});
redis.on("connect", () => {
  // eslint-disable-next-line no-console
  console.log("[redis] connected");
});
redis.on("ready", () => {
  // eslint-disable-next-line no-console
  console.log("[redis] ready");
});

export default redis as typeof IORedis;
