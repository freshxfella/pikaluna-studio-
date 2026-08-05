"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "SI" | "CZ" | "HU" | "SK" | "EN";

export interface Settings {
  model: string;
  languages: Lang[];
  proxyPath: string;
  voiceId: string; // ElevenLabs selected/cloned voice
}

const DEFAULTS: Settings = {
  model: "gpt-5.6-terra",
  languages: ["SI", "CZ", "HU", "SK"],
  proxyPath: "/api/proxy",
  voiceId: "",
};

// New namespaced key avoids colliding with Pikaluna's legacy `vecjezik_*` keys.
const KEY = "pikaluna_studio_settings";

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  toggleLang: (l: Lang) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  // hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const toggleLang = (l: Lang) =>
    setSettings((s) => ({
      ...s,
      languages: s.languages.includes(l)
        ? s.languages.filter((x) => x !== l)
        : [...s.languages, l],
    }));

  return (
    <SettingsContext.Provider value={{ settings, update, toggleLang }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
