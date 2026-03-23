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
    /** Inner overlay on top of blur; pairs with fixed card blur tint in render constants. */
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
    /** Fixed card blur material; not per-theme (see `TimelineTerminalCardBackgrounds`). */
    blurTint: "light" as const,
  },
  indicator: {
    glassBlurIntensity: 8,
  },
} as const;

export const DEFAULT_TIMELINE_OUTLINE_COLOR = "hsla(0, 0%, 100%, 0.75)";
export const DEFAULT_TIMELINE_CARD_FILL_COLOR = "hsla(0, 0%, 100%, 0.30)";

export const SEA_GLASS_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(187, 73%, 58%, 1)",
    completedGlowColor: "hsla(187, 83%, 68%, 0.95)",
    remainingColor: "hsla(210, 35%, 100%, 0.66)",
  },
  cards: {
    fillColor: DEFAULT_TIMELINE_CARD_FILL_COLOR,
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
    fillColor: DEFAULT_TIMELINE_CARD_FILL_COLOR,
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

export const CARNIVAL_FIZZ_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(24, 96%, 62%, 1)",
    completedGlowColor: "hsla(47, 100%, 72%, 0.95)",
    remainingColor: "hsla(194, 78%, 97%, 0.72)",
  },
  cards: {
    fillColor: DEFAULT_TIMELINE_CARD_FILL_COLOR,
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(21, 94%, 63%, 1)",
    eventLabelColor: "hsla(203, 44%, 31%, 1)",
  },
  times: {
    textColor: "hsla(205, 34%, 29%, 1)",
    iconColor: "hsla(174, 72%, 43%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    pastFillColor: "hsla(24, 96%, 62%, 1)",
    pastBorderColor: "hsla(49, 100%, 95%, 0.95)",
    futureFillColor: "hsla(0, 0%, 100%, 0.94)",
    futureBorderColor: "hsla(24, 96%, 62%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.94)",
    futureIconTintColor: "hsla(24, 96%, 62%, 0.84)",
  },
  indicator: {
    badgeLabelColor: "hsla(203, 46%, 28%, 1)",
    bannerTitleColor: "hsla(204, 48%, 26%, 1)",
    bannerSubtitleColor: "hsla(201, 29%, 39%, 1)",
    borderColor: "hsla(33, 100%, 74%, 0.95)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.72,
      borderColor: "hsla(33, 100%, 74%, 0.48)",
      fillColor: "hsla(47, 100%, 97%, 0.24)",
    },
  },
};

export const TAFFY_HARBOR_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(330, 79%, 68%, 1)",
    completedGlowColor: "hsla(31, 100%, 79%, 0.95)",
    remainingColor: "hsla(219, 72%, 98%, 0.74)",
  },
  cards: {
    fillColor: "hsla(0, 0%, 100%, 0.34)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(322, 73%, 66%, 1)",
    eventLabelColor: "hsla(224, 32%, 35%, 1)",
  },
  times: {
    textColor: "hsla(229, 24%, 32%, 1)",
    iconColor: "hsla(193, 73%, 47%, 1)",
  },
  outlines: {
    color: "hsla(0, 0%, 100%, 0.7)",
  },
  marker: {
    pastFillColor: "hsla(330, 79%, 68%, 1)",
    pastBorderColor: "hsla(0, 0%, 100%, 0.95)",
    futureFillColor: "hsla(0, 0%, 100%, 0.94)",
    futureBorderColor: "hsla(330, 79%, 68%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.94)",
    futureIconTintColor: "hsla(330, 79%, 68%, 0.84)",
  },
  indicator: {
    badgeLabelColor: "hsla(226, 34%, 31%, 1)",
    bannerTitleColor: "hsla(228, 36%, 29%, 1)",
    bannerSubtitleColor: "hsla(223, 19%, 43%, 1)",
    borderColor: "hsla(327, 82%, 77%, 0.95)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.7,
      borderColor: "hsla(327, 82%, 77%, 0.44)",
      fillColor: "hsla(201, 100%, 97%, 0.22)",
    },
  },
};

export const KELP_DISCO_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(155, 77%, 47%, 1)",
    completedGlowColor: "hsla(52, 97%, 67%, 0.9)",
    remainingColor: "hsla(167, 49%, 93%, 0.56)",
  },
  cards: {
    fillColor: "hsla(167, 36%, 97%, 0.22)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(161, 72%, 58%, 1)",
    eventLabelColor: "hsla(162, 42%, 90%, 1)",
  },
  times: {
    textColor: "hsla(156, 29%, 91%, 1)",
    iconColor: "hsla(52, 97%, 67%, 1)",
  },
  outlines: {
    color: "hsla(0, 0%, 100%, 0.08)",
  },
  marker: {
    pastFillColor: "hsla(52, 97%, 67%, 1)",
    pastBorderColor: "hsla(159, 46%, 83%, 0.9)",
    futureFillColor: "hsla(164, 31%, 88%, 0.95)",
    futureBorderColor: "hsla(52, 97%, 67%, 1)",
    pastIconTintColor: "hsla(161, 50%, 13%, 0.96)",
    futureIconTintColor: "hsla(161, 43%, 23%, 0.88)",
  },
  indicator: {
    badgeLabelColor: "hsla(157, 53%, 14%, 1)",
    bannerTitleColor: "hsla(159, 43%, 92%, 1)",
    bannerSubtitleColor: "hsla(158, 22%, 76%, 1)",
    borderColor: "hsla(155, 77%, 55%, 0.88)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.78,
      borderColor: "hsla(155, 77%, 55%, 0.4)",
      fillColor: "hsla(155, 52%, 30%, 0.22)",
    },
  },
};

export const CONFETTI_TIDE_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(197, 82%, 57%, 1)",
    completedGlowColor: "hsla(48, 100%, 73%, 0.92)",
    remainingColor: "hsla(201, 79%, 98%, 0.74)",
  },
  cards: {
    fillColor: "hsla(0, 0%, 100%, 0.33)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(198, 80%, 57%, 1)",
    eventLabelColor: "hsla(220, 36%, 32%, 1)",
  },
  times: {
    textColor: "hsla(223, 28%, 29%, 1)",
    iconColor: "hsla(11, 86%, 65%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    pastFillColor: "hsla(11, 86%, 65%, 1)",
    pastBorderColor: "hsla(53, 100%, 95%, 0.94)",
    futureFillColor: "hsla(0, 0%, 100%, 0.94)",
    futureBorderColor: "hsla(11, 86%, 65%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.94)",
    futureIconTintColor: "hsla(11, 86%, 65%, 0.84)",
  },
  indicator: {
    badgeLabelColor: "hsla(220, 44%, 29%, 1)",
    bannerTitleColor: "hsla(221, 46%, 27%, 1)",
    bannerSubtitleColor: "hsla(217, 18%, 42%, 1)",
    borderColor: "hsla(198, 83%, 70%, 0.94)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.7,
      borderColor: "hsla(198, 83%, 70%, 0.44)",
      fillColor: "hsla(201, 100%, 97%, 0.22)",
    },
  },
};

export const MOON_JELLY_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(267, 79%, 70%, 1)",
    completedGlowColor: "hsla(196, 93%, 77%, 0.94)",
    remainingColor: "hsla(225, 56%, 96%, 0.7)",
  },
  cards: {
    fillColor: "hsla(0, 0%, 100%, 0.28)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(271, 78%, 72%, 1)",
    eventLabelColor: "hsla(224, 33%, 34%, 1)",
  },
  times: {
    textColor: "hsla(226, 24%, 31%, 1)",
    iconColor: "hsla(194, 79%, 56%, 1)",
  },
  outlines: {
    color: "hsla(0, 0%, 100%, 0.72)",
  },
  marker: {
    pastFillColor: "hsla(267, 79%, 70%, 1)",
    pastBorderColor: "hsla(195, 100%, 96%, 0.94)",
    futureFillColor: "hsla(0, 0%, 100%, 0.94)",
    futureBorderColor: "hsla(267, 79%, 70%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.94)",
    futureIconTintColor: "hsla(267, 79%, 70%, 0.84)",
  },
  indicator: {
    badgeLabelColor: "hsla(225, 38%, 29%, 1)",
    bannerTitleColor: "hsla(226, 40%, 27%, 1)",
    bannerSubtitleColor: "hsla(222, 18%, 43%, 1)",
    borderColor: "hsla(266, 83%, 79%, 0.94)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.72,
      borderColor: "hsla(266, 83%, 79%, 0.42)",
      fillColor: "hsla(194, 100%, 97%, 0.2)",
    },
  },
};

export const PICNIC_POSTCARD_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    completedColor: "hsla(356, 86%, 64%, 1)",
    completedGlowColor: "hsla(45, 99%, 72%, 0.92)",
    remainingColor: "hsla(90, 48%, 95%, 0.74)",
  },
  cards: {
    fillColor: "hsla(0, 0%, 100%, 0.32)",
    borderWidth: 1,
  },
  labels: {
    terminalNameColor: "hsla(356, 79%, 64%, 1)",
    eventLabelColor: "hsla(26, 30%, 31%, 1)",
  },
  times: {
    textColor: "hsla(29, 24%, 29%, 1)",
    iconColor: "hsla(144, 51%, 44%, 1)",
  },
  outlines: {
    color: DEFAULT_TIMELINE_OUTLINE_COLOR,
  },
  marker: {
    pastFillColor: "hsla(356, 86%, 64%, 1)",
    pastBorderColor: "hsla(55, 90%, 95%, 0.94)",
    futureFillColor: "hsla(0, 0%, 100%, 0.94)",
    futureBorderColor: "hsla(356, 86%, 64%, 1)",
    pastIconTintColor: "hsla(0, 0%, 100%, 0.94)",
    futureIconTintColor: "hsla(356, 86%, 64%, 0.84)",
  },
  indicator: {
    badgeLabelColor: "hsla(28, 38%, 27%, 1)",
    bannerTitleColor: "hsla(28, 40%, 25%, 1)",
    bannerSubtitleColor: "hsla(27, 16%, 41%, 1)",
    borderColor: "hsla(356, 84%, 76%, 0.94)",
    ping: {
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.68,
      borderColor: "hsla(356, 84%, 76%, 0.42)",
      fillColor: "hsla(51, 100%, 97%, 0.22)",
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
