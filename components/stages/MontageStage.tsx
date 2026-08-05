"use client";

import { useState } from "react";
import { startMontage, pollMontage, MontageJob } from "@/lib/api";
import { useSettings } from "@/components/SettingsProvider";
import { usePersistentState } from "@/lib/usePersistentState";
import { downloadRemote } from "@/lib/download";
import { StageStatus } from "@/lib/stages";

const SUBS_KEY = "pikaluna_studio_subtitles";
const OVERLAY_KEY = "pikaluna_studio_overlay";

interface SubLine {
  start: number;
  end: number;
  text: string;
}
interface OverlayItem {
  kind: string;
  text: string;
  pos: string;
  start: number;
  end: number;
  blink: boolean;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Zgradi Creatomate "Subtitles.elements" iz vrstic s časi (pot B: vsaka
// vrstica svoj tekstovni element s svojim časom).
function buildSubtitleElements(lines: SubLine[], style: any) {
  return lines
    .filter((l) => l.text.trim())
    .map((l) => ({
      type: "text",
      time: l.start,
      duration: Math.max(0.5, l.end - l.start),
      x: "50%",
      y: "50%",
      width: "100%",
      height: "100%",
      x_alignment: "50%",
      y_alignment: "50%",
      text: l.text.trim(),
      font_family: style?.font || "Space Grotesk",
      font_weight: "700",
      font_size: (style?.size ? Math.round(style.size / 6) : 7) + " vmin",
      fill_color: style?.color || "#ffffff",
      background_color: style?.effect === "box" ? "#000000cc" : undefined,
      stroke_color: style?.effect === "outline" ? "#000000" : undefined,
      stroke_width: style?.effect === "outline" ? "0.4 vmin" : undefined,
      animations:
        style?.animation && style.animation !== "none"
          ? [{ type: style.animation === "slide-up" ? "slide" : style.animation, duration: 0.3, time: "start" }]
          : undefined,
    }));
}

export default function MontageStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings } = useSettings();
  const [videoUrl, setVideoUrl] = usePersistentState("montage_video_url", "");
  const [title, setTitle] = usePersistentState("montage_title", "");
  const [badge, setBadge] = usePersistentState("montage_badge", "-65%");
  const [job, setJob] = useState<MontageJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "" | "ok" | "err" }>({
    text: "Vpiši video URL in poženi montažo. Podnapisi in overlay se povlečejo samodejno.",
    kind: "",
  });

  function summary() {
    const subs = readJSON<{ lines: SubLine[]; style: any }>(SUBS_KEY, { lines: [], style: {} });
    const overlay = readJSON<OverlayItem[]>(OVERLAY_KEY, []);
    return { subLines: subs.lines?.length || 0, overlays: overlay.length };
  }

  async function run() {
    if (!videoUrl.trim()) {
      setMsg({ text: "Vpiši javni URL videa (npr. iz stopnje Video).", kind: "err" });
      return;
    }
    setBusy(true);
    setJob(null);
    onStatus("busy");
    setMsg({ text: "Pošiljam v Creatomate …", kind: "" });

    // Sestavi modifications iz zbranih podatkov.
    const subs = readJSON<{ lines: SubLine[]; style: any }>(SUBS_KEY, { lines: [], style: {} });
    const overlay = readJSON<OverlayItem[]>(OVERLAY_KEY, []);
    const firstBadge = overlay.find((o) => o.kind === "badge");

    const modifications: Record<string, unknown> = {
      Video: videoUrl.trim(),
      Title: title.trim() || " ",
      Badge: (firstBadge?.text || badge || "").trim() || " ",
    };
    // Podnapisi (pot B): zamenjaj vsebino kompozicije Subtitles.
    if (subs.lines?.length) {
      modifications["Subtitles.elements"] = buildSubtitleElements(subs.lines, subs.style);
    }

    try {
      const started = await startMontage(modifications, settings.proxyPath);
      setJob(started);
      setMsg({ text: "Render se izvaja … (lahko traja minuto)", kind: "" });
      const final = await pollMontage(started.id, (j) => setJob(j), settings.proxyPath);
      if (final.status === "succeeded") {
        setMsg({ text: "Montaža končana.", kind: "ok" });
        onStatus("done");
      } else {
        setMsg({ text: "Render ni uspel (status: " + final.status + ").", kind: "err" });
        onStatus("empty");
      }
    } catch (err: any) {
      setMsg({ text: err.message || "Montaža ni uspela.", kind: "err" });
      onStatus("empty");
    } finally {
      setBusy(false);
    }
  }

  const s = summary();

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 06</div>
        <h1 className="panel__title">Montaža</h1>
        <p className="panel__blurb">
          Sestavi video, podnapise in overlay v končni oglas (Creatomate). Glas dodamo v naslednjem
          koraku.
        </p>
      </header>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Video URL (javni)</label>
        <input
          className="input"
          placeholder="https://… (npr. renderiran video iz stopnje Video)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Naslov (Title)</label>
        <input
          className="input"
          placeholder="naslov čez video"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Badge (če ni iz Overlay)</label>
        <input
          className="input"
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="vstatus" style={{ maxWidth: 720 }}>
        Povlečeno samodejno: <b>{s.subLines}</b> vrstic podnapisov, <b>{s.overlays}</b> overlay
        elementov.
      </div>

      <div className="btnrow">
        <button className="btn btn--sol" onClick={run} disabled={busy}>
          {busy ? "Montiram …" : "Poženi montažo"}
        </button>
        {job && (
          <span
            className={`pill${
              job.status === "succeeded" ? " pill--done" : job.status === "failed" ? " pill--err" : " pill--busy"
            }`}
          >
            {job.status}
          </span>
        )}
      </div>

      <div className={`vstatus${msg.kind ? ` vstatus--${msg.kind}` : ""}`} style={{ maxWidth: 720 }}>
        {msg.text}
      </div>

      {job?.url && job.status === "succeeded" && (
        <div className="card" style={{ maxWidth: 720, marginTop: 12 }}>
          <div className="card__title">Končni video</div>
          <video controls src={job.url} style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div className="btnrow" style={{ marginTop: 10 }}>
            <button className="btn btn--ghost" onClick={() => downloadRemote(job.url!, "montaza.mp4")}>
              Prenesi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
