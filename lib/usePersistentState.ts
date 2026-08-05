"use client";

import { useEffect, useRef, useState } from "react";
import { saveValue, loadValue } from "@/lib/persistStore";

// Kot useState, a stanje preživi menjavo zavihka in osvežitev strani.
// Velike vrednosti (slike, avdio) gredo v IndexedDB, majhne v localStorage —
// zato slike ne prepolnijo localStorage in ne pobrišejo ostalega stanja.
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);

  // hidracija po mountu
  useEffect(() => {
    let alive = true;
    loadValue(key)
      .then((raw) => {
        if (alive && raw !== null) {
          try {
            setValue(JSON.parse(raw) as T);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
    return () => {
      alive = false;
    };
  }, [key]);

  // shranjevanje ob spremembi (po hidraciji)
  useEffect(() => {
    if (!loaded.current) return;
    saveValue(key, JSON.stringify(value)).catch(() => {});
  }, [key, value]);

  return [value, setValue];
}
