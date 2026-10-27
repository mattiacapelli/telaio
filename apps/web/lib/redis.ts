import Redis from "ioredis";

const g = globalThis as unknown as { __telaioRedis?: Redis };

export function getRedis(): Redis {
  g.__telaioRedis ??= new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  }).on("error", () => {});
  return g.__telaioRedis;
}
