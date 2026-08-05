"use client";

// Skupni nabor oblikovanja — samo možnosti, ki jih Creatomate res podpira.
// Uporabljajo ga Overlay, Podnapisi in Montaža, da je slog povsod enak.

export interface TextStyle {
  font: string;
  size: number; // vmin (relativno)
  weight: string;
  color: string;
  effect: string; // none | box | outline | shadow
  effectColor: string;
  animation: string; // none | fade | slide-up | slide-down | slide-left | slide-right | scale | wipe
  animationSpeed: number; // sekunde
}

// Fonti, ki so v Creatomate na voljo (varen izbor).
export const FONTS = [
  "Montserrat",
  "Open Sans",
  "Roboto",
  "Poppins",
  "Oswald",
  "Raleway",
  "Bebas Neue",
  "Anton",
  "Lato",
  "Inter",
  "Playfair Display",
  "Archivo",
];

export const WEIGHTS = [
  { id: "400", label: "navadno" },
  { id: "600", label: "polkrepko" },
  { id: "700", label: "krepko" },
  { id: "800", label: "zelo krepko" },
  { id: "900", label: "črno" },
];

export const EFFECTS = [
  { id: "none", label: "brez" },
  { id: "box", label: "obarvana podlaga" },
  { id: "outline", label: "obroba" },
  { id: "shadow", label: "senca" },
];

// Animacije, ki jih Creatomate podpira (type v "animations" polju).
export const ANIMATIONS = [
  { id: "none", label: "brez" },
  { id: "fade", label: "zatemnitev (fade)" },
  { id: "slide-up", label: "zdrs navzgor" },
  { id: "slide-down", label: "zdrs navzdol" },
  { id: "slide-left", label: "zdrs levo" },
  { id: "slide-right", label: "zdrs desno" },
  { id: "scale", label: "pojav (pop / scale)" },
  { id: "wipe", label: "razkritje (wipe)" },
];

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: "Montserrat",
  size: 7,
  weight: "700",
  color: "#ffffff",
  effect: "box",
  effectColor: "#000000",
  animation: "fade",
  animationSpeed: 0.3,
};

// Pretvori naš slog v Creatomate lastnosti elementa (za modifikacije/RenderScript).
export function styleToCreatomate(s: TextStyle): Record<string, unknown> {
  const out: Record<string, unknown> = {
    font_family: s.font,
    font_weight: s.weight,
    font_size: s.size + " vmin",
    fill_color: s.color,
  };
  if (s.effect === "box") {
    out.background_color = hexWithAlpha(s.effectColor, 0.8);
    out.background_x_padding = "26%";
    out.background_y_padding = "18%";
  } else if (s.effect === "outline") {
    out.stroke_color = s.effectColor;
    out.stroke_width = "0.5 vmin";
  } else if (s.effect === "shadow") {
    out.shadow_color = hexWithAlpha(s.effectColor, 0.6);
    out.shadow_blur = "1.5 vmin";
    out.shadow_x = "0.4 vmin";
    out.shadow_y = "0.4 vmin";
  }
  const anim = animationToCreatomate(s.animation, s.animationSpeed);
  if (anim) out.animations = [anim];
  return out;
}

// Preslika našo animacijo v Creatomate keyframe.
export function animationToCreatomate(
  animation: string,
  speed: number
): Record<string, unknown> | null {
  if (!animation || animation === "none") return null;
  const base = { time: "start", duration: speed || 0.3, easing: "quadratic-out" as const };
  switch (animation) {
    case "fade":
      return { ...base, type: "fade" };
    case "slide-up":
      return { ...base, type: "slide", direction: "up" };
    case "slide-down":
      return { ...base, type: "slide", direction: "down" };
    case "slide-left":
      return { ...base, type: "slide", direction: "left" };
    case "slide-right":
      return { ...base, type: "slide", direction: "right" };
    case "scale":
      return { ...base, type: "scale", scope: "element" };
    case "wipe":
      return { ...base, type: "wipe" };
    default:
      return { ...base, type: "fade" };
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  // #rrggbb -> rgba(r,g,b,a)
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Vrstica kontrol za oblikovanje.
export function StyleControls({
  style,
  onChange,
  compact,
}: {
  style: TextStyle;
  onChange: (patch: Partial<TextStyle>) => void;
  compact?: boolean;
}) {
  return (
    <div className="style-grid">
      <label className="mini-field">
        <span>Font</span>
        <select className="select" value={style.font} onChange={(e) => onChange({ font: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </label>
      <label className="mini-field">
        <span>Debelina</span>
        <select className="select" value={style.weight} onChange={(e) => onChange({ weight: e.target.value })}>
          {WEIGHTS.map((w) => (
            <option key={w.id} value={w.id}>{w.label}</option>
          ))}
        </select>
      </label>
      <label className="mini-field">
        <span>Velikost</span>
        <input
          className="input input--mini"
          type="number"
          min={2}
          max={20}
          step={0.5}
          value={style.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
        />
      </label>
      <label className="mini-field">
        <span>Barva</span>
        <input className="input input--mini" type="color" value={style.color} onChange={(e) => onChange({ color: e.target.value })} />
      </label>
      <label className="mini-field">
        <span>Efekt</span>
        <select className="select" value={style.effect} onChange={(e) => onChange({ effect: e.target.value })}>
          {EFFECTS.map((x) => (
            <option key={x.id} value={x.id}>{x.label}</option>
          ))}
        </select>
      </label>
      {style.effect !== "none" && (
        <label className="mini-field">
          <span>Barva efekta</span>
          <input className="input input--mini" type="color" value={style.effectColor} onChange={(e) => onChange({ effectColor: e.target.value })} />
        </label>
      )}
      <label className="mini-field">
        <span>Animacija</span>
        <select className="select" value={style.animation} onChange={(e) => onChange({ animation: e.target.value })}>
          {ANIMATIONS.map((x) => (
            <option key={x.id} value={x.id}>{x.label}</option>
          ))}
        </select>
      </label>
      {style.animation !== "none" && (
        <label className="mini-field">
          <span>Hitrost (s)</span>
          <input
            className="input input--mini"
            type="number"
            min={0.1}
            max={3}
            step={0.1}
            value={style.animationSpeed}
            onChange={(e) => onChange({ animationSpeed: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}
