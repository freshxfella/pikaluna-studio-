"use client";

import { STAGES, StageId, StageStatus } from "@/lib/stages";
import { useSettings, Lang } from "@/components/SettingsProvider";

const ALL_LANGS: Lang[] = ["SI", "CZ", "HU", "SK", "EN"];

export default function PipelineRail({
  active,
  statuses,
  onSelect,
}: {
  active: StageId;
  statuses: Record<StageId, StageStatus>;
  onSelect: (id: StageId) => void;
}) {
  const { settings, toggleLang } = useSettings();

  return (
    <nav className="rail" aria-label="Stopnje oglasa">
      <div className="rail__eyebrow">Cevovod</div>

      {STAGES.map((s, i) => {
        const st = statuses[s.id];
        const isActive = s.id === active;
        const dotClass =
          st === "done"
            ? "stage__dot--done"
            : st === "busy"
            ? "stage__dot--busy"
            : isActive
            ? "stage__dot--active"
            : "stage__dot--empty";
        return (
          <button
            key={s.id}
            className={`stage${isActive ? " stage--active" : ""}`}
            onClick={() => onSelect(s.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={`stage__dot ${dotClass}`} />
            <span className="stage__meta">
              <span className="stage__idx">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="stage__label">{s.label}</span>
            </span>
            {!s.ready && <span className="stage__tag">v pripravi</span>}
          </button>
        );
      })}

      <div className="rail__foot">
        <div className="rail__eyebrow">Jeziki</div>
        <div className="lang-strip">
          {ALL_LANGS.map((l) => (
            <button
              key={l}
              className={`lang-chip${settings.languages.includes(l) ? " lang-chip--on" : ""}`}
              onClick={() => toggleLang(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
