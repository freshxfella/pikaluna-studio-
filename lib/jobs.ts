import { redis } from "./redis";

export type SceneStatus = "pending" | "done" | "error";
export type JobStatus = "processing" | "completed" | "failed";

export interface Scene {
  index: number;
  prompt: string;
  imageUrl: string;
  status: SceneStatus;
  falRequestId?: string;
  videoUrl?: string;
  error?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  scenes: Scene[];
  createdAt: number;
}

const TTL_SECONDS = 60 * 60 * 24; // keep jobs 24h

const jobKey = (id: string) => `job:${id}`;
const reqKey = (requestId: string) => `falreq:${requestId}`;

export async function createJob(
  scenes: { prompt: string; imageUrl: string }[]
): Promise<Job> {
  const job: Job = {
    id: crypto.randomUUID(),
    status: "processing",
    createdAt: Date.now(),
    scenes: scenes.map((s, i) => ({ ...s, index: i, status: "pending" })),
  };
  await redis.set(jobKey(job.id), job, { ex: TTL_SECONDS });
  return job;
}

export async function getJob(id: string): Promise<Job | null> {
  return (await redis.get<Job>(jobKey(id))) ?? null;
}

export async function saveJob(job: Job): Promise<void> {
  await redis.set(jobKey(job.id), job, { ex: TTL_SECONDS });
}

// Reverse map so the webhook can find the right job+scene from fal's request_id.
export async function mapRequest(
  requestId: string,
  ref: { jobId: string; sceneIndex: number }
): Promise<void> {
  await redis.set(reqKey(requestId), ref, { ex: TTL_SECONDS });
}

export async function resolveRequest(
  requestId: string
): Promise<{ jobId: string; sceneIndex: number } | null> {
  return (await redis.get<{ jobId: string; sceneIndex: number }>(reqKey(requestId))) ?? null;
}

// Recompute overall status from scenes.
export function rollupStatus(job: Job): JobStatus {
  if (job.scenes.some((s) => s.status === "error")) return "failed";
  if (job.scenes.every((s) => s.status === "done")) return "completed";
  return "processing";
}
