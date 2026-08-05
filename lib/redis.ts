import { Redis } from "@upstash/redis";

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env.
// On Vercel KV these are provided automatically when you attach a KV store.
export const redis = Redis.fromEnv();
