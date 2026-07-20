// theme.js
// Shared design tokens for the whole app -- single source of truth so every
// view renders as one consistent, professional system instead of independently
// drifting inline style sheets. Neutrals match the household ledger app's
// palette; domain accent colors are unique to this app's six domain tags.

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";

export const BG = "#FFFFFF";
export const CARD = "#FFFFFF";
export const PAGE = "#F5F5F1";
export const INK = "#181A17";
export const MUTE = "#68685F";
export const MUTE_SOFT = "#9A9A90";
export const LINE = "#E3E2D9";
export const HEAD_BG = "#F1F0E9";

export const TEAL = "#1F5C4F";
export const TEAL_SOFT = "#E2EEE9";
export const BRICK = "#A23F2A";
export const BRICK_SOFT = "#F4E4DE";
export const GOLD = "#8C6410";
export const GOLD_SOFT = "#F1E7D0";

export const RADIUS = 10;
export const RADIUS_SM = 7;
export const SHADOW_CARD = "0 1px 2px rgba(24,26,23,0.05), 0 6px 20px rgba(24,26,23,0.06)";
export const TRANSITION = "120ms ease";

export const softTint = (color) => {
  if (color === TEAL) return TEAL_SOFT;
  if (color === BRICK) return BRICK_SOFT;
  if (color === GOLD) return GOLD_SOFT;
  if (color === BLUE) return BLUE_SOFT;
  if (color === PURPLE) return PURPLE_SOFT;
  if (color === OLIVE) return OLIVE_SOFT;
  return HEAD_BG;
};

// Domain accent colors -- one per domain tag, distinct from status colors below.
export const BLUE = "#2E6E8E";
export const BLUE_SOFT = "#E1EBF0";
export const PURPLE = "#6B4FA0";
export const PURPLE_SOFT = "#EAE4F3";
export const OLIVE = "#5C6B2C";
export const OLIVE_SOFT = "#E7EAD9";

export const DOMAIN_COLORS = {
  financial: TEAL,
  material: GOLD,
  "health-fitness": BLUE,
  "vocational-career": PURPLE,
  relational: BRICK,
  chores: OLIVE,
  "cross-domain": MUTE,
  other: MUTE,
};

// Status colors -- each status gets its own hue so a stacked/legend chart
// (Overview's status mix) can tell all six apart at a glance; ItemRow's
// delete button also keys off STATUS_COLORS.dropped.
export const STATUS_COLORS = {
  open: MUTE_SOFT,
  "in-progress": TEAL,
  scheduled: BLUE,
  "needs-review": GOLD,
  done: INK,
  dropped: BRICK,
};
