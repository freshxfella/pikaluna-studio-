"use client";

import { useEffect, useRef, useState } from "react";
import { startRender, pollRender, RenderJob } from "@/lib/api";
import { StageStatus } from "@/lib/stages";
import { IMAGES_KEY } from "@/components/stages/ImageStage";

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
  const [scenes, setScenes] = useState<SceneInput[]>(EMPTY_SCENES);
  const [duration, setDuration] = useState<"5" | "10">("5");
  const [rendering, setRendering] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState("");
  const jobIdRef = useRef<string>("");

  // Prelivanje iz stopnje Slike: ob odprtju napolni prizore z generiranimi slikami.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMAGES_KEY);
      if (!raw) return;
      const handed = JSON.parse(raw) as { imageUrl: string; prompt: string }[];
      if (Array.isArray(handed) && handed.length) {
        setScenes(handed.map((h) => ({ imageUrl: h.imageUrl || "", prompt: h.prompt || "" })));
      }
    } catch {}
  }, []);

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

      {error && <div className="vstatus vstatus--err" style={{ maxWidth: 920 }}>{error}</div>}

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
              {res?.videoUrl && <video controls src={res.videoUrl} />}
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
