"use client";

import { useEffect, useRef, useState } from "react";
import { callProxy } from "@/lib/api";
import { useSettings } from "@/components/SettingsProvider";
import { StageStatus } from "@/lib/stages";
import StageActions from "@/components/StageActions";
import { VOICE_TEXT_KEY } from "@/components/stages/CopyStage";

// Zadnji generirani govor (data-URL mp3) — Podnapisi ga transkribirajo.
export const VOICE_AUDIO_KEY = "pikaluna_studio_voice_audio";
// Besedilo, ki ga je glas prebral — Podnapisi ga razporedijo po dolžini.
export const VOICE_SPOKEN_TEXT_KEY = "pikaluna_studio_voice_spoken_text";

/* ---- voice tuning prefs (ported from loadVoicePrefs/voiceSettings) ---- */
interface VoicePrefs {
  model: string;
  stab: number; // 0..100
  sim: number; // 0..100
  style: number; // 0..100
  speed: number; // 70..120
}
const VPREF_KEY = "pikaluna_studio_voice";
const DEFAULT_PREFS: VoicePrefs = { model: "eleven_multilingual_v2", stab: 50, sim: 75, style: 0, speed: 100 };

const TTS_MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — priporočeno" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 — hitro in ceneje" },
  { id: "eleven_v3", label: "v3 — največ jezikov" },
];

type Voice = { id: string; name: string; cat: string };

export default function VoiceStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings, update } = useSettings();

  const [prefs, setPrefs] = useState<VoicePrefs>(DEFAULT_PREFS);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selected, setSelected] = useState<string>(settings.voiceId || "");
  const [clonedId, setClonedId] = useState<string>("");

  const [busyVoices, setBusyVoices] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<{ text: string; kind: "" | "ok" | "err" }>({ text: "Pritisni Naloži glasove.", kind: "" });

  const [previewUrl, setPreviewUrl] = useState("");
  const [text, setText] = useState("");
  const [speechUrl, setSpeechUrl] = useState("");
  const [genMsg, setGenMsg] = useState<{ text: string; kind: "" | "ok" | "err" }>({ text: "", kind: "" });
  const [generating, setGenerating] = useState(false);

  // recording
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [cloneMsg, setCloneMsg] = useState<{ text: string; kind: "" | "ok" | "err" }>({ text: "", kind: "" });
  const [cloning, setCloning] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secRef = useRef(0);

  // hydrate prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VPREF_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
    // Prelito besedilo iz stopnje Besedilo (če obstaja) napolni polje za govor.
    try {
      const t = localStorage.getItem(VOICE_TEXT_KEY);
      if (t && t.trim()) setText(t);
    } catch {}
  }, []);

  // Ročno osveži besedilo iz Besedila (če ga tam na novo pošlješ v Glas).
  function loadFromCopy() {
    try {
      const t = localStorage.getItem(VOICE_TEXT_KEY);
      if (t && t.trim()) {
        setText(t);
        setGenMsg({ text: "Besedilo naloženo iz Besedila.", kind: "ok" });
      } else {
        setGenMsg({ text: "V Besedilu še ni poslanega besedila.", kind: "err" });
      }
    } catch {}
  }
  // persist prefs
  useEffect(() => {
    try { localStorage.setItem(VPREF_KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  // reflect selection to global settings + rail status
  useEffect(() => {
    update({ voiceId: selected });
    onStatus(selected ? "done" : "empty");
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Samodejno naloži glasove ob prvem odprtju.
  useEffect(() => {
    loadVoices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setPref = (patch: Partial<VoicePrefs>) => setPrefs((p) => ({ ...p, ...patch }));

  function voiceSettings() {
    const vs: any = {
      stability: prefs.stab / 100,
      similarity_boost: prefs.sim / 100,
      style: prefs.style / 100,
      use_speaker_boost: true,
    };
    if (prefs.model !== "eleven_v3") vs.speed = prefs.speed / 100;
    return vs;
  }

  async function speak(besedilo: string, voiceId: string): Promise<string> {
    const data = await callProxy<{ audio_base64?: string }>(
      "elevenlabs",
      { voice_id: voiceId, text: besedilo, model_id: prefs.model, voice_settings: voiceSettings() },
      settings.proxyPath
    );
    if (!data.audio_base64) throw new Error("Storitev ni vrnila zvoka.");
    return "data:audio/mpeg;base64," + data.audio_base64;
  }

  const chosenVoice = () => selected || clonedId || "";

  async function loadVoices() {
    setBusyVoices(true);
    setVoiceMsg({ text: "Berem glasove iz tvojega računa …", kind: "" });
    try {
      const data = await callProxy<{ voices?: any[] }>("elevenlabs_voices", {}, settings.proxyPath);
      const list: Voice[] = (data.voices || []).map((v) => ({ id: v.voice_id, name: v.name, cat: v.category || "" }));
      if (!list.length) throw new Error("Račun ne vsebuje nobenega glasu.");
      setVoices(list);
      if (!selected || !list.some((v) => v.id === selected)) setSelected(list[0].id);
      setVoiceMsg({ text: `${list.length} glasov na voljo.`, kind: "ok" });
    } catch (err: any) {
      setVoiceMsg({ text: err.message, kind: "err" });
    } finally {
      setBusyVoices(false);
    }
  }

  async function previewVoice() {
    const vid = chosenVoice();
    if (!vid) { setVoiceMsg({ text: "Najprej naloži in izberi glas.", kind: "err" }); return; }
    setPreviewUrl("");
    setVoiceMsg({ text: "Pripravljam vzorec …", kind: "" });
    try {
      const url = await speak("Tako zvenim, ko berem tvoje besedilo. Lep dan želim.", vid);
      setPreviewUrl(url);
      setVoiceMsg({ text: "Vzorec pripravljen.", kind: "ok" });
    } catch (err: any) {
      setVoiceMsg({ text: err.message, kind: "err" });
    }
  }

  async function generateSpeech() {
    const vid = chosenVoice();
    if (!vid) { setGenMsg({ text: "Najprej izberi glas.", kind: "err" }); return; }
    if (!text.trim()) { setGenMsg({ text: "Vpiši besedilo za govor.", kind: "err" }); return; }
    setGenerating(true);
    setSpeechUrl("");
    setGenMsg({ text: "Ustvarjam govor …", kind: "" });
    onStatus("busy");
    try {
      const url = await speak(text.trim(), vid);
      setSpeechUrl(url);
      // Shrani zadnji govor + prebrano besedilo, da ju Podnapisi uporabijo.
      try {
        localStorage.setItem(VOICE_AUDIO_KEY, url);
        localStorage.setItem(VOICE_SPOKEN_TEXT_KEY, text.trim());
      } catch {}
      setGenMsg({ text: "Govor pripravljen.", kind: "ok" });
    } catch (err: any) {
      setGenMsg({ text: err.message, kind: "err" });
    } finally {
      setGenerating(false);
      onStatus("done");
    }
  }

  /* ---------- recording ---------- */
  async function toggleRecording() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCloneMsg({ text: "Ta brskalnik ne podpira snemanja. Naloži zvočno datoteko.", kind: "err" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      secRef.current = 0;
      setRecSeconds(0);
      const canWebm = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm");
      const rec = canWebm ? new MediaRecorder(stream, { mimeType: "audio/webm" }) : new MediaRecorder(stream);
      mimeRef.current = rec.mimeType || "audio/webm";
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        blobRef.current = new Blob(chunksRef.current, { type: mimeRef.current });
        setRecording(false);
        setHasRecording(true);
        const s = secRef.current;
        setCloneMsg(
          s < 30
            ? { text: `posnetek je kratek (${s} s) — klon bo slabši`, kind: "err" }
            : { text: "posnetek pripravljen — klon še ni ustvarjen", kind: "" }
        );
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      timerRef.current = setInterval(() => {
        secRef.current += 1;
        setRecSeconds(secRef.current);
      }, 1000);
    } catch (err: any) {
      setCloneMsg({ text: "Do mikrofona ni bilo mogoče dostopati. Preveri dovoljenja.", kind: "err" });
    }
  }

  function onFilePicked(file: File) {
    blobRef.current = file;
    mimeRef.current = file.type || "audio/mpeg";
    setHasRecording(true);
    setCloneMsg({ text: `${file.name} — posnetek pripravljen`, kind: "" });
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = () => rej(new Error("Posnetka ni bilo mogoče prebrati."));
      r.readAsDataURL(blob);
    });
  }

  async function makeClone() {
    const blob = blobRef.current;
    if (!blob) { setCloneMsg({ text: "ni posnetka", kind: "err" }); return; }
    // one-shot upload → keep under Vercel request size (~2 min of audio)
    if (blob.size > 3 * 1024 * 1024) {
      setCloneMsg({ text: "posnetek je predolg (nad ~2 minuti) — skrajšaj ga in poskusi znova", kind: "err" });
      return;
    }
    setCloning(true);
    setCloneMsg({ text: "pošiljam posnetek …", kind: "" });
    try {
      const b64 = await blobToBase64(blob);
      const data = await callProxy<{ voice_id?: string; name?: string }>(
        "elevenlabs_clone",
        { name: "Moj glas " + new Date().toLocaleDateString("sl-SI"), audio_base64: b64, mime: mimeRef.current },
        settings.proxyPath
      );
      if (!data.voice_id) throw new Error("Storitev ni vrnila oznake glasu.");
      const v: Voice = { id: data.voice_id, name: (data.name || "Moj glas") + " · klon", cat: "klon" };
      setVoices((prev) => [...prev.filter((x) => x.id !== v.id), v]);
      setClonedId(data.voice_id);
      setSelected(data.voice_id);
      setCloneMsg({ text: "✓ klon ustvarjen in izbran kot glas", kind: "ok" });
    } catch (err: any) {
      setCloneMsg({ text: err.message, kind: "err" });
    } finally {
      setCloning(false);
    }
  }

  const speedDisabled = prefs.model === "eleven_v3";
  const recLabel = recording
    ? `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}` +
      (recSeconds < 30 ? ` — posnemi še vsaj ${30 - recSeconds} s` : " — dovolj za klon")
    : "";

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 04</div>
        <h1 className="panel__title">Glas</h1>
        <p className="panel__blurb">
          Posnami govor z lastnim, kloniranim glasom. Naloži glasove z računa, izberi ali kloniraj
          svojega in ustvari govor za oglas.
        </p>
      </header>

      <StageActions
        busy={busyVoices || generating}
        onRefresh={loadVoices}
        onClear={() => {
          setSpeechUrl("");
          setText("");
          try {
            localStorage.removeItem("pikaluna_studio_voice_audio");
          } catch {}
        }}
      />

      <div className="vcols">
        {/* LEFT — voice choice + tuning */}
        <div>
          <div className="card">
            <div className="card__title">Kateri glas govori</div>
            <div className="field">
              <select
                className="select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {voices.length === 0 && <option value="">— glasovi še niso naloženi —</option>}
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.cat ? ` · ${v.cat}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Model govora</label>
              <select className="select" value={prefs.model} onChange={(e) => setPref({ model: e.target.value })}>
                {TTS_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="btnrow">
              <button className="btn" onClick={loadVoices} disabled={busyVoices}>
                {busyVoices ? "Nalagam …" : "Naloži glasove"}
              </button>
              <button className="btn btn--ghost" onClick={previewVoice}>Poslušaj vzorec</button>
            </div>
            <div className={`vstatus${voiceMsg.kind ? ` vstatus--${voiceMsg.kind}` : ""}`}>{voiceMsg.text}</div>
            {previewUrl && <audio controls src={previewUrl} />}
            <p className="help-note">
              Nov glas dodaš na račun na{" "}
              <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noreferrer">elevenlabs.io</a>,
              nato pritisni Naloži glasove.
            </p>
          </div>

          <div className="card">
            <div className="card__title">Podajanje</div>
            <Slider label="Stabilnost" value={prefs.stab} min={0} max={100} onChange={(v) => setPref({ stab: v })} />
            <Slider label="Jasnost in zvestoba" value={prefs.sim} min={0} max={100} onChange={(v) => setPref({ sim: v })} />
            <Slider label="Izraznost" value={prefs.style} min={0} max={100} onChange={(v) => setPref({ style: v })} />
            <Slider
              label="Hitrost govora"
              value={prefs.speed}
              min={70}
              max={120}
              disabled={speedDisabled}
              format={(v) => (v / 100).toFixed(2) + "×"}
              onChange={(v) => setPref({ speed: v })}
            />
            <p className="help-note">
              Nizka stabilnost = bolj živo, a manj predvidljivo; visoka = enakomerno, a bolj enolično.
              Jasnost drži glas blizu izvirniku. Izraznost pusti na nič, razen za pretiran nastop.
              {speedDisabled && " Hitrost pri modelu v3 ni na voljo."}
            </p>
          </div>
        </div>

        {/* RIGHT — record/clone + TTS */}
        <div>
          <div className="card">
            <div className="card__title">Kloniraj svoj glas <small>≥ 30 s, pod ~2 min</small></div>
            <div className="btnrow">
              <button className={`rec-btn${recording ? " on" : ""}`} onClick={toggleRecording}>
                <span className="rec-btn__dot" />
                {recording ? "Ustavi snemanje" : "Posnemi zdaj"}
              </button>
              <label className="btn btn--ghost" style={{ cursor: "pointer" }}>
                Naloži datoteko
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && onFilePicked(e.target.files[0])}
                />
              </label>
              {recording && <span className="rec-time">{recLabel}</span>}
            </div>

            {hasRecording && (
              <div className="wave" aria-hidden>
                {Array.from({ length: 28 }).map((_, i) => (
                  <span key={i} style={{ height: `${6 + ((i * 37) % 20)}px` }} />
                ))}
              </div>
            )}

            <div className="btnrow" style={{ marginTop: 8 }}>
              <button className="btn btn--sol" onClick={makeClone} disabled={!hasRecording || cloning}>
                {cloning ? "Ustvarjam klon …" : "Ustvari klon"}
              </button>
            </div>
            <div className={`vstatus${cloneMsg.kind ? ` vstatus--${cloneMsg.kind}` : ""}`}>{cloneMsg.text}</div>
            <p className="help-note">
              Za dober klon posnemi 30–60 s mirnega govora brez hrupa. Snemanje deluje le na https ali
              lokalno. Posnetek gre v enem klicu, zato naj bo krajši od dveh minut.
            </p>
          </div>

          <div className="card">
            <div className="card__title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Besedilo za govor</span>
              <button className="btn btn--ghost" onClick={loadFromCopy}>
                Naloži iz Besedila
              </button>
            </div>
            <textarea
              className="textarea"
              rows={5}
              placeholder="Vpiši besedilo, ki naj ga glas prebere … (ali ga pošlji iz stopnje Besedilo)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="btnrow" style={{ marginTop: 12 }}>
              <button className="btn btn--sol" onClick={generateSpeech} disabled={generating}>
                {generating ? "Ustvarjam govor …" : "Ustvari govor"}
              </button>
            </div>
            <div className={`vstatus${genMsg.kind ? ` vstatus--${genMsg.kind}` : ""}`}>{genMsg.text}</div>
            {speechUrl && (
              <>
                <audio controls src={speechUrl} />
                <div className="btnrow" style={{ marginTop: 10 }}>
                  <a className="btn btn--ghost" href={speechUrl} download="govor.mp3">Prenesi mp3</a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label, value, min, max, onChange, disabled, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  format?: (v: number) => string;
}) {
  return (
    <div className="range">
      <div className="range__top">
        <span>{label}</span>
        <b>{format ? format(value) : value}</b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
