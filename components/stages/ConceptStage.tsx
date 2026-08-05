"use client";

import { useState } from "react";
import { generateCopy, refineText } from "@/lib/api";
import { useSettings } from "@/components/SettingsProvider";
import { usePersistentState } from "@/lib/usePersistentState";
import StageActions from "@/components/StageActions";
import { StageStatus } from "@/lib/stages";

// Koncept se shrani, da ga Besedilo in Overlay lahko uporabita kot kontekst.
export const CONCEPT_KEY = "pikaluna_studio_concept";

// Poudarki, ki jih Ina omenja: mehkoba, občutek, vsestranskost, energija ...
const FOCI = [
  "mehkoba materiala",
  "udobje ob nošenju",
  "vsestranskost (dan/večer)",
  "energija, gibanje, skok",
  "samozavest",
  "oprijem brez utesnjevanja",
  "jutranja svetloba, topli toni",
  "vsakodnevna uporaba",
];

export default function ConceptStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const { settings } = useSettings();
  const [product, setProduct] = usePersistentState("concept_product", "");
  const [selected, setSelected] = usePersistentState<string[]>("concept_foci", []);
  const [extra, setExtra] = usePersistentState("concept_extra", "");
  const [result, setResult] = usePersistentState("concept_result", "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (f: string) =>
    setSelected((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));

  function buildPrompt(): string {
    return [
      "Si kreativni vodja za kratke video oglase (Instagram/TikTok) za žensko športno modo.",
      "Predlagaj KONKRETNO idejo/smer za en video oglas spodnjega izdelka.",
      "",
      "Izdelek:",
      product.trim(),
      "",
      selected.length ? "Poudarki, ki jih želimo prikazati: " + selected.join(", ") + "." : "",
      extra.trim() ? "Dodatne želje: " + extra.trim() : "",
      "",
      "Vrni jedrnato, v tem formatu (brez markdowna):",
      "SMER: ena poved, kaj je glavni občutek/sporočilo videa.",
      "PRIZORI: 3 kratke ideje za prizore (kaj vidimo, kako se model giblje).",
      "TON: nekaj besed o razpoloženju in tempu.",
      "OPOMBA ZA BESEDILO: kaj naj poudari copy/voiceover ob tem videu.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function run() {
    if (!product.trim()) {
      setError("Vpiši, za kateri izdelek je video.");
      return;
    }
    setError("");
    setBusy(true);
    setResult("");
    onStatus("busy");
    try {
      const text = await generateCopy(buildPrompt(), settings.model, settings.proxyPath);
      setResult(text);
      try {
        localStorage.setItem(
          CONCEPT_KEY,
          JSON.stringify({ product: product.trim(), foci: selected, concept: text })
        );
      } catch {}
      onStatus("done");
    } catch (err: any) {
      setError(err.message || "Ustvarjanje koncepta ni uspelo.");
      onStatus("empty");
    } finally {
      setBusy(false);
    }
  }

  async function copyOut() {
    try {
      await navigator.clipboard.writeText(result);
    } catch {}
  }

  function clearResult() {
    setResult("");
    onStatus("empty");
  }

  async function refine(instruction: string) {
    if (!result.trim()) return;
    setBusy(true);
    onStatus("busy");
    try {
      const improved = await refineText(result, instruction, settings.model, settings.proxyPath);
      setResult(improved);
      onStatus("done");
    } catch (err: any) {
      setError(err.message || "Popravek ni uspel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 01</div>
        <h1 className="panel__title">Koncept</h1>
        <p className="panel__blurb">
          Ideja in smer videa — preden nastanejo slike. Na čem je poudarek, kaj prikazujemo, kakšen
          je občutek. To usmeri slike, gibanje in kasnejše besedilo.
        </p>
      </header>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Za kateri izdelek?</label>
        <textarea
          className="textarea"
          style={{ minHeight: 90 }}
          placeholder="npr. Brezšivne pajkice z visokim pasom, dvoslojna mehka tkanina, za jogo in vsakodnevno nošenje …"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Na čem je poudarek</label>
        <div className="chip-wrap">
          {FOCI.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip${selected.includes(f) ? " chip--on" : ""}`}
              onClick={() => toggle(f)}
              disabled={busy}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ maxWidth: 720 }}>
        <label className="field__label">Dodatne želje (neobvezno)</label>
        <input
          className="input"
          placeholder="npr. brez obraza, samo detajli; ali: vesele, skačejo, sončno vzdušje"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="btnrow">
        <button className="btn btn--sol" onClick={run} disabled={busy}>
          {busy ? "Razmišljam …" : "Predlagaj ideje"}
        </button>
      </div>

      {error && <div className="vstatus vstatus--err" style={{ maxWidth: 720 }}>{error}</div>}

      {result && (
        <>
          <StageActions
            busy={busy}
            onRepeat={run}
            onClear={clearResult}
            onRefine={refine}
            refineHint="npr. bolj energično, skrajšaj, dodaj poudarek na udobje"
          />
        </>
      )}
      {result && (
        <div className="copy-card" style={{ maxWidth: 720, marginTop: 18 }}>
          <div className="copy-card__head">
            <span className="lang-chip lang-chip--on">koncept</span>
            <button className="btn btn--ghost" onClick={copyOut}>
              Kopiraj
            </button>
          </div>
          <pre className="copy-card__text">{result}</pre>
        </div>
      )}
    </section>
  );
}
