"use client";

import { useState } from "react";
import { generateCopy, refineText } from "@/lib/api";
import { useSettings, Lang } from "@/components/SettingsProvider";
import { usePersistentState } from "@/lib/usePersistentState";
import StageActions from "@/components/StageActions";
import { StageStatus } from "@/lib/stages";
import { CONCEPT_KEY } from "@/components/stages/ConceptStage";

const LANG_NAMES: Record<Lang, string> = {
  SI: "slovenščina",
  CZ: "češčina",
  HU: "madžarščina",
  SK: "slovaščina",
  EN: "angleščina",
};

// Zbrano besedilo — Montaža ga kasneje prebere.
const COPY_KEY = "pikaluna_studio_copy";
// Besedilo, ki ga prelijemo v Glas kot predlogo za voiceover.
export const VOICE_TEXT_KEY = "pikaluna_studio_voice_text";

interface Result {
  lang: Lang;
  text: string;
}

function readConcept(): string {
  try {
    const raw = localStorage.getItem(CONCEPT_KEY);
    if (!raw) return "";
    const c = JSON.parse(raw);
    return typeof c?.concept === "string" ? c.concept : "";
  } catch {
    return "";
  }
}

export default function CopyStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings } = useSettings();
  const [product, setProduct] = usePersistentState("copy_product", "");
  const [tone, setTone] = usePersistentState("copy_tone", "energično, prijazno, brez pretiravanja");
  const [useConcept, setUseConcept] = usePersistentState("copy_useConcept", true);
  const [results, setResults] = usePersistentState<Result[]>("copy_results", []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handed, setHanded] = useState<Lang | null>(null);

  function buildPrompt(lang: Lang, concept: string): string {
    return [
      `Napiši kratko oglasno besedilo za izdelek spodaj, v jeziku: ${LANG_NAMES[lang]}.`,
      `Ton: ${tone}.`,
      concept ? "Upoštevaj smer videa (koncept):\n" + concept : "",
      "Format: udarni naslov (do 6 besed), nato 2–3 stavki opisa, nato kratek poziv k dejanju.",
      "Brez oznak, brez markdowna, samo besedilo. Ne prevajaj dobesedno — piši naravno za ta trg.",
      "",
      "Opis izdelka:",
      product.trim(),
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function run() {
    if (!product.trim()) {
      setError("Vpiši opis izdelka.");
      return;
    }
    if (settings.languages.length === 0) {
      setError("V nastavitvah izberi vsaj en jezik.");
      return;
    }
    setError("");
    setBusy(true);
    setResults([]);
    setHanded(null);
    onStatus("busy");
    const concept = useConcept ? readConcept() : "";
    try {
      const out: Result[] = [];
      for (const lang of settings.languages) {
        const text = await generateCopy(buildPrompt(lang, concept), settings.model, settings.proxyPath);
        out.push({ lang, text });
        setResults([...out]);
      }
      try {
        localStorage.setItem(COPY_KEY, JSON.stringify(out));
      } catch {}
      onStatus("done");
    } catch (err: any) {
      setError(err.message || "Pisanje besedila ni uspelo.");
      onStatus(results.length ? "done" : "empty");
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  // Prelivanje v Glas: shrani izbrano besedilo, Glas ga prebere kot predlogo.
  function useInVoice(r: Result) {
    try {
      localStorage.setItem(VOICE_TEXT_KEY, r.text);
      setHanded(r.lang);
    } catch {}
  }

  function clearResults() {
    setResults([]);
    onStatus("empty");
  }

  async function refineAll(instruction: string) {
    if (!results.length) return;
    setBusy(true);
    onStatus("busy");
    try {
      const out: Result[] = [];
      for (const r of results) {
        const improved = await refineText(r.text, instruction, settings.model, settings.proxyPath);
        out.push({ lang: r.lang, text: improved });
        setResults([...out]);
      }
      onStatus("done");
    } catch (err: any) {
      setError(err.message || "Popravek ni uspel.");
    } finally {
      setBusy(false);
    }
  }

  const hasConcept = typeof window !== "undefined" && !!readConcept();

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 04</div>
        <h1 className="panel__title">Besedilo</h1>
        <p className="panel__blurb">
          Copy za ta video — naslov, stavki, poziv, v izbranih jezikih. Z gumbom “Uporabi v Glasu”
          ga pošlješ v voiceover. Jezike urejaš v nastavitvah (zgoraj desno).
        </p>
      </header>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Opis izdelka</label>
        <textarea
          className="textarea"
          style={{ minHeight: 120 }}
          placeholder="npr. Brezšivne pajkice iz mehke, dvoslojne tkanine z visokim pasom; oprijem brez utesnjevanja, primerne za jogo in vsakodnevno nošenje …"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Ton</label>
        <input
          className="input"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          disabled={busy}
        />
      </div>

      {hasConcept && (
        <label className="check-row" style={{ maxWidth: 720 }}>
          <input
            type="checkbox"
            checked={useConcept}
            onChange={(e) => setUseConcept(e.target.checked)}
            disabled={busy}
          />
          <span>Upoštevaj koncept iz stopnje 01</span>
        </label>
      )}

      <div className="btnrow">
        <span className="lang-strip">
          {settings.languages.length ? (
            settings.languages.map((l) => (
              <span key={l} className="lang-chip lang-chip--on">
                {l}
              </span>
            ))
          ) : (
            <span className="vstatus">Ni izbranih jezikov.</span>
          )}
        </span>
        <button className="btn btn--sol" onClick={run} disabled={busy}>
          {busy ? "Pišem …" : "Ustvari besedilo"}
        </button>
      </div>

      {error && <div className="vstatus vstatus--err" style={{ maxWidth: 720 }}>{error}</div>}

      {results.length > 0 && (
        <StageActions
          busy={busy}
          onRepeat={run}
          onClear={clearResults}
          onRefine={refineAll}
          refineHint="npr. skrajšaj vse, bolj prodajno, dodaj nujnost"
        />
      )}

      <div className="copy-grid">
        {results.map((r) => (
          <div className="copy-card" key={r.lang}>
            <div className="copy-card__head">
              <span className="lang-chip lang-chip--on">{r.lang}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn--ghost" onClick={() => copyToClipboard(r.text)}>
                  Kopiraj
                </button>
                <button className="btn btn--ghost" onClick={() => useInVoice(r)}>
                  Uporabi v Glasu
                </button>
              </div>
            </div>
            <pre className="copy-card__text">{r.text}</pre>
            {handed === r.lang && (
              <span className="pill pill--done">poslano v Glas ✓</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
