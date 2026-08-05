// app/api/proxy/route.ts
// Pikaluna's api/proxy.js ported into VideoAd's Next.js App Router.
// SAME CONTRACT as before: POST { service, payload } -> same responses & messages.
// This keeps the single-proxy pattern so Pikaluna's existing index.html works
// UNCHANGED when served from the merged app (it still POSTs to /api/proxy).

export const runtime = "nodejs"; // uses Buffer / FormData / Blob
export const dynamic = "force-dynamic";

// Bridge env names: Pikaluna used OPENAI_KEY; the OpenAI SDK in VideoAd expects
// OPENAI_API_KEY. Read either so neither app breaks during the merge.
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? "";
const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY ?? "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY ?? "";

// Preserves Pikaluna's documented smoke test:
// open /api/proxy in a browser -> {"error":{"message":"Uporabi metodo POST."}}
export async function GET() {
  return json({ error: { message: "Uporabi metodo POST." } }, 405);
}

export async function POST(request: Request) {
  let telo: any;
  try {
    telo = await request.json();
  } catch {
    return json({ error: { message: "Vsebina zahteve ni veljaven JSON." } }, 400);
  }

  const { service, payload } = telo || {};
  if (!service || !payload) {
    return json({ error: { message: 'Manjka "service" ali "payload".' } }, 400);
  }

  try {
    switch (service) {
      /* ---------- OPENAI / CHATGPT ---------- */
      case "openai": {
        if (!OPENAI_KEY) return manjkaKljuc("OpenAI");
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + OPENAI_KEY,
          },
          body: JSON.stringify(payload),
        });
        return posljiNaprej(r);
      }

      /* ---------- OPENAI: slike (gpt-image-1) ----------
         Vsak prizor je svoja slika. payload = telo za /v1/images/generations
         (model, prompt, size, n). Vrne base64 slike; frontend jo prikaže in
         prelije v stopnjo Video kot data-URL. */
      case "openai_image": {
        if (!OPENAI_KEY) return manjkaKljuc("OpenAI");
        const r = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + OPENAI_KEY,
          },
          body: JSON.stringify({
            model: payload.model || "gpt-image-1",
            prompt: payload.prompt || "",
            size: payload.size || "1024x1536",
            n: 1,
          }),
        });
        if (!r.ok) return posljiNaprej(r);
        const data: any = await r.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) {
          return json(
            { error: { message: "Slika ni bila ustvarjena (prazen odgovor)." } },
            502
          );
        }
        return json({ image_base64: b64 }, 200);
      }

      /* ---------- ANTHROPIC / CLAUDE (rezerva) ---------- */
      case "anthropic": {
        if (!ANTHROPIC_KEY) return manjkaKljuc("Anthropic");
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(payload),
        });
        return posljiNaprej(r);
      }

      /* ---------- ELEVENLABS: govor ---------- */
      case "elevenlabs": {
        if (!ELEVENLABS_KEY) return manjkaKljuc("ElevenLabs");
        const voiceId = payload.voice_id || "21m00Tcm4TlvDq8ikWAM";
        const r = await fetch(
          "https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": ELEVENLABS_KEY,
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: payload.text || "",
              model_id: payload.model_id || "eleven_multilingual_v2",
              voice_settings: payload.voice_settings || undefined,
            }),
          }
        );
        if (!r.ok) return posljiNaprej(r);
        const bafer = Buffer.from(await r.arrayBuffer());
        return json({ audio_base64: bafer.toString("base64") }, 200);
      }

      /* ---------- ELEVENLABS: seznam glasov na racunu ---------- */
      case "elevenlabs_voices": {
        if (!ELEVENLABS_KEY) return manjkaKljuc("ElevenLabs");
        const r = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": ELEVENLABS_KEY },
        });
        return posljiNaprej(r);
      }

      /* ---------- ELEVENLABS: kloniranje glasu iz posnetka ---------- */
      case "elevenlabs_clone": {
        if (!ELEVENLABS_KEY) return manjkaKljuc("ElevenLabs");
        const { name, audio_base64, mime } = payload;
        if (!audio_base64) {
          return json({ error: { message: "Manjka posnetek glasu." } }, 400);
        }
        const zvok = Buffer.from(audio_base64, "base64");
        if (zvok.length < 1000) {
          return json(
            {
              error: {
                message:
                  "Posnetek je neveljaven ali prekratek. Posnemi vsaj deset sekund govora.",
              },
            },
            400
          );
        }
        const pripona = priponaZaMime(mime);
        const oblika = new FormData();
        oblika.append("name", name || "Moj glas");
        oblika.append("remove_background_noise", "true");
        oblika.append(
          "files",
          new Blob([zvok], { type: mime || "audio/webm" }),
          "glas." + pripona
        );

        let r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_KEY },
          body: oblika,
        });
        if (r.status === 404) {
          r = await fetch("https://api.elevenlabs.io/v1/voices/ivc/create", {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_KEY },
            body: oblika,
          });
        }
        return posljiNaprej(r);
      }

      /* ---------- VIDEO probe ----------
         Ostaja 501 kot prej. V fazi 3 to lahko preusmeriš na fal/Kling
         cevovod (/api/render) namesto branja formatov na strežniku. */
      case "video_probe": {
        return json(
          {
            error: {
              message:
                "Tega formata brskalnik ne zna odpreti. To gostovanje (Vercel) ne podpira " +
                "branja videa na strežniku, ker nima dostopa do orodja FFmpeg. Video pretvori " +
                "v MP4 ali WebM (npr. s CloudConvert ali HandBrake) in ga naloži znova.",
            },
          },
          501
        );
      }

      default:
        return json({ error: { message: "Neznana storitev: " + service } }, 400);
    }
  } catch (err: any) {
    return json({ error: { message: "Napaka pri klicu storitve: " + err.message } }, 502);
  }
}

/* ================= POMOŽNE FUNKCIJE ================= */

function json(objekt: unknown, koda = 200) {
  return new Response(JSON.stringify(objekt), {
    status: koda,
    headers: { "Content-Type": "application/json" },
  });
}

function manjkaKljuc(ime: string) {
  return json(
    {
      error: {
        message:
          ime +
          " ključ ni nastavljen. Dodaj ga v nadzorni plošči Vercela pod " +
          "Project → Settings → Environment Variables in ponovno objavi (Redeploy).",
      },
    },
    500
  );
}

async function posljiNaprej(r: Response) {
  const besedilo = await r.text();
  return new Response(besedilo, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
  });
}

function priponaZaMime(mime?: string) {
  const m = String(mime || "");
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  return "webm";
}
