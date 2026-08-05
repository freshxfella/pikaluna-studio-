export type StageId = "copy" | "images" | "video" | "voice" | "montage";
export type StageStatus = "empty" | "busy" | "done";

export interface StageDef {
  id: StageId;
  label: string;
  blurb: string;
  ready: boolean; // wired to a real backend yet?
  buildStep: number; // which step of this rebuild delivers it
}

// The product IS this sequence, so the rail is honest structure, not decoration.
export const STAGES: StageDef[] = [
  {
    id: "copy",
    label: "Besedilo",
    blurb: "Iz opisa izdelka ustvari oglasno besedilo v izbranih jezikih.",
    ready: false,
    buildStep: 4,
  },
  {
    id: "images",
    label: "Slike",
    blurb: "Ustvari prizore za oglas — tri ključne slike, ki poganjajo video.",
    ready: false,
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
];
