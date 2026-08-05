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

/* ---------- besedilo (OpenAI /v1/responses prek proxyja) ---------- */

// Pošlje prompt "možganom" in vrne golo besedilo. Bere text iz /v1/responses
// odgovora (output_text ali sestavljeno iz output blokov).
export async function generateCopy(
  prompt: string,
  model: string,
  proxyPath?: string
): Promise<string> {
  const data = await callProxy<any>(
    "openai",
    { model, input: prompt, max_output_tokens: 1200 },
    proxyPath
  );
  // /v1/responses lahko vrne output_text ali polje output[].content[].text
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts: string[] = [];
  for (const blk of data?.output ?? []) {
    for (const c of blk?.content ?? []) {
      if (typeof c?.text === "string") parts.push(c.text);
    }
  }
  const joined = parts.join("").trim();
  if (!joined) throw new Error("Prazen odgovor pri pisanju besedila.");
  return joined;
}

/* ---------- slike (gpt-image-1 prek proxyja) ---------- */

// Vrne data-URL slike, pripravljen za <img src> in za prelivanje v Video.
export async function generateImage(
  prompt: string,
  proxyPath?: string,
  size: string = "1024x1536"
): Promise<string> {
  const data = await callProxy<{ image_base64?: string }>(
    "openai_image",
    { prompt, size },
    proxyPath
  );
  if (!data.image_base64) throw new Error("Slika ni bila ustvarjena.");
  return `data:image/png;base64,${data.image_base64}`;
}

/* ---------- transkripcija (Whisper prek proxyja) ---------- */

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

// Sprejme data-URL (data:audio/...;base64,XXX) ali gol base64 + mime.
// Vrne segmente s časi za podnapise.
export async function transcribeAudio(
  dataUrlOrB64: string,
  proxyPath?: string,
  language?: string
): Promise<TranscriptSegment[]> {
  let audio_base64 = dataUrlOrB64;
  let mime = "audio/mpeg";
  const m = dataUrlOrB64.match(/^data:([^;]+);base64,(.*)$/);
  if (m) {
    mime = m[1];
    audio_base64 = m[2];
  }
  const data = await callProxy<any>(
    "openai_transcribe",
    { audio_base64, mime, language },
    proxyPath
  );
  const segs = Array.isArray(data?.segments) ? data.segments : [];
  return segs.map((s: any) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || "").trim(),
  }));
}

/* ---------- predlog teksta glede na dolžino videa ---------- */

// Na podlagi trajanja (sekunde) predlaga tekst primerne dolžine.
// Ne "razume" videa — prilagodi obseg besedila času.
export async function suggestCopyForDuration(
  seconds: number,
  context: string,
  model: string,
  proxyPath?: string
): Promise<string> {
  const prompt = [
    `Za video oglas dolžine ${Math.round(seconds)} sekund predlagaj besedilo, ki se časovno prilega.`,
    "Krajši video = manj besed. Vrni 1–4 kratke vrstice, vsako v svoji vrsti, brez oznak.",
    context ? "Kontekst izdelka/koncepta:\n" + context : "",
    "Piši naravno, brez markdowna.",
  ]
    .filter(Boolean)
    .join("\n");
  return generateCopy(prompt, model, proxyPath);
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
