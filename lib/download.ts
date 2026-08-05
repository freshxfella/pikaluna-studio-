"use client";

// Sproži prenos datoteke v brskalniku.

// Prenese data-URL (npr. data:image/png;base64,... ali data:video/mp4;...).
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Prenese golo besedilo kot datoteko (npr. .srt podnapisi).
export function downloadText(text: string, filename: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Prenese oddaljeni URL (npr. video s fal/Creatomate). Poskusi fetch → blob,
// da deluje prenos tudi za tuje domene; ob napaki odpre v novem zavihku.
export async function downloadRemote(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    downloadDataUrl(obj, filename);
    setTimeout(() => URL.revokeObjectURL(obj), 1000);
  } catch {
    window.open(url, "_blank");
  }
}

// Sekunde → SRT časovni žig: HH:MM:SS,mmm
function srtTime(t: number): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(mm, 3)}`;
}

// Zgradi vsebino .srt iz vrstic {start, end, text}.
export function buildSrt(lines: { start: number; end: number; text: string }[]): string {
  return lines
    .filter((l) => l.text.trim())
    .map((l, i) => `${i + 1}\n${srtTime(l.start)} --> ${srtTime(l.end)}\n${l.text.trim()}\n`)
    .join("\n");
}
