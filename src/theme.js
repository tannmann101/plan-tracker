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

// Nine more hues for the expanded (15-domain) categorical set, generated at
// the same OKLCH lightness/chroma band as the seven above (L~0.47-0.57,
// C~0.09-0.10) so they read as one family rather than a bolted-on palette.
// Note on accessibility: this app's whole existing palette (BRASS/MOSS/PLUM/
// etc.) sits below the chroma floor a chart-grade categorical palette would
// need (verified against the dataviz skill's validator) -- it was built
// deliberately muted for UI accents that are always paired with a text
// label (a domain Pill always shows the domain name), which the skill's own
// checks scope to chart series identity, not label-paired UI tagging. These
// nine follow that same established register rather than breaking it.
export const WINE = "#83425D";
export const DEEPTEAL = "#00667F";
export const OCHRE = "#814C1A";
export const INDIGO = "#4C5590";
export const TEAL = "#006B6B";
export const OLIVE = "#675B07";
export const MAGENTA_PLUM = "#784674";
export const SEAGREEN = "#006B53";
export const REDBROWN = "#884249";

export const RADIUS = 12;
export const RADIUS_SM = 8;
export const SHADOW_CARD = "0 1px 2px rgba(36,34,32,0.05), 0 8px 22px rgba(36,34,32,0.07)";
export const TRANSITION = "130ms ease";

const NAMED_SOFT_TINTS = {
  [INKBLUE]: INKBLUE_SOFT,
  [BRASS]: BRASS_SOFT,
  [BRICK]: BRICK_SOFT,
  [MOSS]: MOSS_SOFT,
  [PLUM]: PLUM_SOFT,
  [TERRACOTTA]: TERRACOTTA_SOFT,
  [SLATE]: SLATE_SOFT,
};

// Falls back to a computed tint (via CSS color-mix) for any color without a
// hand-picked _SOFT pair -- covers the nine new categorical hues without
// hand-authoring nine more near-white variants.
export const softTint = (color) => NAMED_SOFT_TINTS[color] || `color-mix(in srgb, ${color} 16%, white)`;

// One accent per domain -- distinct from the lifecycle-status palette below
// so a domain pill never reads as a status pill. Order matches
// DEFAULT_DOMAINS in src/constants.js. Picked as the 7 most distinct hues
// from the larger palette built up for the old 15-domain set rather than
// inventing new colors -- WINE/INDIGO/TEAL/OLIVE/MAGENTA_PLUM/SEAGREEN/
// REDBROWN/BRICK are no longer referenced here but stay defined above in
// case a future domain needs one.
export const DOMAIN_COLORS = {
  creative: PLUM,
  vocation: SLATE,
  education: BRASS,
  "head-of-household": MOSS,
  projects: TERRACOTTA,
  practices: DEEPTEAL,
  goals: OCHRE,
};

// Matches KIND_STATUSES in src/constants.js -- the Plans kanban's column
// accents, reused wherever a Kind's status shows as a pill.
export const STATUS_COLORS = {
  "not-started": MUTE,
  queued: SLATE,
  "in-progress": INKBLUE,
  "almost-done": BRASS,
  done: MOSS,
};
