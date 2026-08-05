"use client";

import { useState } from "react";
import { generateImage } from "@/lib/api";
import { useSettings } from "@/components/SettingsProvider";
import { StageStatus } from "@/lib/stages";

// Slike, ki jih Video stopnja prebere kot prizore (data-URL-i).
export const IMAGES_KEY = "pikaluna_studio_images";

interface SceneImg {
  prompt: string;
  url: string; // data-URL po generiranju
  status: "empty" | "busy" | "done" | "error";
  error?: string;
}

const EMPTY: SceneImg[] = [
  { prompt: "", url: "", status: "empty" },
  { prompt: "", url: "", status: "empty" },
  { prompt: "", url: "", status: "empty" },
];

export default function ImageStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings } = useSettings();
  const [scenes, setScenes] = useState<SceneImg[]>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patch = (i: number, p: Partial<SceneImg>) =>
    setScenes((s) => s.map((sc, idx) => (idx === i ? { ...sc, ...p } : sc)));

  function persist(list: SceneImg[]) {
    const done = list.filter((s) => s.url).map((s) => ({ imageUrl: s.url, prompt: s.prompt }));
    try {
      localStorage.setItem(IMAGES_KEY, JSON.stringify(done));
    } catch {}
  }

  async function run() {
    const ready = scenes.map((s, i) => ({ s, i })).filter((x) => x.s.prompt.trim());
    if (ready.length === 0) {
      setError("Vpiši opis vsaj enega prizora.");
      return;
    }
    setError("");
    setBusy(true);
    onStatus("busy");

    // sveža kopija, da persist dobi zadnje stanje
    let working = scenes.map((s) => ({ ...s }));
    try {
      for (const { i } of ready) {
        working[i] = { ...working[i], status: "busy", error: undefined };
        setScenes([...working]);
        patch(i, { status: "busy", error: undefined });
        try {
          const url = await generateImage(working[i].prompt.trim(), settings.proxyPath);
          working[i] = { ...working[i], url, status: "done" };
        } catch (err: any) {
          working[i] = { ...working[i], status: "error", error: err.message || "Napaka." };
        }
        setScenes([...working]);
      }
      persist(working);
      const anyDone = working.some((s) => s.url);
      onStatus(anyDone ? "done" : "empty");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 02</div>
        <h1 className="panel__title">Slike</h1>
        <p className="panel__blurb">
          Ustvari prizore za oglas — tri ključne slike (gpt-image-1). Ko so pripravljene,
          se samodejno prelijejo v stopnjo Video.
        </p>
      </header>

      <div className="btnrow">
        <button className="btn btn--sol" onClick={run} disabled={busy}>
          {busy ? "Ustvarjam …" : "Ustvari slike"}
        </button>
      </div>

      {error && <div className="vstatus vstatus--err" style={{ maxWidth: 920 }}>{error}</div>}

      <div className="scenes">
        {scenes.map((sc, i) => (
          <div className="scene-card" key={i}>
            <div className="scene-card__idx">PRIZOR {String(i + 1).padStart(2, "0")}</div>

            {sc.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="thumb" src={sc.url} alt={`prizor ${i + 1}`} />
            ) : (
              <div className="thumb thumb--empty">
                {sc.status === "busy" ? "ustvarjam …" : "brez slike"}
              </div>
            )}

            <textarea
              className="textarea"
              style={{ minHeight: 72 }}
              placeholder="opis prizora, npr. ženska v terakota pajkicah ob oknu, jutranja svetloba, topli toni …"
              value={sc.prompt}
              onChange={(e) => patch(i, { prompt: e.target.value })}
              disabled={busy}
            />

            {sc.status === "busy" && <span className="pill pill--busy">generiram …</span>}
            {sc.status === "done" && <span className="pill pill--done">gotovo</span>}
            {sc.status === "error" && (
              <>
                <span className="pill pill--err">napaka</span>
                {sc.error && <div className="vstatus vstatus--err">{sc.error}</div>}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
