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
export type TimelineIndicatorPingTheme = {
  insetPx: number;
  borderWidth: number;
  peakOpacity: number;
  borderColor: string;
  fillColor?: string;
};

export type TimelineVisualTheme = {
  track: {
    completedColor: string;
    completedGlowColor: string;
    remainingColor: string;
  };
  cards: {
    /** Backdrop blur material; not the same as `fillColor` (inner view only). */
    blurTint: "clear" | "light" | "dark" | "default";
    /** Inner overlay on top of blur; use transparent for tint from `blurTint` only. */
    fillColor: string;
    borderWidth: number;
  };
  labels: {
    terminalNameColor: string;
    eventLabelColor: string;
  };
  times: {
    textColor: string;
    iconColor: string;
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
    pastFillColor: string;
    pastBorderColor: string;
    futureFillColor: string;
    futureBorderColor: string;
    pastIconTintColor: string;
    futureIconTintColor: string;
  };
  indicator: {
    badgeLabelColor: string;
    bannerTitleColor: string;
    bannerSubtitleColor: string;
    borderColor: string;
    /** Ping colors may vary, but the glass treatment remains fixed. */
    ping: TimelineIndicatorPingTheme;
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
  },
  indicator: {
    glassBlurIntensity: 8,
  },
} as const;

export const DEFAULT_TIMELINE_OUTLINE_COLOR = "hsla(0, 0%, 100%, 0.75)";

export const SEA_GLASS_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(187, 73%, 58%, 1)",
    completedGlowColor: "hsla(187, 83%, 68%, 0.95)",
    remainingColor: "hsla(210, 35%, 100%, 0.66)",
  },
  cards: {
    blurTint: "light",
    fillColor: "hsla(200, 55%, 96%, 0.18)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(194, 69%, 65%, 1)",
    eventLabelColor: "hsla(206, 47%, 31%, 1)",
  },
  times: {
    textColor: "hsla(207, 37%, 28%, 1)",
    iconColor: "hsla(191, 66%, 46%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    pastFillColor: "hsla(190, 74%, 42%, 1)",
    pastBorderColor: "hsla(190, 85%, 94%, 0.95)",
    futureFillColor: "hsla(0, 0%, 100%, 0.92)",
    futureBorderColor: "hsla(190, 74%, 42%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.9)",
    futureIconTintColor: "hsla(190, 74%, 42%, 0.82)",
  },
  indicator: {
    badgeLabelColor: "hsla(204, 48%, 26%, 1)",
    bannerTitleColor: "hsla(204, 52%, 24%, 1)",
    bannerSubtitleColor: "hsla(199, 30%, 35%, 1)",
    borderColor: "hsla(189, 70%, 73%, 0.95)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.72,
      borderColor: "hsla(189, 70%, 73%, 0.52)",
      fillColor: "hsla(195, 65%, 95%, 0.22)",
    },
  },
};

export const HARBOR_DAWN_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(17, 88%, 69%, 1)",
    completedGlowColor: "hsla(38, 95%, 76%, 0.95)",
    remainingColor: "hsla(36, 65%, 96%, 0.72)",
  },
  cards: {
    blurTint: "light",
    fillColor: "hsla(33, 90%, 95%, 0.18)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(14, 88%, 71%, 1)",
    eventLabelColor: "hsla(20, 46%, 33%, 1)",
  },
  times: {
    textColor: "hsla(24, 34%, 30%, 1)",
    iconColor: "hsla(14, 75%, 60%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    pastFillColor: "hsla(14, 80%, 59%, 1)",
    pastBorderColor: "hsla(42, 95%, 95%, 0.95)",
    futureFillColor: "hsla(0, 0%, 100%, 0.92)",
    futureBorderColor: "hsla(14, 80%, 59%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.92)",
    futureIconTintColor: "hsla(14, 80%, 59%, 0.82)",
  },
  indicator: {
    badgeLabelColor: "hsla(19, 48%, 28%, 1)",
    bannerTitleColor: "hsla(18, 47%, 26%, 1)",
    bannerSubtitleColor: "hsla(24, 31%, 37%, 1)",
    borderColor: "hsla(22, 88%, 76%, 0.95)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.68,
      borderColor: "hsla(22, 88%, 76%, 0.48)",
      fillColor: "hsla(36, 80%, 97%, 0.2)",
    },
  },
};

export const SIGNAL_NIGHT_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(83, 88%, 56%, 1)",
    completedGlowColor: "hsla(83, 95%, 63%, 0.95)",
    remainingColor: "hsla(196, 28%, 84%, 0.54)",
  },
  cards: {
    blurTint: "dark",
    fillColor: "hsla(190, 35%, 15%, 0.26)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(171, 63%, 61%, 1)",
    eventLabelColor: "hsla(180, 31%, 88%, 1)",
  },
  times: {
    textColor: "hsla(190, 18%, 90%, 1)",
    iconColor: "hsla(83, 88%, 56%, 1)",
  },
  outlines: {
    color: "hsla(0, 0%, 100%, 0.05)",
  },
  marker: {
    pastFillColor: "hsla(83, 88%, 56%, 1)",
    pastBorderColor: "hsla(168, 54%, 90%, 0.95)",
    futureFillColor: "hsla(190, 28%, 92%, 0.96)",
    futureBorderColor: "hsla(83, 88%, 56%, 1)",
    pastIconTintColor: "hsla(194, 43%, 12%, 0.96)",
    futureIconTintColor: "hsla(194, 43%, 23%, 0.88)",
  },
  indicator: {
    badgeLabelColor: "hsla(194, 44%, 16%, 1)",
    bannerTitleColor: "hsla(180, 24%, 92%, 1)",
    bannerSubtitleColor: "hsla(181, 19%, 76%, 1)",
    borderColor: "hsla(171, 63%, 61%, 0.92)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.78,
      borderColor: "hsla(171, 63%, 61%, 0.44)",
      fillColor: "hsla(190, 34%, 24%, 0.2)",
    },
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
  track: {
    ...BASE_TIMELINE_VISUAL_THEME.track,
    ...overrides.track,
  },
  cards: {
    ...BASE_TIMELINE_VISUAL_THEME.cards,
    ...overrides.cards,
  },
  labels: {
    ...BASE_TIMELINE_VISUAL_THEME.labels,
    ...overrides.labels,
  },
  times: {
    ...BASE_TIMELINE_VISUAL_THEME.times,
    ...overrides.times,
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
    ping: {
      ...BASE_TIMELINE_VISUAL_THEME.indicator.ping,
      ...overrides.indicator?.ping,
    },
  },
});
