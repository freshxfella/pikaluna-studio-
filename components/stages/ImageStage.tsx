"use client";

import { useState } from "react";
import { generateImage } from "@/lib/api";
import { analyzeProductPhoto } from "@/lib/api";
import { useSettings } from "@/components/SettingsProvider";
import { usePersistentState } from "@/lib/usePersistentState";
import { downloadDataUrl } from "@/lib/download";
import StageActions from "@/components/StageActions";
import { PRODUCT_TYPES, buildProductPrompt } from "@/lib/productKnowledge";
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
  const [scenes, setScenes] = usePersistentState<SceneImg[]>("images_scenes", EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Strukturiran vhod produkta (nadgradnja).
  const [productData, setProductData] = usePersistentState("img_product_data", "");
  const [typeIds, setTypeIds] = usePersistentState<string[]>("img_types", []);
  const [extra, setExtra] = usePersistentState("img_extra", "");
  const [photoAnalysis, setPhotoAnalysis] = usePersistentState("img_photo_analysis", "");
  const [analyzing, setAnalyzing] = useState(false);
  const [inputOpen, setInputOpen] = usePersistentState("img_input_open", true);

  const toggleType = (id: string) =>
    setTypeIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  // CSV / paste — preberi datoteko v besedilo.
  function onCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setProductData(String(reader.result || ""));
    reader.readAsText(file);
  }

  // Analiza fotografije produkta prek Claude vision.
  async function analyzePhoto(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      setAnalyzing(true);
      setError("");
      try {
        const desc = await analyzeProductPhoto(dataUrl, settings.proxyPath);
        setPhotoAnalysis(desc);
      } catch (err: any) {
        setError(err.message || "Analiza fotografije ni uspela (rabiš ANTHROPIC ključ v Vercelu).");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // Sestavi feature-first prompt in ga vpiši v vse prazne prizore.
  function applyPromptToScenes() {
    setScenes((list) =>
      list.map((sc) => {
        const scene = sc.prompt.trim();
        const full = buildProductPrompt({
          productData,
          photoAnalysis,
          typeIds,
          extra,
          scene: scene || "product on model, clear front view",
        });
        return { ...sc, prompt: full };
      })
    );
  }

  const patch = (i: number, p: Partial<SceneImg>) =>
    setScenes((s) => s.map((sc, idx) => (idx === i ? { ...sc, ...p } : sc)));

  // Nalaganje lastne slike z računalnika v prizor (namesto AI generiranja).
  function uploadImage(i: number, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setScenes((s) => {
        const next = s.map((sc, idx) => (idx === i ? { ...sc, url, status: "done" as const } : sc));
        const done = next.filter((x) => x.url).map((x) => ({ imageUrl: x.url, prompt: x.prompt }));
        try {
          localStorage.setItem(IMAGES_KEY, JSON.stringify(done));
        } catch {}
        return next;
      });
      onStatus("done");
    };
    reader.readAsDataURL(file);
  }

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

      <div className="card" style={{ maxWidth: 920 }}>
        <div
          className="card__title"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setInputOpen((o) => !o)}
        >
          <span>Produkt — podatki, foto, posebnosti</span>
          <span className="vstatus" style={{ margin: 0 }}>{inputOpen ? "skrij ▲" : "prikaži ▼"}</span>
        </div>

        {inputOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
            {/* Podatki: CSV ali paste */}
            <div className="field">
              <label className="field__label">Podatki produkta (CSV ali prilepi)</label>
              <div className="btnrow" style={{ marginBottom: 6 }}>
                <label className="btn btn--ghost btn--file">
                  Naloži CSV
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    hidden
                    onChange={(e) => e.target.files?.[0] && onCsvFile(e.target.files[0])}
                  />
                </label>
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 70 }}
                placeholder="prilepi vrstico/podatke iz tabelce (ime, material, barva …) ali naloži CSV"
                value={productData}
                onChange={(e) => setProductData(e.target.value)}
              />
            </div>

            {/* Foto → Claude analiza */}
            <div className="field">
              <label className="field__label">Fotografija produkta (AI jo analizira)</label>
              <div className="btnrow">
                <label className="btn btn--ghost btn--file">
                  {analyzing ? "Analiziram …" : "Naloži foto"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={analyzing}
                    onChange={(e) => e.target.files?.[0] && analyzePhoto(e.target.files[0])}
                  />
                </label>
                {photoAnalysis && <span className="pill pill--done">opis pripravljen ✓</span>}
              </div>
              {photoAnalysis && (
                <textarea
                  className="textarea"
                  style={{ minHeight: 60, marginTop: 6 }}
                  value={photoAnalysis}
                  onChange={(e) => setPhotoAnalysis(e.target.value)}
                />
              )}
            </div>

            {/* Tip produkta — vgrajeni triki */}
            <div className="field">
              <label className="field__label">Tip produkta (doda vgrajene trike)</label>
              <div className="chip-wrap">
                {PRODUCT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip${typeIds.includes(t.id) ? " chip--on" : ""}`}
                    onClick={() => toggleType(t.id)}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posebnosti */}
            <div className="field">
              <label className="field__label">Posebnosti / na kaj paziti (neobvezno)</label>
              <textarea
                className="textarea"
                style={{ minHeight: 50 }}
                placeholder="npr. silikonski zaključki na rokavih, poseben preklop, drži kapuco odprto …"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </div>

            <div className="btnrow">
              <button className="btn btn--sol" onClick={applyPromptToScenes}>
                Sestavi prompte za prizore
              </button>
              <span className="vstatus" style={{ margin: 0 }}>
                Zgradi feature-first prompt v vsak prizor spodaj. Nato uredi prizor in klikni “Ustvari slike”.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="btnrow">
        <button className="btn btn--sol" onClick={run} disabled={busy}>
          {busy ? "Ustvarjam …" : "Ustvari slike"}
        </button>
      </div>

      <StageActions
        busy={busy}
        onRepeat={run}
        onClear={() => {
          setScenes(EMPTY);
          try {
            localStorage.removeItem(IMAGES_KEY);
          } catch {}
          onStatus("empty");
        }}
      />

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

            <div className="card-actions">
              <label className="btn btn--ghost btn--file">
                Naloži svojo
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && uploadImage(i, e.target.files[0])}
                />
              </label>
              {sc.url && (
                <button
                  className="btn btn--ghost"
                  onClick={() => downloadDataUrl(sc.url, `prizor-${i + 1}.png`)}
                >
                  Prenesi
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
