export type StageId =
  | "concept"
  | "images"
  | "video"
  | "copy"
  | "voice"
  | "montage"
  | "overlay";
export type StageStatus = "empty" | "busy" | "done";

export interface StageDef {
  id: StageId;
  label: string;
  blurb: string;
  ready: boolean; // wired to a real backend yet?
  buildStep: number; // which step of this rebuild delivers it
}

// The product IS this sequence, so the rail is honest structure, not decoration.
// Koncept usmeri (poudarek, občutek) → Slike → Video → Besedilo (copy za ta video,
// gre tudi v Glas) → Glas → Montaža → Overlay (badge, -65%, teksti čez video).
export const STAGES: StageDef[] = [
  {
    id: "concept",
    label: "Koncept",
    blurb:
      "Ideja in smer videa — na čem je poudarek (mehkoba, vsestranskost, energija), kaj prikazujemo.",
    ready: true,
    buildStep: 6,
  },
  {
    id: "images",
    label: "Slike",
    blurb: "Ustvari prizore za oglas — tri ključne slike, ki poganjajo video.",
    ready: true,
    buildStep: 4,
  },
  {
    id: "video",
    label: "Video",
    blurb: "Vsak prizor oživi v videoposnetek (Kling prek fal.ai).",
    ready: true,
    buildStep: 3,
  },
  {
    id: "copy",
    label: "Besedilo",
    blurb: "Copy za ta video — naslov, stavki, poziv. Uporabiš ga tudi za voiceover.",
    ready: true,
    buildStep: 4,
  },
  {
    id: "voice",
    label: "Glas",
    blurb: "Posnami govor z lastnim, kloniranim glasom (ElevenLabs).",
    ready: true,
    buildStep: 2,
  },
  {
    id: "montage",
    label: "Montaža",
    blurb: "Sestavi prizore in glas v končni oglas (Creatomate).",
    ready: false,
    buildStep: 5,
  },
  {
    id: "overlay",
    label: "Overlay",
    blurb: "Dodaj badge, utripajoč -65% in kratke tekste čez zmontiran video.",
    ready: true,
    buildStep: 6,
  },
];
