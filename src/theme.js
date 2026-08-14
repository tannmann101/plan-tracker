// theme.js
// Shared design tokens for Secretary. Same card-on-colored-wash family as
// the household ledger (sage wash) and The Workshop (cream + serif), so the
// three apps read as one household of tools -- but Secretary's own wash is
// a parchment ivory, its type pairing leans more formal, and its accent is
// an ink-blue rather than either sibling's teal/rust, matching its quieter,
// more old-fashioned register (see the Voice note in the project README).

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
// Used for the wordmark and section headings only -- everything else stays
// sans, so the serif reads as a considered accent, not a full period pastiche.
export const SERIF = "'Source Serif 4', 'Iowan Old Style', Palatino, Georgia, serif";

export const BG = "#FFFFFF";
export const CARD = "#FFFFFF";
export const PAGE = "#F2EEE3";
export const INK = "#242220";
export const MUTE = "#7C7568";
export const MUTE_SOFT = "#A8A092";
export const LINE = "#E4DECC";
export const HEAD_BG = "#EAE3D1";

// Primary accent -- an ink-blue standing in for a fountain pen, distinct
// from both sibling apps' teal/rust accents.
export const INKBLUE = "#2E4A5E";
export const INKBLUE_SOFT = "#DEE6EA";
export const BRASS = "#96702E";
export const BRASS_SOFT = "#EFE3CC";
export const BRICK = "#8B3A2B";
export const BRICK_SOFT = "#F1DCD4";
export const MOSS = "#4F6B4A";
export const MOSS_SOFT = "#DFE6DA";
export const PLUM = "#5B4570";
export const PLUM_SOFT = "#E5DFEC";
export const TERRACOTTA = "#9C5B3E";
export const TERRACOTTA_SOFT = "#EFDDD1";
export const SLATE = "#55606B";
export const SLATE_SOFT = "#E1E4E7";

export const RADIUS = 12;
export const RADIUS_SM = 8;
export const SHADOW_CARD = "0 1px 2px rgba(36,34,32,0.05), 0 8px 22px rgba(36,34,32,0.07)";
export const TRANSITION = "130ms ease";

export const softTint = (color) => {
  if (color === INKBLUE) return INKBLUE_SOFT;
  if (color === BRASS) return BRASS_SOFT;
  if (color === BRICK) return BRICK_SOFT;
  if (color === MOSS) return MOSS_SOFT;
  if (color === PLUM) return PLUM_SOFT;
  if (color === TERRACOTTA) return TERRACOTTA_SOFT;
  if (color === SLATE) return SLATE_SOFT;
  return HEAD_BG;
};

// One accent per domain -- distinct from the lifecycle-status palette below
// so a domain pill never reads as a status pill.
export const DOMAIN_COLORS = {
  finances: MOSS,
  material: BRASS,
  teacher: PLUM,
  "tech-admin": SLATE,
  catchall: TERRACOTTA,
};

export const STATUS_COLORS = {
  active: INKBLUE,
  done: MOSS,
  dropped: MUTE,
};

// Tier accents for the Goals tree -- coarsest (yearly) to finest (weekly),
// reusing the domain/status palette rather than adding a fourth hue family.
export const TIER_COLORS = {
  yearly: INKBLUE,
  quarterly: PLUM,
  monthly: BRASS,
  weekly: MOSS,
};
