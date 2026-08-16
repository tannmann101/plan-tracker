// theme.js
// Shared design tokens for Secretary. Same card-on-colored-wash family as
// the household ledger (sage wash) and The Workshop (cream + serif), so the
// three apps read as one household of tools -- but Secretary's own wash is
// a parchment ivory, its type pairing leans more formal, and its accent is
// an ink-blue rather than either sibling's teal/rust, matching its quieter,
// more old-fashioned register (see the Voice note in the project README).
//
// Every color below is a CSS custom-property reference (var(--x)), not a
// literal hex -- THEME_VARS_CSS at the bottom defines the actual light and
// dark values those variables resolve to. This is what makes dark mode a
// single-file concern: every component in the app already imports these
// names and drops them straight into inline `style={{color: INK}}` etc, so
// none of them need to change -- flipping the CSS variables' values (via
// the `data-theme` attribute -- see useTheme.js) recolors the whole app.

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
// Used for the wordmark and section headings only -- everything else stays
// sans, so the serif reads as a considered accent, not a full period pastiche.
export const SERIF = "'Source Serif 4', 'Iowan Old Style', Palatino, Georgia, serif";

export const BG = "var(--bg)";
export const CARD = "var(--card)";
export const PAGE = "var(--page)";
export const INK = "var(--ink)";
export const MUTE = "var(--mute)";
export const MUTE_SOFT = "var(--mute-soft)";
export const LINE = "var(--line)";
export const HEAD_BG = "var(--head-bg)";

// Primary accent -- an ink-blue standing in for a fountain pen, distinct
// from both sibling apps' teal/rust accents.
export const INKBLUE = "var(--inkblue)";
export const INKBLUE_SOFT = "var(--inkblue-soft)";
export const BRASS = "var(--brass)";
export const BRASS_SOFT = "var(--brass-soft)";
export const BRICK = "var(--brick)";
export const BRICK_SOFT = "var(--brick-soft)";
export const MOSS = "var(--moss)";
export const MOSS_SOFT = "var(--moss-soft)";
export const PLUM = "var(--plum)";
export const PLUM_SOFT = "var(--plum-soft)";
export const TERRACOTTA = "var(--terracotta)";
export const TERRACOTTA_SOFT = "var(--terracotta-soft)";
export const SLATE = "var(--slate)";
export const SLATE_SOFT = "var(--slate-soft)";

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
// DEEPTEAL and OCHRE are live (see DOMAIN_COLORS below); the other seven
// aren't painted anywhere today, so their dark-mode values (THEME_VARS_CSS)
// are derived with a systematic lighten rather than hand-tuned -- worth a
// closer look if one of them ever becomes a domain color.
export const WINE = "var(--wine)";
export const DEEPTEAL = "var(--deepteal)";
export const OCHRE = "var(--ochre)";
export const INDIGO = "var(--indigo)";
export const TEAL = "var(--teal)";
export const OLIVE = "var(--olive)";
export const MAGENTA_PLUM = "var(--magenta-plum)";
export const SEAGREEN = "var(--seagreen)";
export const REDBROWN = "var(--redbrown)";

export const RADIUS = 12;
export const RADIUS_SM = 8;
export const SHADOW_CARD = "var(--shadow-card)";
// Space-separated r g b channels (not a full rgba() string) so call sites
// that need a custom alpha can write `rgb(var(--shadow-rgb) / 0.28)` --
// swaps to a legible dark-mode shadow color the same way every other token
// here does, instead of a hardcoded rgba(36,34,32,...) staying pitch-black-
// on-black once the surface behind it goes dark.
export const SHADOW_RGB = "var(--shadow-rgb)";
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
// hand-authoring nine more tint variants. Mixes toward CARD rather than a
// hardcoded white so the computed tint lands correctly in dark mode too
// (CARD itself resolves to the current theme's surface color).
export const softTint = (color) => NAMED_SOFT_TINTS[color] || `color-mix(in srgb, ${color} 16%, ${CARD})`;

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

// Matches kindAttention()'s levels in src/lib/graph.js -- shared by
// EntityCard's pill/hint and Trends' Needs Attention panel so the two
// surfaces never drift into picking different colors for the same level.
export const ATTENTION_COLORS = { overdue: BRICK, attention: OCHRE };

// The actual light/dark values every var() above resolves to. Rendered
// once by GlobalStyle (ui.jsx) so it's the single place either palette is
// defined. Three states, matching useTheme.js: an explicit choice stamps
// data-theme on <html> and always wins; the default "system" state stamps
// nothing, so a bare `:root` (light) plus a `prefers-color-scheme` block
// (dark) does the deciding on its own.
export const THEME_VARS_CSS = `
  :root {
    --bg: #FFFFFF; --card: #FFFFFF; --page: #F2EEE3;
    --ink: #242220; --mute: #7C7568; --mute-soft: #A8A092;
    --line: #E4DECC; --head-bg: #EAE3D1;
    --inkblue: #2E4A5E; --inkblue-soft: #DEE6EA;
    --brass: #96702E; --brass-soft: #EFE3CC;
    --brick: #8B3A2B; --brick-soft: #F1DCD4;
    --moss: #4F6B4A; --moss-soft: #DFE6DA;
    --plum: #5B4570; --plum-soft: #E5DFEC;
    --terracotta: #9C5B3E; --terracotta-soft: #EFDDD1;
    --slate: #55606B; --slate-soft: #E1E4E7;
    --deepteal: #00667F; --ochre: #814C1A;
    --wine: #83425D; --indigo: #4C5590; --teal: #006B6B; --olive: #675B07;
    --magenta-plum: #784674; --seagreen: #006B53; --redbrown: #884249;
    --shadow-card: 0 1px 2px rgba(36,34,32,0.05), 0 8px 22px rgba(36,34,32,0.07);
    --shadow-rgb: 36 34 32;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #262219; --card: #2A2620; --page: #1B1813;
      --ink: #EDE7DA; --mute: #A79F8E; --mute-soft: #6E6656;
      --line: #45403A; --head-bg: #332E27;
      --inkblue: #7DA0B8; --inkblue-soft: #28404E;
      --brass: #C9A05C; --brass-soft: #4A3A20;
      --brick: #C97A68; --brick-soft: #4A2620;
      --moss: #8AAE82; --moss-soft: #2C3B27;
      --plum: #9E85B8; --plum-soft: #362B44;
      --terracotta: #D0916E; --terracotta-soft: #4A2E1E;
      --slate: #98A3AD; --slate-soft: #333A40;
      --deepteal: #4FA8C2; --ochre: #C98A4E;
      --wine: color-mix(in oklch, #83425D 65%, white); --indigo: color-mix(in oklch, #4C5590 65%, white);
      --teal: color-mix(in oklch, #006B6B 65%, white); --olive: color-mix(in oklch, #675B07 65%, white);
      --magenta-plum: color-mix(in oklch, #784674 65%, white); --seagreen: color-mix(in oklch, #006B53 65%, white);
      --redbrown: color-mix(in oklch, #884249 65%, white);
      --shadow-card: 0 1px 2px rgba(0,0,0,0.4), 0 8px 22px rgba(0,0,0,0.35);
      --shadow-rgb: 0 0 0;
    }
  }
  :root[data-theme="dark"] {
    --bg: #262219; --card: #2A2620; --page: #1B1813;
    --ink: #EDE7DA; --mute: #A79F8E; --mute-soft: #6E6656;
    --line: #45403A; --head-bg: #332E27;
    --inkblue: #7DA0B8; --inkblue-soft: #28404E;
    --brass: #C9A05C; --brass-soft: #4A3A20;
    --brick: #C97A68; --brick-soft: #4A2620;
    --moss: #8AAE82; --moss-soft: #2C3B27;
    --plum: #9E85B8; --plum-soft: #362B44;
    --terracotta: #D0916E; --terracotta-soft: #4A2E1E;
    --slate: #98A3AD; --slate-soft: #333A40;
    --deepteal: #4FA8C2; --ochre: #C98A4E;
    --wine: color-mix(in oklch, #83425D 65%, white); --indigo: color-mix(in oklch, #4C5590 65%, white);
    --teal: color-mix(in oklch, #006B6B 65%, white); --olive: color-mix(in oklch, #675B07 65%, white);
    --magenta-plum: color-mix(in oklch, #784674 65%, white); --seagreen: color-mix(in oklch, #006B53 65%, white);
    --redbrown: color-mix(in oklch, #884249 65%, white);
    --shadow-card: 0 1px 2px rgba(0,0,0,0.4), 0 8px 22px rgba(0,0,0,0.35);
    --shadow-rgb: 0 0 0;
  }
`;
