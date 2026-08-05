"use client";

// Trajni shranjevalnik, ki prenese tudi velike medije (slike, avdio).
// Majhne vrednosti (besedilo, nastavitve) gredo v localStorage; velike
// (nad ~50 KB, npr. data-URL slike) v IndexedDB, ki zmore desetine MB.
// localStorage ima ~5 MB omejitev na celo domeno — zato slike ne smejo vanj.

const DB_NAME = "pikaluna_studio";
const STORE = "state";
const LARGE_PREFIX = "__idb__:"; // v localStorage pustimo tak zaznamek

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDB();
  const val = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return val;
}

// Shrani vrednost. Če je velika, gre v IndexedDB in v localStorage ostane
// samo zaznamek. Če je majhna, gre v localStorage.
export async function saveValue(key: string, serialized: string): Promise<void> {
  const isLarge = serialized.length > 50_000 || serialized.includes("data:");
  if (isLarge) {
    await idbSet(key, serialized);
    try {
      localStorage.setItem(key, LARGE_PREFIX);
    } catch {
      /* ignore */
    }
    return;
  }
  // majhna vrednost: localStorage; če je bila prej velika, počisti IDB
  try {
    localStorage.setItem(key, serialized);
  } catch {
    // localStorage poln → shrani v IDB kot rezervo
    await idbSet(key, serialized);
    try {
      localStorage.setItem(key, LARGE_PREFIX);
    } catch {
      /* ignore */
    }
  }
}

// Naloži vrednost (localStorage ali IndexedDB, glede na zaznamek).
export async function loadValue(key: string): Promise<string | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (raw === LARGE_PREFIX) {
    return await idbGet(key);
  }
  return raw;
}
