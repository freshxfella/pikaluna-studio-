"use client";

import { useState } from "react";
import { transcribeAudio, TranscriptSegment } from "@/lib/api";
import { useSettings } from "@/components/SettingsProvider";
import { usePersistentState } from "@/lib/usePersistentState";
import { buildSrt, downloadText } from "@/lib/download";
import StageActions from "@/components/StageActions";
import { StageStatus } from "@/lib/stages";
import { VOICE_AUDIO_KEY, VOICE_SPOKEN_TEXT_KEY } from "@/components/stages/VoiceStage";

// Podnapisi se shranijo; Montaža jih pošlje Creatomatu (tekst + časi + slog).
export const SUBS_KEY = "pikaluna_studio_subtitles";

// Nabori za začetek. Vsaka izbira mora obstajati tudi v Creatomate predlogi,
// sicer render ne uveljavi sloga.
const FONTS = ["Space Grotesk", "IBM Plex Sans", "Inter", "Montserrat", "Poppins", "Oswald"];
const EFFECTS = [
  { id: "none", label: "brez" },
  { id: "box", label: "obarvana podlaga" },
  { id: "outline", label: "obroba" },
  { id: "shadow", label: "senca" },
];
const ANIMATIONS = [
  { id: "none", label: "brez" },
  { id: "fade", label: "zatemnitev (fade)" },
  { id: "slide-up", label: "zdrs navzgor" },
  { id: "pop", label: "pop (skok)" },
  { id: "typewriter", label: "pisalni stroj" },
];
const POSITIONS = [
  { id: "bottom", label: "spodaj" },
  { id: "center", label: "sredina" },
  { id: "top", label: "zgoraj" },
];

interface SubLine {
  start: number;
  end: number;
  text: string;
}

interface SubStyle {
  font: string;
  size: number;
  effect: string;
  animation: string;
  position: string;
  color: string;
}

const DEFAULT_STYLE: SubStyle = {
  font: "Space Grotesk",
  size: 42,
  effect: "box",
  animation: "fade",
  position: "bottom",
  color: "#ffffff",
};

function fmt(t: number): string {
  const s = Math.max(0, t);
  const mm = Math.floor(s / 60);
  const ss = (s % 60).toFixed(1).padStart(4, "0");
  return `${mm}:${ss}`;
}

export default function SubtitleStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings } = useSettings();
  const [lines, setLines] = usePersistentState<SubLine[]>("subs_lines", []);
  const [style, setStyle] = usePersistentState<SubStyle>("subs_style", DEFAULT_STYLE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "" | "ok" | "err" }>({
    text: "Najprej ustvari govor v Glasu, nato transkribiraj.",
    kind: "",
  });

  const setLine = (i: number, patch: Partial<SubLine>) =>
    setLines((l) => l.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addLine = () =>
    setLines((l) => [...l, { start: l.length ? l[l.length - 1].end : 0, end: 0, text: "" }]);
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
  const patchStyle = (p: Partial<SubStyle>) => setStyle((s) => ({ ...s, ...p }));

  // Izmeri dolžino avdia (data-URL) in vrne sekunde.
  function audioDuration(src: string): Promise<number> {
    return new Promise((resolve) => {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(a.duration || 0);
      a.onerror = () => resolve(0);
      a.src = src;
    });
  }

  // Razdeli besedilo na kratke vrstice (po stavkih; dolge razbije po dolžini).
  function splitIntoLines(text: string): string[] {
    const clean = text.replace(/\s+/g, " ").trim();
    const rough = clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
    const out: string[] = [];
    for (const part of rough) {
      if (part.length <= 42) {
        out.push(part);
      } else {
        const words = part.split(" ");
        let cur = "";
        for (const w of words) {
          if ((cur + " " + w).trim().length > 42) {
            if (cur) out.push(cur.trim());
            cur = w;
          } else {
            cur = (cur + " " + w).trim();
          }
        }
        if (cur) out.push(cur.trim());
      }
    }
    return out.length ? out : [clean];
  }

  // Podnapisi iz ZNANEGA besedila (iz Glasu), razporejeni po dolžini glasu.
  async function fromSpokenText() {
    let spoken = "";
    let audio = "";
    try {
      spoken = localStorage.getItem(VOICE_SPOKEN_TEXT_KEY) || "";
      audio = localStorage.getItem(VOICE_AUDIO_KEY) || "";
    } catch {}
    if (!spoken.trim()) {
      setMsg({
        text: "V Glasu še ni besedila za govor. Najprej ustvari govor v zavihku Glas.",
        kind: "err",
      });
      return;
    }
    setBusy(true);
    setMsg({ text: "Razporejam besedilo po dolžini glasu …", kind: "" });
    onStatus("busy");
    try {
      const total = audio ? await audioDuration(audio) : 0;
      const parts = splitIntoLines(spoken);
      const weights = parts.map((p) => Math.max(1, p.length));
      const sum = weights.reduce((a, b) => a + b, 0);
      const duration = total > 0 ? total : sum / 15;

      let t = 0;
      const newLines: SubLine[] = parts.map((p, i) => {
        const dur = (weights[i] / sum) * duration;
        const line = { start: Number(t.toFixed(2)), end: Number((t + dur).toFixed(2)), text: p };
        t += dur;
        return line;
      });
      setLines(newLines);
      setMsg({
        text: `${newLines.length} vrstic razporejenih čez ${duration.toFixed(1)} s. Uredi po potrebi.`,
        kind: "ok",
      });
      onStatus("done");
    } catch (err: any) {
      setMsg({ text: err.message || "Razporeditev ni uspela.", kind: "err" });
      onStatus("empty");
    } finally {
      setBusy(false);
    }
  }

  async function transcribe() {
    let audio = "";
    try {
      audio = localStorage.getItem(VOICE_AUDIO_KEY) || "";
    } catch {}
    if (!audio) {
      setMsg({ text: "V Glasu še ni generiranega govora. Najprej ustvari govor.", kind: "err" });
      return;
    }
    setBusy(true);
    setMsg({ text: "Transkribiram govor …", kind: "" });
    onStatus("busy");
    try {
      // Tvoje kode (SI/CZ/HU/SK/EN) niso Whisper jezikovne kode.
      // SI je koda DRŽAVE; jezik slovenščine je "sl". Preslikamo pravilno.
      // Če jezika ni v preslikavi, ga ne pošljemo — Whisper sam zazna jezik.
      const WHISPER_LANG: Record<string, string> = {
        SI: "sl",
        CZ: "cs",
        HU: "hu",
        SK: "sk",
        EN: "en",
      };
      const code = settings.languages[0];
      const lang = code ? WHISPER_LANG[code] : undefined;
      const segs: TranscriptSegment[] = await transcribeAudio(audio, settings.proxyPath, lang);
      if (!segs.length) {
        setMsg({ text: "Transkripcija ni vrnila segmentov.", kind: "err" });
        onStatus("empty");
        return;
      }
      setLines(segs.map((s) => ({ start: s.start, end: s.end, text: s.text })));
      setMsg({ text: `Naloženih ${segs.length} vrstic. Uredi po potrebi.`, kind: "ok" });
      onStatus("done");
    } catch (err: any) {
      setMsg({ text: err.message || "Transkripcija ni uspela.", kind: "err" });
      onStatus("empty");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const clean = lines.filter((l) => l.text.trim());
    try {
      localStorage.setItem(SUBS_KEY, JSON.stringify({ lines: clean, style }));
      setMsg({ text: "Podnapisi shranjeni za Montažo.", kind: "ok" });
      onStatus(clean.length ? "done" : "empty");
    } catch {}
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 07</div>
        <h1 className="panel__title">Podnapisi</h1>
        <p className="panel__blurb">
          Iz besedila za govor (iz Glasu), razporejenega po dolžini glasu. Lahko tudi transkribiraš z Whisper. Uredi vrstice in
          slog (font, efekt, animacija). Render izvede Montaža.
        </p>
      </header>

      <div className="btnrow">
        <button className="btn btn--sol" onClick={fromSpokenText} disabled={busy}>
          {busy ? "Razporejam …" : "Iz besedila (Glas)"}
        </button>
        <button className="btn btn--ghost" onClick={transcribe} disabled={busy}>
          Transkribiraj (Whisper)
        </button>
        <button className="btn btn--ghost" onClick={addLine} disabled={busy}>
          + vrstica
        </button>
        <button className="btn btn--ghost" onClick={save} disabled={busy}>
          Shrani za Montažo
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => downloadText(buildSrt(lines), "podnapisi.srt")}
          disabled={busy || lines.length === 0}
        >
          Prenesi .srt
        </button>
      </div>

      <StageActions
        busy={busy}
        onRepeat={transcribe}
        onRefresh={transcribe}
        onClear={() => {
          setLines([]);
          try {
            localStorage.removeItem(SUBS_KEY);
          } catch {}
          onStatus("empty");
        }}
      />

      <div className={`vstatus${msg.kind ? ` vstatus--${msg.kind}` : ""}`} style={{ maxWidth: 920 }}>
        {msg.text}
      </div>

      {/* Slog podnapisov */}
      <div className="card" style={{ maxWidth: 920, marginTop: 8 }}>
        <div className="card__title">Slog</div>
        <div className="style-grid">
          <label className="mini-field">
            <span>Font</span>
            <select className="select" value={style.font} onChange={(e) => patchStyle({ font: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>Velikost</span>
            <input
              className="input input--mini"
              type="number"
              min={12}
              value={style.size}
              onChange={(e) => patchStyle({ size: Number(e.target.value) })}
            />
          </label>
          <label className="mini-field">
            <span>Efekt</span>
            <select className="select" value={style.effect} onChange={(e) => patchStyle({ effect: e.target.value })}>
              {EFFECTS.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>Animacija</span>
            <select className="select" value={style.animation} onChange={(e) => patchStyle({ animation: e.target.value })}>
              {ANIMATIONS.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>Položaj</span>
            <select className="select" value={style.position} onChange={(e) => patchStyle({ position: e.target.value })}>
              {POSITIONS.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>Barva</span>
            <input
              className="input input--mini"
              type="color"
              value={style.color}
              onChange={(e) => patchStyle({ color: e.target.value })}
            />
          </label>
        </div>
      </div>

      {/* Vrstice podnapisov */}
      <div className="subs-list">
        {lines.length === 0 && (
          <div className="vstatus" style={{ maxWidth: 920 }}>
            Ni vrstic. Klikni “Iz besedila (Glas)” ali dodaj vrstico ročno.
          </div>
        )}
        {lines.map((l, i) => (
          <div className="sub-row" key={i}>
            <label className="mini-field">
              <span>od</span>
              <input
                className="input input--mini"
                type="number"
                step="0.1"
                min={0}
                value={l.start}
                onChange={(e) => setLine(i, { start: Number(e.target.value) })}
              />
            </label>
            <label className="mini-field">
              <span>do</span>
              <input
                className="input input--mini"
                type="number"
                step="0.1"
                min={0}
                value={l.end}
                onChange={(e) => setLine(i, { end: Number(e.target.value) })}
              />
            </label>
            <input
              className="input"
              style={{ flex: 1, minWidth: 200 }}
              value={l.text}
              onChange={(e) => setLine(i, { text: e.target.value })}
              placeholder="besedilo podnapisa"
            />
            <span className="sub-row__time">{fmt(l.start)}–{fmt(l.end)}</span>
            <button className="btn btn--ghost" onClick={() => removeLine(i)}>×</button>
          </div>
        ))}
      </div>

      <div className="vstatus" style={{ maxWidth: 920, marginTop: 14 }}>
        Ko je Montaža priklopljena (Creatomate), se te vrstice in slog pošljejo kot spremenljivke v
        predlogo in vžgejo v video. Zaenkrat se shranijo in čakajo na Montažo.
      </div>
    </section>
  );
}
