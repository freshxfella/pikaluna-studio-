"use client";

import { StageDef } from "@/lib/stages";

export default function Placeholder({ stage, index }: { stage: StageDef; index: number }) {
  return (
    <section className="panel">
      <header className="panel__head">
        <div className="panel__idx">Stopnja {String(index + 1).padStart(2, "0")}</div>
        <h1 className="panel__title">{stage.label}</h1>
        <p className="panel__blurb">{stage.blurb}</p>
      </header>

      <div className="empty">
        <span className="badge">v pripravi — korak {stage.buildStep}</span>
        <p className="empty__hint">
          Ta stopnja bo zaživela v naslednjih korakih gradnje. Ogrodje, navigacija
          in nastavitve že delujejo — vsebina se priklopi sem.
        </p>
        <div className="empty__row">
          <button className="btn btn--sol" disabled>
            {stage.label} — kmalu
          </button>
        </div>
      </div>
    </section>
  );
}
