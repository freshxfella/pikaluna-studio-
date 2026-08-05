"use client";

import { useSettings, Lang } from "@/components/SettingsProvider";

const ALL_LANGS: Lang[] = ["SI", "CZ", "HU", "SK", "EN"];

// Viden izbirnik jezikov v vrhnji vrstici — klikni za vklop/izklop.
// Deljen prek nastavitev, zato velja za vse zavihke, ki uporabljajo jezike.
export default function LangBar() {
  const { settings, toggleLang } = useSettings();
  return (
    <div className="langbar" role="group" aria-label="Jeziki">
      <span className="langbar__label">Jeziki</span>
      {ALL_LANGS.map((l) => {
        const on = settings.languages.includes(l);
        return (
          <button
            key={l}
            type="button"
            className={`langbar__chip${on ? " langbar__chip--on" : ""}`}
            aria-pressed={on}
            onClick={() => toggleLang(l)}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
