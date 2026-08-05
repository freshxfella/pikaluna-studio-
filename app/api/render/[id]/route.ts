import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    status: job.status,
    scenes: job.scenes.map((s) => ({
      index: s.index,
      status: s.status,
      videoUrl: s.videoUrl,
      error: s.error,
    })),
  });
}
