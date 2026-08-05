// Single client-side gateway. All external services go through /api/proxy
// (Pikaluna pattern) so keys never touch the browser; the video pipeline uses
// its own async routes (/api/render).

const DEFAULT_PROXY = "/api/proxy";

export async function callProxy<T = any>(
  service: string,
  payload: unknown,
  proxyPath: string = DEFAULT_PROXY
): Promise<T> {
  const res = await fetch(proxyPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service, payload }),
  });
  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || `Napaka storitve (${res.status}).`);
  }
  return data as T;
}

/* ---------- async video pipeline (Kling via fal) ---------- */

export interface RenderScene {
  index: number;
  status: "pending" | "done" | "error";
  videoUrl?: string;
  error?: string;
}
export interface RenderJob {
  status: "processing" | "completed" | "failed";
  scenes: RenderScene[];
}

export async function startRender(
  scenes: { prompt: string; imageUrl: string }[],
  duration: "5" | "10" = "5"
): Promise<string> {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenes, duration }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Zagon renderja ni uspel.");
  return data.jobId as string;
}

export async function getRender(jobId: string): Promise<RenderJob> {
  const res = await fetch(`/api/render/${jobId}`);
  if (!res.ok) throw new Error("Joba ni mogoče najti.");
  return (await res.json()) as RenderJob;
}

// Poll until finished; calls onUpdate on every tick.
export async function pollRender(
  jobId: string,
  onUpdate: (job: RenderJob) => void,
  intervalMs = 4000
): Promise<RenderJob> {
  while (true) {
    const job = await getRender(jobId);
    onUpdate(job);
    if (job.status !== "processing") return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
