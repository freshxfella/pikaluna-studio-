"use client";

import { useState } from "react";

// Skupna vrstica dejanj za zavihke. Vsak gumb se pokaže samo, če zavihek
// poda ustrezno funkcijo (drugače nima smisla).
export interface StageActionsProps {
  onRepeat?: () => void; // Ponovi generiranje z istimi vnosi
  onClear?: () => void; // Izbriši rezultate tega zavihka
  onRefresh?: () => void; // Osveži povezane podatke iz prejšnjih stopenj
  onRefine?: (instruction: string) => void; // Popravi rezultat po navodilu (AI)
  busy?: boolean;
  refineHint?: string; // namig v polju za navodilo
}

export default function StageActions({
  onRepeat,
  onClear,
  onRefresh,
  onRefine,
  busy,
  refineHint,
}: StageActionsProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [instruction, setInstruction] = useState("");

  function doRefine() {
    if (!instruction.trim() || !onRefine) return;
    onRefine(instruction.trim());
    setInstruction("");
    setRefineOpen(false);
  }

  return (
    <div className="stage-actions">
      <div className="stage-actions__row">
        {onRepeat && (
          <button className="btn btn--ghost" onClick={onRepeat} disabled={busy} title="Ponovi generiranje">
            ↻ Ponovi
          </button>
        )}
        {onRefresh && (
          <button className="btn btn--ghost" onClick={onRefresh} disabled={busy} title="Osveži povezane podatke">
            ⟳ Osveži
          </button>
        )}
        {onRefine && (
          <button
            className="btn btn--ghost"
            onClick={() => setRefineOpen((o) => !o)}
            disabled={busy}
            title="AI popravi rezultat po navodilu"
          >
            ✎ Popravi
          </button>
        )}
        {onClear && (
          <button className="btn btn--ghost" onClick={onClear} disabled={busy} title="Izbriši rezultate">
            🗑 Izbriši
          </button>
        )}
      </div>

      {refineOpen && onRefine && (
        <div className="stage-actions__refine">
          <input
            className="input"
            style={{ flex: 1, minWidth: 220 }}
            placeholder={refineHint || "npr. skrajšaj, bolj energično, odstrani zadnji stavek …"}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doRefine()}
            disabled={busy}
          />
          <button className="btn btn--sol" onClick={doRefine} disabled={busy || !instruction.trim()}>
            Popravi
          </button>
        </div>
      )}
    </div>
  );
}
