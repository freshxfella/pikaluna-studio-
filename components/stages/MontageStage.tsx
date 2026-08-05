"use client";

import { useState } from "react";
import { startMontage, pollMontage, MontageJob, uploadAudioToBlob } from "@/lib/api";
import { useSettings } from "@/components/SettingsProvider";
import { usePersistentState } from "@/lib/usePersistentState";
import { downloadRemote } from "@/lib/download";
import { styleToCreatomate } from "@/components/StyleControls";
import { StageStatus } from "@/lib/stages";

const VOICE_AUDIO_KEY = "pikaluna_studio_voice_audio";

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

function readOverlay(): { items: OverlayItem[]; style?: any } {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed }; // stara oblika
    return { items: parsed.items || [], style: parsed.style };
  } catch {
    return { items: [] };
  }
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
  const styled = style ? styleToCreatomate(style as any) : {};
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
      ...styled,
    }));
}

export default function MontageStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings } = useSettings();
  const [videoUrl, setVideoUrl] = usePersistentState("montage_video_url", "");
  const [title, setTitle] = usePersistentState("montage_title", "");
  const [badge, setBadge] = usePersistentState("montage_badge", "-65%");
  const [voiceUrl, setVoiceUrl] = usePersistentState("montage_voice_url", "");
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [job, setJob] = useState<MontageJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "" | "ok" | "err" }>({
    text: "Vpiši video URL in poženi montažo. Podnapisi in overlay se povlečejo samodejno.",
    kind: "",
  });

  // Vzame glas iz Glasu (data-URL), ga naloži v Blob, shrani javni URL.
  async function loadVoiceFromStage() {
    let audio = "";
    try {
      audio = localStorage.getItem(VOICE_AUDIO_KEY) || "";
    } catch {}
    if (!audio) {
      setMsg({ text: "V Glasu še ni generiranega govora.", kind: "err" });
      return;
    }
    setUploadingVoice(true);
    setMsg({ text: "Nalagam glas …", kind: "" });
    try {
      const url = await uploadAudioToBlob(audio);
      setVoiceUrl(url);
      setMsg({ text: "Glas naložen in pripravljen za montažo.", kind: "ok" });
    } catch (err: any) {
      setMsg({ text: err.message || "Nalaganje glasu ni uspelo.", kind: "err" });
    } finally {
      setUploadingVoice(false);
    }
  }

  function summary() {
    const subs = readJSON<{ lines: SubLine[]; style: any }>(SUBS_KEY, { lines: [], style: {} });
    const overlay = readOverlay().items;
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
    const overlay = readOverlay().items;
    const firstBadge = overlay.find((o) => o.kind === "badge");

    const modifications: Record<string, unknown> = {
      Video: videoUrl.trim(),
      Title: title.trim() || " ",
      Badge: (firstBadge?.text || badge || "").trim() || " ",
    };
    // Glas (če je naložen v Blob) — vključi kot Voiceover.
    if (voiceUrl.trim()) {
      modifications["Voiceover"] = voiceUrl.trim();
    }
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

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Glas (voiceover)</label>
        <div className="btnrow" style={{ marginBottom: 6 }}>
          <button className="btn btn--ghost" onClick={loadVoiceFromStage} disabled={uploadingVoice || busy}>
            {uploadingVoice ? "Nalagam glas …" : "Naloži glas iz Glasu"}
          </button>
          {voiceUrl && <span className="pill pill--done">glas pripravljen ✓</span>}
        </div>
        <input
          className="input"
          placeholder="ali prilepi javni URL glasu"
          value={voiceUrl}
          onChange={(e) => setVoiceUrl(e.target.value)}
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
