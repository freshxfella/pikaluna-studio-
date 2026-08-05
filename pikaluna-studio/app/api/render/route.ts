import { NextResponse } from "next/server";
import { fal, KLING_MODEL, WEBHOOK_URL } from "@/lib/fal";
import { createJob, mapRequest, saveJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RenderBody {
  scenes: { prompt: string; imageUrl: string }[];
  duration?: "5" | "10";
}

export async function POST(req: Request) {
  const { scenes, duration = "5" } = (await req.json()) as RenderBody;

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json({ error: "scenes required" }, { status: 400 });
  }

  const job = await createJob(scenes);

  // Enqueue each scene. submit() just returns a request_id immediately —
  // this loop is fast and safe inside a Vercel function.
  await Promise.all(
    job.scenes.map(async (scene) => {
      const { request_id } = await fal.queue.submit(KLING_MODEL, {
        input: {
          prompt: scene.prompt,
          start_image_url: scene.imageUrl, // v2.6/v3 param name
          duration,
        },
        // Route hint in query; source of truth is the request_id map below.
        webhookUrl: `${WEBHOOK_URL}?job=${job.id}&scene=${scene.index}`,
      });
      scene.falRequestId = request_id;
      await mapRequest(request_id, { jobId: job.id, sceneIndex: scene.index });
    })
  );

  await saveJob(job);
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
