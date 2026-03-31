// Art pane dimensions — must match CardPreview clip container
export const ART_W = 294;
export const ART_H = 157;

export const TYPES        = ["Predator", "Mother", "Defense", "Flying", "Water"];
export const SIZES        = ["Tiny", "Small", "Medium", "Large", "Giant"];
export const COSTS        = ["0", "1", "2", "Basic", "Habitat"];
export const BONUS_OPTIONS = ["Nest", "Egg", "Predator", "Move", "Draw", "Claim", "Copy"];
export const PREFIXES     = ["Before Battle:", "After Battle:", "Special:", "Reaction:", "Ongoing:"];

/** Scale needed so a contained image fills (covers) the art pane. */
export function coverScale(naturalW, naturalH) {
  const r = naturalW / naturalH;
  const R = ART_W / ART_H;
  return r >= R ? (ART_H * r) / ART_W : ART_W / (ART_H * r);
}

/** Max safe pan offsets so image content never leaves the art pane. */
export function maxOffsets(naturalW, naturalH, scale) {
  const r = naturalW / naturalH;
  const R = ART_W / ART_H;
  const contentW = r >= R ? ART_W : ART_H * r;
  const contentH = r >= R ? ART_W / r : ART_H;
  return {
    maxX: Math.max(0, Math.floor((contentW * scale - ART_W) / 2)),
    maxY: Math.max(0, Math.floor((contentH * scale - ART_H) / 2)),
  };
}
