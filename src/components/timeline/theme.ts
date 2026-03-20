import type { TextStyle, ViewStyle } from "react-native";
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
    blurTint: "light" | "dark" | "default";
    fillColor: string;
    borderColor: string;
    borderWidth: number;
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowStyle?: ViewStyle;
  };
  labels: {
    terminalNameFontClassName: string;
    terminalNameColor: string;
    terminalNameShadowColor: string;
    terminalNameRotationDeg: number;
    eventLabelFontClassName: string;
    eventLabelColor: string;
    eventLabelShadowColor: string;
    terminalNameStyle?: TextStyle;
    eventLabelStyle?: TextStyle;
  };
  times: {
    fontClassName: string;
    textColor: string;
    shadowColor: string;
    iconColor: string;
    shadowIconColor: string;
    textStyle?: TextStyle;
  };
  marker: {
    pastFillColor: string;
    pastBorderColor: string;
    futureFillColor: string;
    futureBorderColor: string;
    pastIconTintColor: string;
    futureIconTintColor: string;
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
  };
  indicator: {
    badgeTextColor: string;
    titleColor: string;
    subtitleColor: string;
    glassBorderColor: string;
    glassFillColor: string;
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

export const DEFAULT_TIMELINE_VISUAL_THEME: TimelineVisualTheme = {
  track: {
    coreWidthPx: 4,
    glowWidthPx: 14,
    completedColor: "#4ADE80",
    completedGlowColor: "rgba(74, 222, 128, 0.36)",
    completedGlowOpacity: 1,
    remainingColor: "rgba(255, 255, 255, 0.78)",
  },
  cards: {
    blurIntensity: 30,
    blurTint: "light",
    fillColor: "rgba(255,255,255,0.30)",
    borderColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  labels: {
    terminalNameFontClassName: "font-puffberry text-3xl",
    terminalNameColor: "#C084FC",
    terminalNameShadowColor: "#FFFFFF",
    terminalNameRotationDeg: -9,
    eventLabelFontClassName: "font-led-board text-lg py-[2px]",
    eventLabelColor: "#6D28D9",
    eventLabelShadowColor: "#FFFFFF",
  },
  times: {
    fontClassName: "font-led-board text-lg",
    textColor: "#6D28D9",
    shadowColor: "#FFFFFF",
    iconColor: "#7C3AED",
    shadowIconColor: "#FFFFFF",
  },
  marker: {
    pastFillColor: "#22C55E",
    pastBorderColor: "rgba(220,252,231,0.95)",
    futureFillColor: "rgba(255,255,255,0.92)",
    futureBorderColor: "#22C55E",
    pastIconTintColor: "rgba(255,255,255,0.9)",
    futureIconTintColor: "rgba(34,197,94,0.8)",
    shadowColor: "#86EFAC",
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  indicator: {
    badgeTextColor: "#6D28D9",
    titleColor: "#5B21B6",
    subtitleColor: "#5B21B6",
    glassBorderColor: "rgba(192, 132, 252, 0.95)",
    glassFillColor: "rgba(255,255,255,0.50)",
    glassBlurIntensity: 8,
    glowColor: "rgba(192, 132, 252, 0.55)",
    glowOpacity: 0.34,
    glowRadius: 14,
    radarPingVariant: "glass-orchid",
  },
};

export const TIMELINE_THEME_CONSTANTS = {
  track: {
    coreWidthPx: DEFAULT_TIMELINE_VISUAL_THEME.track.coreWidthPx,
    glowWidthPx: DEFAULT_TIMELINE_VISUAL_THEME.track.glowWidthPx,
    completedGlowOpacity: DEFAULT_TIMELINE_VISUAL_THEME.track.completedGlowOpacity,
  },
  cards: {
    blurIntensity: DEFAULT_TIMELINE_VISUAL_THEME.cards.blurIntensity,
    blurTint: DEFAULT_TIMELINE_VISUAL_THEME.cards.blurTint,
    borderWidth: DEFAULT_TIMELINE_VISUAL_THEME.cards.borderWidth,
    shadowOpacity: DEFAULT_TIMELINE_VISUAL_THEME.cards.shadowOpacity,
    shadowRadius: DEFAULT_TIMELINE_VISUAL_THEME.cards.shadowRadius,
    shadowStyle: DEFAULT_TIMELINE_VISUAL_THEME.cards.shadowStyle,
  },
  labels: {
    terminalNameFontClassName:
      DEFAULT_TIMELINE_VISUAL_THEME.labels.terminalNameFontClassName,
    terminalNameRotationDeg:
      DEFAULT_TIMELINE_VISUAL_THEME.labels.terminalNameRotationDeg,
    eventLabelFontClassName:
      DEFAULT_TIMELINE_VISUAL_THEME.labels.eventLabelFontClassName,
    terminalNameStyle: DEFAULT_TIMELINE_VISUAL_THEME.labels.terminalNameStyle,
    eventLabelStyle: DEFAULT_TIMELINE_VISUAL_THEME.labels.eventLabelStyle,
  },
  times: {
    fontClassName: DEFAULT_TIMELINE_VISUAL_THEME.times.fontClassName,
    textStyle: DEFAULT_TIMELINE_VISUAL_THEME.times.textStyle,
  },
  marker: {
    shadowOpacity: DEFAULT_TIMELINE_VISUAL_THEME.marker.shadowOpacity,
    shadowRadius: DEFAULT_TIMELINE_VISUAL_THEME.marker.shadowRadius,
  },
  indicator: {
    glassBlurIntensity: DEFAULT_TIMELINE_VISUAL_THEME.indicator.glassBlurIntensity,
    glowOpacity: DEFAULT_TIMELINE_VISUAL_THEME.indicator.glowOpacity,
    glowRadius: DEFAULT_TIMELINE_VISUAL_THEME.indicator.glowRadius,
    badgeTextStyle: DEFAULT_TIMELINE_VISUAL_THEME.indicator.badgeTextStyle,
    titleTextStyle: DEFAULT_TIMELINE_VISUAL_THEME.indicator.titleTextStyle,
    subtitleTextStyle:
      DEFAULT_TIMELINE_VISUAL_THEME.indicator.subtitleTextStyle,
  },
} as const;

export const TIMELINE_THEME_BASELINE = {
  cards: {
    fill: DEFAULT_TIMELINE_VISUAL_THEME.cards.fillColor,
    border: DEFAULT_TIMELINE_VISUAL_THEME.cards.borderColor,
    shadow: DEFAULT_TIMELINE_VISUAL_THEME.cards.shadowColor,
  },
  labels: {
    terminalNameShadow: DEFAULT_TIMELINE_VISUAL_THEME.labels.terminalNameShadowColor,
    eventLabelShadow: DEFAULT_TIMELINE_VISUAL_THEME.labels.eventLabelShadowColor,
  },
  times: {
    text: DEFAULT_TIMELINE_VISUAL_THEME.times.textColor,
    shadow: DEFAULT_TIMELINE_VISUAL_THEME.times.shadowColor,
    icon: DEFAULT_TIMELINE_VISUAL_THEME.times.iconColor,
    shadowIcon: DEFAULT_TIMELINE_VISUAL_THEME.times.shadowIconColor,
  },
  marker: {
    fill: DEFAULT_TIMELINE_VISUAL_THEME.marker.pastFillColor,
    pastBorder: DEFAULT_TIMELINE_VISUAL_THEME.marker.pastBorderColor,
    futureFill: DEFAULT_TIMELINE_VISUAL_THEME.marker.futureFillColor,
    futureBorder: DEFAULT_TIMELINE_VISUAL_THEME.marker.futureBorderColor,
    pastIconTint: DEFAULT_TIMELINE_VISUAL_THEME.marker.pastIconTintColor,
    futureIconTint: DEFAULT_TIMELINE_VISUAL_THEME.marker.futureIconTintColor,
    shadow: DEFAULT_TIMELINE_VISUAL_THEME.marker.shadowColor,
  },
  indicator: {
    badge: DEFAULT_TIMELINE_VISUAL_THEME.indicator.badgeTextColor,
    title: DEFAULT_TIMELINE_VISUAL_THEME.indicator.titleColor,
    subtitle: DEFAULT_TIMELINE_VISUAL_THEME.indicator.subtitleColor,
    border: DEFAULT_TIMELINE_VISUAL_THEME.indicator.glassBorderColor,
    fill: DEFAULT_TIMELINE_VISUAL_THEME.indicator.glassFillColor,
    glow: DEFAULT_TIMELINE_VISUAL_THEME.indicator.glowColor,
  },
} as const;
