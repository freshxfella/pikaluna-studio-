import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Sprejme glas kot data-URL (data:audio/mpeg;base64,XXX) ali gol base64,
// ga naloži v Vercel Blob (javno) in vrne javni URL, ki ga Creatomate doseže.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dataUrl: string = body?.dataUrl || "";
    if (!dataUrl) {
      return NextResponse.json({ error: "Manjka zvočni posnetek." }, { status: 400 });
    }

    // razčleni data-URL
    let mime = "audio/mpeg";
    let base64 = dataUrl;
    const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      mime = m[1];
      base64 = m[2];
    }
    const bytes = Buffer.from(base64, "base64");

    const ext = mime.includes("wav") ? "wav" : mime.includes("ogg") ? "ogg" : "mp3";
    const filename = `voiceover/${Date.now()}.${ext}`;

    const blob = await put(filename, bytes, {
      access: "public",
      contentType: mime,
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Nalaganje glasu ni uspelo." },
      { status: 500 }
    );
  }
}
