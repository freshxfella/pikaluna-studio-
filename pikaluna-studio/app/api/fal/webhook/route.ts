import { NextResponse } from "next/server";
import { getJob, resolveRequest, rollupStatus, saveJob } from "@/lib/jobs";
import { readFalHeaders, verifyFalWebhook } from "@/lib/fal-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FalPayload {
  request_id: string;
  status: "OK" | "ERROR";
  error?: string;
  payload?: { video?: { url: string } };
}

export async function POST(req: Request) {
  // Read RAW body first — signature is computed over exact bytes.
  const raw = await req.text();
  const headers = readFalHeaders(req.headers);

  if (!(await verifyFalWebhook(headers, raw))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const data = JSON.parse(raw) as FalPayload;

  const ref = await resolveRequest(data.request_id);
  if (!ref) return NextResponse.json({ ok: true }); // unknown/expired → ack

  const job = await getJob(ref.jobId);
  if (!job) return NextResponse.json({ ok: true });

  const scene = job.scenes[ref.sceneIndex];
  if (!scene || scene.status !== "pending") {
    return NextResponse.json({ ok: true }); // idempotent: already handled
  }

  if (data.status === "OK" && data.payload?.video?.url) {
    scene.status = "done";
    scene.videoUrl = data.payload.video.url;
  } else {
    scene.status = "error";
    scene.error = data.error ?? "generation failed";
  }

  job.status = rollupStatus(job);
  await saveJob(job);

  // Respond fast (fal's initial timeout is 15s).
  return NextResponse.json({ ok: true });
}
