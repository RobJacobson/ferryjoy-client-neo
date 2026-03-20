import type { TextStyle } from "react-native";
import type { TimelineIndicatorRadarPingVariant } from "./timelineIndicator/timelineIndicatorRadarPingConfig";

/**
 * Low-level resolved render contract consumed by timeline components.
 *
 * This is intentionally more detailed than the human-authored theme schema used
 * by feature-level variant definitions.
 */
export type TimelineVisualTheme = {
  track: {
    coreWidthPx: number;
    glowWidthPx: number;
    completedColor: string;
    completedGlowColor: string;
    completedGlowOpacity: number;
    remainingColor: string;
  };
  cards: {
    blurIntensity: number;
    /** Backdrop blur material; not the same as `fillColor` (inner view only). */
    blurTint: "clear" | "light" | "dark" | "default";
    /** Inner overlay on top of blur; use transparent for tint from `blurTint` only. */
    fillColor: string;
    borderColor: string;
    borderWidth: number;
  };
  labels: {
    terminalNameFontClassName: string;
    terminalNameColor: string;
    terminalNameRotationDeg: number;
    eventLabelFontClassName: string;
    eventLabelColor: string;
    terminalNameStyle?: TextStyle;
    eventLabelStyle?: TextStyle;
  };
  times: {
    fontClassName: string;
    textColor: string;
    iconColor: string;
    textStyle?: TextStyle;
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
    badgeTextColor: string;
    titleColor: string;
    subtitleColor: string;
    glassBorderColor: string;
    glassBlurIntensity: number;
    glowColor: string;
    glowOpacity: number;
    glowRadius: number;
    radarPingVariant: TimelineIndicatorRadarPingVariant;
    badgeTextStyle?: TextStyle;
    titleTextStyle?: TextStyle;
    subtitleTextStyle?: TextStyle;
  };
};

export type TimelineVisualThemeOverrides = {
  [Section in keyof TimelineVisualTheme]?: Partial<
    TimelineVisualTheme[Section]
  >;
};

export const DEFAULT_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    coreWidthPx: 3,
    glowWidthPx: 8,
    completedColor: "hsla(142, 69%, 58%, 1)",
    completedGlowColor: "hsla(142, 69%, 58%, 1)",
    completedGlowOpacity: 1,
    remainingColor: "hsla(0, 0%, 100%, 0.78)",
  },
  cards: {
    blurIntensity: 20,
    blurTint: "clear",
    fillColor: "hsla(0, 0%, 100%, 0.25)",
    borderColor: "hsla(0, 0%, 100%, 0.75)",
    borderWidth: 1,
  },
  labels: {
    terminalNameFontClassName: "font-puffberry text-3xl",
    terminalNameColor: "hsla(270, 95%, 75%, 1)",
    terminalNameRotationDeg: -9,
    eventLabelFontClassName: "font-led-board text-lg py-[2px]",
    eventLabelColor: "hsla(263, 70%, 50%, 1)",
  },
  times: {
    fontClassName: "font-led-board text-lg",
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
    badgeTextColor: "hsla(263, 70%, 50%, 1)",
    titleColor: "hsla(263, 69%, 42%, 1)",
    subtitleColor: "hsla(263, 69%, 42%, 1)",
    glassBorderColor: "hsla(270, 95%, 75%, 0.95)",
    glassBlurIntensity: 8,
    glowColor: "hsla(270, 95%, 75%, 0.55)",
    glowOpacity: 0.34,
    glowRadius: 14,
    radarPingVariant: "glass-orchid",
  },
};

export const createTimelineVisualTheme = (
  overrides: TimelineVisualThemeOverrides = {}
): TimelineVisualTheme => ({
  ...DEFAULT_TIMELINE_VISUAL_THEME,
  ...overrides,
  track: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.track,
    ...overrides.track,
  },
  cards: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.cards,
    ...overrides.cards,
  },
  labels: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.labels,
    ...overrides.labels,
  },
  times: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.times,
    ...overrides.times,
  },
  marker: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.marker,
    ...overrides.marker,
  },
  indicator: {
    ...DEFAULT_TIMELINE_VISUAL_THEME.indicator,
    ...overrides.indicator,
  },
});
