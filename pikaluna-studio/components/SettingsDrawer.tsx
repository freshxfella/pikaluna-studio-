"use client";

import { useSettings, Lang } from "@/components/SettingsProvider";

const ALL_LANGS: Lang[] = ["SI", "CZ", "HU", "SK", "EN"];
const MODELS = ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-4o"];

export default function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const { settings, update, toggleLang } = useSettings();

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Nastavitve">
        <h2 className="drawer__title">Nastavitve</h2>
        <p className="drawer__sub">Shrani se samodejno v tem brskalniku.</p>

        <div className="field">
          <label className="field__label" htmlFor="model">Model za besedila</label>
          <select
            id="model"
            className="select"
            value={settings.model}
            onChange={(e) => update({ model: e.target.value })}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field__label">Jeziki oglasa</span>
          <div className="toggle-row">
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

        <div className="field">
          <label className="field__label" htmlFor="voice">Glas (ElevenLabs voice ID)</label>
          <input
            id="voice"
            className="input"
            placeholder="izberi v stopnji Glas ali prilepi ID"
            value={settings.voiceId}
            onChange={(e) => update({ voiceId: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="proxy">Naslov proxy funkcije</label>
          <input
            id="proxy"
            className="input mono"
            value={settings.proxyPath}
            onChange={(e) => update({ proxyPath: e.target.value })}
          />
        </div>

        <button className="btn" onClick={onClose}>Zapri</button>
      </aside>
    </>
  );
}
