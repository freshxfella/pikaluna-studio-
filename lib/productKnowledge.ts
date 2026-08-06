// Vgrajena baza trikov za generiranje slik po tipu produkta.
// To je Inino znanje iz prakse — kaj mora AI paziti pri vsakem kosu.
// Feature-first pristop: povej, KAJ prikazati, ne samo "naredi lepo pozo".

export interface ProductType {
  id: string;
  label: string;
  emoji: string;
  tips: string[]; // opozorila / navodila, ki gredo v prompt
  features: string[]; // predlogi "feature-first" poudarkov
}

export const PRODUCT_TYPES: ProductType[] = [
  {
    id: "blazer",
    label: "Blazer",
    emoji: "🧥",
    tips: [
      "explicitly state whether the blazer is buttoned or unbuttoned",
      "rolled/pushed-up sleeves are not assumed — state them explicitly if wanted",
      "hands must not cover the lapels or buttons",
      "upper-body crop works much better than a plain close-up",
    ],
    features: ["emphasize blazer tailoring", "highlight sleeve construction", "show fabric drape"],
  },
  {
    id: "pants",
    label: "Hlače",
    emoji: "👖",
    tips: [
      "a hand in the pocket shows the cut nicely",
      "crop from waist to knees is better than showing only the waist",
      "for the back view, explicitly write 'hips pushed back' or a straight standing pose",
    ],
    features: ["emphasize waistband", "show fabric drape", "demonstrate stretch"],
  },
  {
    id: "skort",
    label: "Skort",
    emoji: "🩳",
    tips: [
      "the AI struggles with the wrap construction — be very explicit",
      "do NOT lift the skirt, do NOT flip the wrap, do NOT hide the inner shorts",
      "keep the wrap closed and flat; show the front wrap clearly",
      "expect to experiment a little with these pieces",
    ],
    features: ["showcase wrap construction", "keep wrap closed and flat"],
  },
  {
    id: "hoodie",
    label: "Hoodie",
    emoji: "🧥",
    tips: [
      "both hands in the kangaroo pocket works best",
      "or one hand in pocket + other hand on the sleeve",
      "pocket details without a face also work well",
    ],
    features: ["reveal pocket functionality", "highlight sleeve construction", "show fabric drape"],
  },
  {
    id: "leggings",
    label: "Pajkice",
    emoji: "🩱",
    tips: [
      "poses must be expressive enough — plain poses look flat",
      "use: hips pushed back, hip pop, glute contour, lower back arch, one knee bent",
    ],
    features: ["demonstrate stretch", "glute contour", "emphasize waistband"],
  },
  {
    id: "phone-pocket",
    label: "Žep za telefon",
    emoji: "📱",
    tips: [
      "'phone pocket' alone is not enough",
      "show a phone being inserted, or a phone already in the pocket",
    ],
    features: ["reveal pocket functionality", "show phone in pocket"],
  },
  {
    id: "footwear",
    label: "Obutev",
    emoji: "👟",
    tips: [
      "explicitly state the footwear (e.g. heels or sneakers)",
      "if not stated, the AI invents something unrelated",
    ],
    features: ["showcase footwear clearly"],
  },
  {
    id: "top",
    label: "Zgornji del (splošno)",
    emoji: "👕",
    tips: [
      "upper-body crop usually works better than a full close-up",
      "hands should not cover key construction details",
    ],
    features: ["highlight construction", "show fabric drape"],
  },
];

// Skupno ozadje in globalna pravila, ki veljajo za vse kose.
export const GLOBAL_IMAGE_RULES = [
  "clean seamless studio background (light grey #F0F0F0), completely plain, consistent across all images",
  "no textures, no lifestyle backgrounds",
  "feature-first: state what to show (emphasize/highlight/demonstrate/reveal), not just 'nice pose'",
];

// Sestavi feature-first prompt iz vseh vhodov.
export function buildProductPrompt(opts: {
  productData: string; // iz CSV / paste
  photoAnalysis: string; // Claude vision opis (lahko prazno)
  typeIds: string[]; // izbrani tipi
  extra: string; // uporabnikove posebnosti
  scene: string; // opis prizora (kaj naj bo na sliki)
}): string {
  const types = PRODUCT_TYPES.filter((t) => opts.typeIds.includes(t.id));
  const tips = types.flatMap((t) => t.tips);
  const features = types.flatMap((t) => t.features);

  const lines: string[] = [];
  lines.push("Generate a professional product photo for a women's activewear e-commerce brand.");
  lines.push("");
  if (opts.scene.trim()) {
    lines.push("Scene: " + opts.scene.trim());
    lines.push("");
  }
  if (opts.productData.trim()) {
    lines.push("Product data:");
    lines.push(opts.productData.trim());
    lines.push("");
  }
  if (opts.photoAnalysis.trim()) {
    lines.push("Product details (from reference photo):");
    lines.push(opts.photoAnalysis.trim());
    lines.push("");
  }
  if (features.length) {
    lines.push("Emphasize (feature-first): " + Array.from(new Set(features)).join(", ") + ".");
  }
  if (tips.length) {
    lines.push("Important construction/pose notes:");
    for (const t of Array.from(new Set(tips))) lines.push("- " + t);
    lines.push("");
  }
  if (opts.extra.trim()) {
    lines.push("Additional notes: " + opts.extra.trim());
    lines.push("");
  }
  lines.push("Global rules:");
  for (const r of GLOBAL_IMAGE_RULES) lines.push("- " + r);

  return lines.join("\n");
}
