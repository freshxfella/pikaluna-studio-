"use client";

import { useState } from "react";
import { startRender, pollRender, RenderJob, suggestCopyForDuration } from "@/lib/api";
import { StageStatus } from "@/lib/stages";
import { usePersistentState } from "@/lib/usePersistentState";
import { useSettings } from "@/components/SettingsProvider";
import { downloadRemote } from "@/lib/download";
import StageActions from "@/components/StageActions";
import { CONCEPT_KEY } from "@/components/stages/ConceptStage";
import { IMAGES_KEY } from "@/components/stages/ImageStage";
import { useRef } from "react";

interface SceneInput {
  imageUrl: string;
  prompt: string;
}

const EMPTY_SCENES: SceneInput[] = [
  { imageUrl: "", prompt: "" },
  { imageUrl: "", prompt: "" },
  { imageUrl: "", prompt: "" },
];

export default function VideoStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings } = useSettings();
  const [scenes, setScenes] = usePersistentState<SceneInput[]>("video_scenes", EMPTY_SCENES);
  const [duration, setDuration] = usePersistentState<"5" | "10">("video_duration", "5");
  const [rendering, setRendering] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState("");
  const jobIdRef = useRef<string>("");

  // Lasten video (naložen) + izmerjena dolžina + predlagani tekst po dolžini.
  const [ownVideo, setOwnVideo] = usePersistentState<string>("video_own", "");
  const [ownSeconds, setOwnSeconds] = usePersistentState<number>("video_own_seconds", 0);
  const [suggested, setSuggested] = usePersistentState<string>("video_suggested_text", "");
  const [suggesting, setSuggesting] = useState(false);

  function onPickVideo(file: File) {
    const url = URL.createObjectURL(file);
    // izmeri dolžino
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      setOwnSeconds(Math.round(v.duration || 0));
      URL.revokeObjectURL(url);
    };
    v.src = url;
    // shrani kot data-URL (da preživi in gre lahko naprej)
    const reader = new FileReader();
    reader.onload = () => setOwnVideo(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function suggestText() {
    const secs = ownSeconds || (duration === "10" ? 10 : 5);
    setSuggesting(true);
    let context = "";
    try {
      const raw = localStorage.getItem(CONCEPT_KEY);
      if (raw) context = JSON.parse(raw)?.concept || "";
    } catch {}
    try {
      const text = await suggestCopyForDuration(secs, context, settings.model, settings.proxyPath);
      setSuggested(text);
    } catch (err: any) {
      setError(err.message || "Predloga besedila ni uspela.");
    } finally {
      setSuggesting(false);
    }
  }

  // Prelivanje iz stopnje Slike je zdaj na zahtevo (gumb), da ne pretepe
  // ročno vpisanih/ohranjenih prizorov ob vsakem odprtju zavihka.
  function loadFromImages() {
    try {
      const raw = localStorage.getItem(IMAGES_KEY);
      if (!raw) {
        setError("V Slikah še ni generiranih prizorov.");
        return;
      }
      const handed = JSON.parse(raw) as { imageUrl: string; prompt: string }[];
      if (Array.isArray(handed) && handed.length) {
        setScenes(handed.map((h) => ({ imageUrl: h.imageUrl || "", prompt: h.prompt || "" })));
        setError("");
      } else {
        setError("V Slikah še ni generiranih prizorov.");
      }
    } catch {
      setError("Prizorov iz Slik ni bilo mogoče naložiti.");
    }
  }

  const setScene = (i: number, patch: Partial<SceneInput>) =>
    setScenes((s) => s.map((sc, idx) => (idx === i ? { ...sc, ...patch } : sc)));

  const addScene = () => setScenes((s) => [...s, { imageUrl: "", prompt: "" }]);
  const removeScene = (i: number) => setScenes((s) => s.filter((_, idx) => idx !== i));

  async function start() {
    const ready = scenes.filter((s) => s.imageUrl.trim());
    if (ready.length === 0) {
      setError("Dodaj vsaj en prizor z naslovom slike.");
      return;
    }
    setError("");
    setRendering(true);
    setJob(null);
    onStatus("busy");
    try {
      const jobId = await startRender(
        ready.map((s) => ({ imageUrl: s.imageUrl.trim(), prompt: s.prompt.trim() })),
        duration
      );
      jobIdRef.current = jobId;
      const final = await pollRender(jobId, setJob);
      onStatus(final.status === "completed" ? "done" : "empty");
    } catch (err: any) {
      setError(err.message || "Render ni uspel.");
      onStatus("empty");
    } finally {
      setRendering(false);
    }
  }

  const sceneResult = (i: number) => job?.scenes.find((s) => s.index === i);

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 03</div>
        <h1 className="panel__title">Video</h1>
        <p className="panel__blurb">
          Vsak prizor oživi v videoposnetek (Kling prek fal.ai). Za zdaj vpiši naslov slike in
          gibanje ročno; ko bo stopnja Slike pripravljena, se prizori napolnijo samodejno.
        </p>
      </header>

      <div className="video-toolbar">
        <div className="field" style={{ margin: 0, minWidth: 160 }}>
          <label className="field__label">Dolžina prizora</label>
          <select className="select" value={duration} onChange={(e) => setDuration(e.target.value as "5" | "10")}>
            <option value="5">5 sekund</option>
            <option value="10">10 sekund</option>
          </select>
        </div>
        <button className="btn btn--ghost" onClick={loadFromImages} disabled={rendering}>
          Naloži iz Slik
        </button>
        <button className="btn btn--ghost" onClick={addScene} disabled={rendering}>
          + prizor
        </button>
        <button className="btn btn--sol" onClick={start} disabled={rendering}>
          {rendering ? "Renderiram …" : "Ustvari videe"}
        </button>
        {job && (
          <span className={`pill${job.status === "completed" ? " pill--done" : job.status === "failed" ? " pill--err" : " pill--busy"}`}>
            {job.status === "processing" ? "poteka" : job.status === "completed" ? "končano" : "napaka"}
          </span>
        )}
      </div>

      <StageActions
        busy={rendering}
        onRepeat={start}
        onRefresh={loadFromImages}
        onClear={() => {
          setScenes(EMPTY_SCENES);
          setJob(null);
          onStatus("empty");
        }}
      />

      {error && <div className="vstatus vstatus--err" style={{ maxWidth: 920 }}>{error}</div>}

      <div className="card" style={{ maxWidth: 920, marginTop: 4 }}>
        <div className="card__title">Lasten video in besedilo po dolžini</div>
        <div className="btnrow" style={{ marginTop: 6 }}>
          <label className="btn btn--ghost btn--file">
            Naloži svoj video
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onPickVideo(e.target.files[0])}
            />
          </label>
          {ownSeconds > 0 && <span className="pill">dolžina: {ownSeconds} s</span>}
          <button className="btn btn--sol" onClick={suggestText} disabled={suggesting}>
            {suggesting ? "Predlagam …" : "Predlagaj besedilo za dolžino"}
          </button>
        </div>
        {ownVideo && (
          <div style={{ marginTop: 10 }}>
            <video controls src={ownVideo} style={{ maxWidth: "100%", borderRadius: 8 }} />
          </div>
        )}
        {suggested && (
          <div className="copy-card" style={{ marginTop: 10 }}>
            <div className="copy-card__head">
              <span className="lang-chip lang-chip--on">predlog ({ownSeconds || (duration === "10" ? 10 : 5)} s)</span>
              <button
                className="btn btn--ghost"
                onClick={() => navigator.clipboard.writeText(suggested).catch(() => {})}
              >
                Kopiraj
              </button>
            </div>
            <pre className="copy-card__text">{suggested}</pre>
          </div>
        )}
      </div>

      <div className="scenes">
        {scenes.map((sc, i) => {
          const res = sceneResult(i);
          return (
            <div className="scene-card" key={i}>
              <div className="scene-card__idx">PRIZOR {String(i + 1).padStart(2, "0")}</div>

              {sc.imageUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb" src={sc.imageUrl} alt={`prizor ${i + 1}`} />
              ) : (
                <div className="thumb thumb--empty">brez slike</div>
              )}

              <div className="field" style={{ margin: 0 }}>
                <input
                  className="input"
                  placeholder="naslov slike (https://…)"
                  value={sc.imageUrl}
                  onChange={(e) => setScene(i, { imageUrl: e.target.value })}
                  disabled={rendering}
                />
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 64 }}
                placeholder="gibanje, npr. počasen zoom, topla svetloba …"
                value={sc.prompt}
                onChange={(e) => setScene(i, { prompt: e.target.value })}
                disabled={rendering}
              />

              {res && (
                <span
                  className={`pill${res.status === "done" ? " pill--done" : res.status === "error" ? " pill--err" : " pill--busy"}`}
                >
                  {res.status === "pending" ? "generiram …" : res.status === "done" ? "gotovo" : "napaka"}
                </span>
              )}
              {res?.videoUrl && (
                <>
                  <video controls src={res.videoUrl} />
                  <button
                    className="btn btn--ghost"
                    onClick={() => downloadRemote(res.videoUrl!, `video-prizor-${i + 1}.mp4`)}
                  >
                    Prenesi
                  </button>
                </>
              )}
              {res?.error && <div className="vstatus vstatus--err">{res.error}</div>}

              {scenes.length > 1 && !rendering && (
                <button className="btn btn--ghost" style={{ alignSelf: "flex-start" }} onClick={() => removeScene(i)}>
                  Odstrani
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
