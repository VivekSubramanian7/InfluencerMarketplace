// Gallery Frame color engine: every creator gets a deterministic duotone
// gradient derived from their handle — their identity color until real video
// thumbnails exist (DESIGN.md). Pure function; same handle always yields the
// same gradient, on server and client alike.

export interface CreatorGradient {
  from: string;
  to: string;
  /** ready-to-use CSS background value */
  css: string;
  /** the darker stop — safe backdrop for white text chips */
  deep: string;
}

const PAIRS: Array<[string, string]> = [
  ["#4A7A74", "#C8A87C"], // dusty teal → warm sand
  ["#6E4A62", "#C99AA6"], // plum → rose
  ["#46586E", "#9FB6C9"], // slate → sky
  ["#5A6E46", "#B9C99A"], // moss → cream lime
  ["#8A5A46", "#C9A18F"], // clay → peach
  ["#4A4E7A", "#A6A8C9"], // indigo → lavender
  ["#3F6653", "#9AC9B4"], // forest → mint
  ["#3D3A35", "#C9B27C"], // charcoal → gold
];

export function creatorGradient(handle: string): CreatorGradient {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) >>> 0;
  }
  const [from, to] = PAIRS[hash % PAIRS.length];
  const angle = 105 + (hash % 40); // 105-144deg: varied but always downhill-right
  return {
    from,
    to,
    deep: from,
    css: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
  };
}
