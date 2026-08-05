"use client";

import { useEffect, useRef, useState } from "react";

// Kot useState, a stanje preživi menjavo zavihka in osvežitev strani.
// Hrani se v localStorage pod danim ključem. Komponente se ob menjavi
// zavihka odmontirajo (unmount), zato bi navaden useState pozabil vnos —
// ta hook to reši.
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);

  // hidracija po mountu (izognemo se SSR mismatchu)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [key]);

  // shranjevanje ob vsaki spremembi (šele po prvi hidraciji, da ne prepišemo
  // shranjenega z začetno vrednostjo)
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
