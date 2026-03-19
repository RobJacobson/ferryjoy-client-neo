import type { TextStyle, ViewStyle } from "react-native";
import type { TimelineIndicatorRadarPingVariant } from "./timelineIndicator/timelineIndicatorRadarPingConfig";

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
