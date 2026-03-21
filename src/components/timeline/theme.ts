/**
 * Low-level resolved render contract consumed by timeline components.
 *
 * This is intentionally more detailed than the human-authored theme schema used
 * by feature-level variant definitions.
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

export const BASE_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(142, 69%, 58%, 1)",
    completedGlowColor: "hsla(142, 69%, 58%, 1)",
    remainingColor: "hsla(0, 0%, 100%, 0.78)",
  },
  cards: {
    blurTint: "clear",
    fillColor: "hsla(0, 0%, 100%, 0.25)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(270, 95%, 75%, 1)",
    eventLabelColor: "hsla(263, 70%, 50%, 1)",
  },
  times: {
    textColor: "hsla(263, 70%, 50%, 1)",
    iconColor: "hsla(262, 83%, 58%, 1)",
  },
  marker: {
    pastFillColor: "hsla(142, 71%, 45%, 1)",
    pastBorderColor: "hsla(141, 84%, 93%, 0.95)",
    futureFillColor: "hsla(0, 0%, 100%, 0.92)",
    futureBorderColor: "hsla(142, 71%, 45%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.9)",
    futureIconTintColor: "hsla(142, 71%, 45%, 0.8)",
  },
  indicator: {
    badgeLabelColor: "hsla(263, 70%, 50%, 1)",
    bannerTitleColor: "hsla(263, 69%, 42%, 1)",
    bannerSubtitleColor: "hsla(263, 69%, 42%, 1)",
    borderColor: "hsla(270, 95%, 75%, 0.95)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.75,
      borderColor: "hsla(270, 95%, 75%, 0.5)",
      fillColor: "hsla(0, 0%, 100%, 0.25)",
    },
  },
};

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
  marker: {
    ...BASE_TIMELINE_VISUAL_THEME.marker,
    ...overrides.marker,
  },
  indicator: {
    ...BASE_TIMELINE_VISUAL_THEME.indicator,
    ...overrides.indicator,
  },
});
