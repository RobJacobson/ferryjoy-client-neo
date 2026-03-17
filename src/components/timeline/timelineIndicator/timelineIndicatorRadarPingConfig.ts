import type { ViewStyle } from "react-native";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";

export const TIMELINE_INDICATOR_RADAR_PING_DURATION_MS = 10000;

export type TimelineIndicatorRadarPingVariant =
  | "glass-orchid"
  | "harbor-emerald"
  | "tidal-mix";

export type TimelineIndicatorRadarPingLayerStyle = {
  key: string;
  style: ViewStyle;
};

type TimelineIndicatorRadarPingLayer = {
  key: string;
  insetPx: number;
  borderWidth: number;
  peakOpacity: number;
  borderColor: string;
  backgroundColor?: string;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowRadius?: number;
};

const createRadarPingAnimationStyle = (peakOpacity: number): ViewStyle => ({
  animationName: {
    "0%": {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    "49.99%": {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
    "50%": {
      opacity: peakOpacity,
      transform: [{ scale: 1 }],
    },
    "100%": {
      opacity: 0,
      transform: [{ scale: 2.5 }],
    },
  },
  animationDuration: TIMELINE_INDICATOR_RADAR_PING_DURATION_MS,
  animationDelay: 0,
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-out",
});

const RADAR_PING_VARIANTS: Record<
  TimelineIndicatorRadarPingVariant,
  TimelineIndicatorRadarPingLayer[]
> = {
  "glass-orchid": [
    {
      key: "soft-fill",
      insetPx: 2,
      borderWidth: 1,
      peakOpacity: 0.2,
      borderColor: "rgba(192, 132, 252, 0.45)",
      backgroundColor: "rgba(255, 255, 255, 0.3)",
      shadowColor: "rgb(192, 132, 252)",
      shadowOpacity: 0.18,
      shadowRadius: 10,
    },
    {
      key: "outer-ring",
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.6,
      borderColor: "rgba(126, 34, 206, 0.45)",
      shadowColor: "rgb(126, 34, 206)",
      shadowOpacity: 0.16,
      shadowRadius: 12,
    },
  ],
  "harbor-emerald": [
    {
      key: "inner-ring",
      insetPx: 3,
      borderWidth: 1,
      peakOpacity: 0.22,
      borderColor: "rgba(74, 222, 128, 0.45)",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      shadowColor: "rgb(34, 197, 94)",
      shadowOpacity: 0.2,
      shadowRadius: 10,
    },
    {
      key: "signal-ring",
      insetPx: 0,
      borderWidth: 2,
      peakOpacity: 0.42,
      borderColor: "rgba(34, 197, 94, 0.55)",
      shadowColor: "rgb(34, 197, 94)",
      shadowOpacity: 0.22,
      shadowRadius: 14,
    },
  ],
  "tidal-mix": [
    {
      key: "seafoam-core",
      insetPx: 4,
      borderWidth: 1,
      peakOpacity: 0.2,
      borderColor: "rgba(134, 239, 172, 0.45)",
      backgroundColor: "rgba(240, 253, 244, 0.28)",
      shadowColor: "rgb(74, 222, 128)",
      shadowOpacity: 0.16,
      shadowRadius: 10,
    },
    {
      key: "orchid-ring",
      insetPx: 1,
      borderWidth: 1.5,
      peakOpacity: 0.36,
      borderColor: "rgba(192, 132, 252, 0.42)",
      shadowColor: "rgb(168, 85, 247)",
      shadowOpacity: 0.16,
      shadowRadius: 12,
    },
    {
      key: "emerald-ring",
      insetPx: 0,
      borderWidth: 1.5,
      peakOpacity: 0.28,
      borderColor: "rgba(34, 197, 94, 0.38)",
      shadowColor: "rgb(34, 197, 94)",
      shadowOpacity: 0.14,
      shadowRadius: 14,
    },
  ],
};

export const DEFAULT_TIMELINE_INDICATOR_RADAR_PING_VARIANT: TimelineIndicatorRadarPingVariant =
  "glass-orchid";

export const getTimelineIndicatorRadarPingLayerStyles = (
  variant: TimelineIndicatorRadarPingVariant,
  sizePx: number
): TimelineIndicatorRadarPingLayerStyle[] =>
  RADAR_PING_VARIANTS[variant].map(
    ({
      key,
      insetPx,
      borderWidth,
      peakOpacity,
      borderColor,
      backgroundColor,
      shadowColor,
      shadowOpacity,
      shadowRadius,
    }) => {
      const layerSizePx = Math.max(0, sizePx - insetPx * 2);

      return {
        key,
        style: {
          left: "50%",
          top: "50%",
          ...getAbsoluteCenteredBoxStyle({
            width: layerSizePx,
            height: layerSizePx,
          }),
          borderRadius: layerSizePx / 2,
          borderWidth,
          borderColor,
          backgroundColor,
          shadowColor,
          shadowOpacity,
          shadowRadius,
          ...createRadarPingAnimationStyle(peakOpacity),
        },
      };
    }
  );

export const timelineIndicatorRadarPingVariantKeys = Object.keys(
  RADAR_PING_VARIANTS
) as TimelineIndicatorRadarPingVariant[];
