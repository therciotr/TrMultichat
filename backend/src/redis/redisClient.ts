import env from "../config/env";

// ioredis is a transitive dependency via bull; require at runtime to avoid typing issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IORedis = require("ioredis");

const redisUrl = `redis://${env.REDIS_PASSWORD ? `:${encodeURIComponent(env.REDIS_PASSWORD)}@` : ""}${env.REDIS_HOST}:${env.REDIS_PORT}`;

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

export default redis as typeof IORedis;



