/**
 * Resolved color/material tokens for timeline track, cards, and indicator.
 *
 * This theme is intentionally narrow: it supports safe visual variation,
 * primarily around palette choices within the established glass treatment.
 * Typography and layout geometry stay fixed in the presentation components so
 * feature-level overrides cannot accidentally break composition.
 *
 * Outline color is a deliberately exposed escape hatch for legibility tuning.
 * With great power comes great responsibility: only change the hue or opacity
 * when you have a clear readability reason, and avoid garish colors that fight
 * the text or icon foreground they are meant to support.
 *
 * Guidance for dark themes:
 * - On very dark backgrounds, no outline is often best. Prefer high-contrast
 *   foreground colors for text and especially for small text/icons.
 * - On moderately dark backgrounds, a very slight outline can help separate
 *   text from glass or gradient surfaces without turning into a neon glow.
 *
 * Features may override `BASE_TIMELINE_VISUAL_THEME` via
 * `createTimelineVisualTheme` without duplicating nested merge logic.
 */
export type TimelineVisualTheme = {
  glassColor: string;
  glassBorderColor: string;
  track: {
    completedColor: string;
    remainingColor: string;
  };
  cards: {
    borderWidth: number;
  };
  text: {
    terminalNameColor: string;
    indicatorHeadlineColor: string;
    bodyColor: string;
  };
  outlines: {
    /**
     * Shared outline color used behind timeline text and time icons.
     *
     * This should stay close to the foreground family and is primarily for
     * legibility. Treat it as a high-sensitivity token: adjust sparingly.
     * Very dark themes often want `none` or near-none opacity here.
     */
    color: string;
  };
  marker: {
    accentColor: string;
    contrastColor: string;
  };
  indicator: {
    borderColor: string;
    pingColor: string;
  };
};

export type TimelineVisualThemeOverrides = {
  [Section in keyof TimelineVisualTheme]?: Partial<
    TimelineVisualTheme[Section]
  >;
};

export const TIMELINE_RENDER_CONSTANTS = {
  track: {
    coreWidthPx: 3,
    glowWidthPx: 8,
  },
  cards: {
    blurIntensity: 20,
    /** Fixed card blur material; not per-theme (see `TimelineTerminalCardBackgrounds`). */
    blurTint: "light" as const,
  },
  indicator: {
    glassBlurIntensity: 20,
  },
} as const;

export const DEFAULT_TIMELINE_OUTLINE_COLOR = "hsla(0, 0%, 100%, 0.8)";
export const DEFAULT_TIMELINE_GLASS_COLOR = "hsla(0, 0%, 100%, 0.3)";
export const DEFAULT_TIMELINE_GLASS_BORDER_COLOR = "hsla(0, 0%, 100%, 0.8)";

export const SEA_GLASS_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  glassColor: DEFAULT_TIMELINE_GLASS_COLOR,
  glassBorderColor: DEFAULT_TIMELINE_GLASS_BORDER_COLOR,
  track: {
    completedColor: "hsla(187, 73%, 58%, 1)",
    remainingColor: "hsla(210, 35%, 100%, 0.66)",
  },
  cards: {
    borderWidth: 1,
  },
  text: {
    terminalNameColor: "hsla(194, 69%, 65%, 1)",
    indicatorHeadlineColor: "hsla(207, 37%, 28%, 1)",
    bodyColor: "hsla(207, 37%, 28%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    accentColor: "hsla(190, 74%, 42%, 1)",
    contrastColor: "hsla(0, 0%, 100%, 0.92)",
  },
  indicator: {
    borderColor: "hsla(189, 70%, 73%, 1)",
    pingColor: "hsla(189, 70%, 73%, 0.52)",
  },
};

export const HARBOR_DAWN_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  glassColor: DEFAULT_TIMELINE_GLASS_COLOR,
  glassBorderColor: DEFAULT_TIMELINE_GLASS_BORDER_COLOR,
  track: {
    completedColor: "hsla(17, 88%, 69%, 1)",
    remainingColor: "hsla(36, 65%, 96%, 0.72)",
  },
  cards: {
    borderWidth: 1,
  },
  text: {
    terminalNameColor: "hsla(14, 88%, 71%, 1)",
    indicatorHeadlineColor: "hsla(24, 34%, 30%, 1)",
    bodyColor: "hsla(24, 34%, 30%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    accentColor: "hsla(14, 80%, 59%, 1)",
    contrastColor: "hsla(0, 0%, 100%, 0.92)",
  },
  indicator: {
    borderColor: "hsla(22, 88%, 76%, 1)",
    pingColor: "hsla(22, 88%, 76%, 0.48)",
  },
};

export const CARNIVAL_FIZZ_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  glassColor: DEFAULT_TIMELINE_GLASS_COLOR,
  glassBorderColor: DEFAULT_TIMELINE_GLASS_BORDER_COLOR,
  track: {
    completedColor: "hsla(24, 96%, 62%, 1)",
    remainingColor: "hsla(194, 78%, 97%, 0.72)",
  },
  cards: {
    borderWidth: 1,
  },
  text: {
    terminalNameColor: "hsla(21, 94%, 63%, 1)",
    indicatorHeadlineColor: "hsla(205, 34%, 29%, 1)",
    bodyColor: "hsla(205, 34%, 29%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    accentColor: "hsla(24, 96%, 62%, 1)",
    contrastColor: "hsla(0, 0%, 100%, 0.94)",
  },
  indicator: {
    borderColor: "hsla(33, 100%, 74%, 0.9)",
    pingColor: "hsla(33, 100%, 74%, 0.48)",
  },
};

export const TAFFY_HARBOR_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  glassColor: "hsla(0, 0%, 100%, 0.34)",
  glassBorderColor: DEFAULT_TIMELINE_GLASS_BORDER_COLOR,
  track: {
    completedColor: "hsla(330, 79%, 68%, 1)",
    remainingColor: "hsla(219, 72%, 98%, 0.74)",
  },
  cards: {
    borderWidth: 1,
  },
  text: {
    terminalNameColor: "hsla(322, 73%, 66%, 1)",
    indicatorHeadlineColor: "hsla(229, 24%, 32%, 1)",
    bodyColor: "hsla(229, 24%, 32%, 1)",
  },
  outlines: {
    color: "hsla(0, 0%, 100%, 0.7)",
  },
  marker: {
    accentColor: "hsla(330, 79%, 68%, 1)",
    contrastColor: "hsla(0, 0%, 100%, 0.94)",
  },
  indicator: {
    borderColor: "hsla(327, 82%, 77%, 1)",
    pingColor: "hsla(327, 82%, 77%, 0.44)",
  },
};

export const CONFETTI_TIDE_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  glassColor: "hsla(0, 0%, 100%, 0.33)",
  glassBorderColor: DEFAULT_TIMELINE_GLASS_BORDER_COLOR,
  track: {
    completedColor: "hsla(197, 82%, 57%, 1)",
    remainingColor: "hsla(201, 79%, 98%, 0.74)",
  },
  cards: {
    borderWidth: 1,
  },
  text: {
    terminalNameColor: "hsla(198, 80%, 57%, 1)",
    indicatorHeadlineColor: "hsla(223, 28%, 29%, 1)",
    bodyColor: "hsla(223, 28%, 29%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    accentColor: "hsla(11, 86%, 65%, 1)",
    contrastColor: "hsla(0, 0%, 100%, 0.94)",
  },
  indicator: {
    borderColor: "hsla(198, 83%, 70%, 0.9)",
    pingColor: "hsla(198, 83%, 70%, 0.44)",
  },
};

export const MOON_JELLY_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  glassColor: "hsla(0, 0%, 100%, 0.28)",
  glassBorderColor: DEFAULT_TIMELINE_GLASS_BORDER_COLOR,
  track: {
    completedColor: "hsla(267, 79%, 70%, 1)",
    remainingColor: "hsla(225, 56%, 96%, 0.7)",
  },
  cards: {
    borderWidth: 1,
  },
  text: {
    terminalNameColor: "hsla(271, 78%, 72%, 1)",
    indicatorHeadlineColor: "hsla(226, 24%, 31%, 1)",
    bodyColor: "hsla(226, 24%, 31%, 1)",
  },
  outlines: {
    color: "hsla(0, 0%, 100%, 0.72)",
  },
  marker: {
    accentColor: "hsla(267, 79%, 70%, 1)",
    contrastColor: "hsla(0, 0%, 100%, 0.94)",
  },
  indicator: {
    borderColor: "hsla(266, 83%, 79%, 0.9)",
    pingColor: "hsla(266, 83%, 79%, 0.42)",
  },
};

export const PICNIC_POSTCARD_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  glassColor: "hsla(0, 0%, 100%, 0.32)",
  glassBorderColor: DEFAULT_TIMELINE_GLASS_BORDER_COLOR,
  track: {
    completedColor: "hsla(356, 86%, 64%, 1)",
    remainingColor: "hsla(90, 48%, 95%, 0.74)",
  },
  cards: {
    borderWidth: 1,
  },
  text: {
    terminalNameColor: "hsla(356, 79%, 64%, 1)",
    indicatorHeadlineColor: "hsla(29, 24%, 29%, 1)",
    bodyColor: "hsla(29, 24%, 29%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    accentColor: "hsla(356, 86%, 64%, 1)",
    contrastColor: "hsla(0, 0%, 100%, 0.94)",
  },
  indicator: {
    borderColor: "hsla(356, 84%, 76%, 0.9)",
    pingColor: "hsla(356, 84%, 76%, 0.42)",
  },
};

export const BASE_TIMELINE_VISUAL_THEME = SEA_GLASS_TIMELINE_VISUAL_THEME;

/**
 * Merges optional theme overrides into the base timeline visual theme.
 *
 * This intentionally merges only the exposed color/material token surface.
 * Glass behavior and layout are fixed by the components. Outline color is the
 * one high-sensitivity legibility token exposed here, and should be changed
 * only with care.
 *
 * @param overrides - Partial overrides per theme section
 * @returns A complete `TimelineVisualTheme` safe for presentation components
 */
export const createTimelineVisualTheme = (
  overrides: TimelineVisualThemeOverrides = {}
): TimelineVisualTheme => ({
  ...BASE_TIMELINE_VISUAL_THEME,
  ...overrides,
  glassColor: overrides.glassColor ?? BASE_TIMELINE_VISUAL_THEME.glassColor,
  glassBorderColor:
    overrides.glassBorderColor ?? BASE_TIMELINE_VISUAL_THEME.glassBorderColor,
  track: {
    ...BASE_TIMELINE_VISUAL_THEME.track,
    ...overrides.track,
  },
  cards: {
    ...BASE_TIMELINE_VISUAL_THEME.cards,
    ...overrides.cards,
  },
  text: {
    ...BASE_TIMELINE_VISUAL_THEME.text,
    ...overrides.text,
  },
  outlines: {
    ...BASE_TIMELINE_VISUAL_THEME.outlines,
    ...overrides.outlines,
  },
  marker: {
    ...BASE_TIMELINE_VISUAL_THEME.marker,
    ...overrides.marker,
  },
  indicator: {
    ...BASE_TIMELINE_VISUAL_THEME.indicator,
    ...overrides.indicator,
  },
});
