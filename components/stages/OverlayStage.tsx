"use client";

import { useState } from "react";
import { StageStatus } from "@/lib/stages";
import { usePersistentState } from "@/lib/usePersistentState";
import StageActions from "@/components/StageActions";
import { CONCEPT_KEY } from "@/components/stages/ConceptStage";

// Overlay elementi se shranijo; Montaža jih kasneje pošlje Creatomatu
// kot spremenljivke v predlogo (tekst, položaj, čas, utripanje).
export const OVERLAY_KEY = "pikaluna_studio_overlay";
const COPY_KEY = "pikaluna_studio_copy";

type Kind = "badge" | "text" | "sticker";
type Pos = "tl" | "tr" | "bl" | "br" | "center";

interface OverlayItem {
  id: string;
  kind: Kind;
  text: string;
  pos: Pos;
  start: number; // sekunda pojava
  end: number; // sekunda izginotja
  blink: boolean; // utripanje
}

const POS_LABEL: Record<Pos, string> = {
  tl: "zgoraj levo",
  tr: "zgoraj desno",
  bl: "spodaj levo",
  br: "spodaj desno",
  center: "sredina",
};

const KIND_LABEL: Record<Kind, string> = {
  badge: "badge",
  text: "tekst",
  sticker: "nalepka",
};

function newItem(patch: Partial<OverlayItem> = {}): OverlayItem {
  return {
    id: Math.random().toString(36).slice(2, 9),
    kind: "badge",
    text: "",
    pos: "tr",
    start: 0,
    end: 5,
    blink: false,
    ...patch,
  };
}

// Predlogi iz konteksta: pogost badge (-65%) + naslov iz zadnjega copyja (prva vrstica).
function suggestions(): OverlayItem[] {
  const out: OverlayItem[] = [newItem({ kind: "badge", text: "-65%", pos: "tr", blink: true, start: 0, end: 5 })];
  try {
    const raw = localStorage.getItem(COPY_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as { lang: string; text: string }[];
      const first = arr?.[0]?.text?.split("\n").map((s) => s.trim()).filter(Boolean)?.[0];
      if (first) out.push(newItem({ kind: "text", text: first, pos: "bl", start: 1, end: 4 }));
    }
  } catch {}
  return out;
}

function hasConcept(): boolean {
  try {
    return !!localStorage.getItem(CONCEPT_KEY);
  } catch {
    return false;
  }
}

export default function OverlayStage({ onStatus }: { onStatus: (s: StageStatus) => void }) {
  const [items, setItems] = usePersistentState<OverlayItem[]>("overlay_items", [
    newItem({ text: "-65%", blink: true }),
  ]);
  const [saved, setSaved] = useState(false);

  const patch = (id: string, p: Partial<OverlayItem>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const add = () => setItems((l) => [...l, newItem()]);
  const remove = (id: string) => setItems((l) => l.filter((it) => it.id !== id));

  function loadSuggestions() {
    setItems(suggestions());
    setSaved(false);
  }

  function save() {
    const clean = items.filter((it) => it.text.trim());
    try {
      localStorage.setItem(OVERLAY_KEY, JSON.stringify(clean));
      setSaved(true);
      onStatus(clean.length ? "done" : "empty");
    } catch {}
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja 07</div>
        <h1 className="panel__title">Overlay</h1>
        <p className="panel__blurb">
          Grafične plasti čez zmontiran video — badge, utripajoč “-65%”, kratki teksti (ne
          podnapisi). Tu jih zbereš in nastaviš; render izvede Montaža prek Creatomate predloge.
        </p>
      </header>

      <div className="btnrow">
        <button className="btn btn--ghost" onClick={loadSuggestions}>
          Predlagaj iz konteksta
        </button>
        <button className="btn btn--ghost" onClick={add}>
          + element
        </button>
        <button className="btn btn--sol" onClick={save}>
          Shrani za Montažo
        </button>
        {saved && <span className="pill pill--done">shranjeno ✓</span>}
      </div>

      <StageActions
        onRefresh={loadSuggestions}
        onClear={() => {
          setItems([newItem({ text: "-65%", blink: true })]);
          try {
            localStorage.removeItem(OVERLAY_KEY);
          } catch {}
          onStatus("empty");
          setSaved(false);
        }}
      />

      {!hasConcept() && (
        <div className="vstatus" style={{ maxWidth: 920 }}>
          Namig: “-65%” ali naslov lahko predlagam iz Koncepta/Besedila, če ju najprej ustvariš.
        </div>
      )}

      <div className="overlay-list">
        {items.map((it) => (
          <div className="overlay-card" key={it.id}>
            <div className="overlay-card__row">
              <select
                className="select"
                value={it.kind}
                onChange={(e) => patch(it.id, { kind: e.target.value as Kind })}
              >
                {(["badge", "text", "sticker"] as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ flex: 1, minWidth: 160 }}
                placeholder="besedilo, npr. -65% ali NOVO"
                value={it.text}
                onChange={(e) => patch(it.id, { text: e.target.value })}
              />
              <select
                className="select"
                value={it.pos}
                onChange={(e) => patch(it.id, { pos: e.target.value as Pos })}
              >
                {(Object.keys(POS_LABEL) as Pos[]).map((p) => (
                  <option key={p} value={p}>
                    {POS_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="overlay-card__row">
              <label className="mini-field">
                <span>od (s)</span>
                <input
                  className="input input--mini"
                  type="number"
                  min={0}
                  value={it.start}
                  onChange={(e) => patch(it.id, { start: Number(e.target.value) })}
                />
              </label>
              <label className="mini-field">
                <span>do (s)</span>
                <input
                  className="input input--mini"
                  type="number"
                  min={0}
                  value={it.end}
                  onChange={(e) => patch(it.id, { end: Number(e.target.value) })}
                />
              </label>
              <label className="check-row" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={it.blink}
                  onChange={(e) => patch(it.id, { blink: e.target.checked })}
                />
                <span>utripanje</span>
              </label>
              <button
                className="btn btn--ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => remove(it.id)}
              >
                Odstrani
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="vstatus" style={{ maxWidth: 920, marginTop: 14 }}>
        Ko je Montaža priklopljena (Creatomate), se ti elementi pošljejo kot spremenljivke v
        predlogo in vžgejo v končni video. Zaenkrat se shranijo in čakajo na Montažo.
      </div>
    </section>
  );
}
