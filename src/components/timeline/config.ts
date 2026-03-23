/**
 * Shared UX constants for timeline geometry, motion, and component sizing.
 *
 * Keep style-system class values and theme tokens out of this file. This module
 * is only for non-theme literals that are reused by the presentation layer.
 */

export const TIMELINE_SHARED_CONFIG = {
  trackXPositionPercent: 35,
  indicatorSizePx: 48,
  indicatorPositionInsetPercent: 0.02,
  sideColumnOffsetPx: 18,
} as const;

export const TIMELINE_CARD_CONFIG = {
  cornerRadiusPx: 20,
} as const;

export const TIMELINE_INDICATOR_CONFIG = {
  banner: {
    maxWidthPx: 400,
    verticalOffsetPx: 6,
    borderWidthPx: 1.5,
    fadeDurationMs: 300,
  },
  circle: {
    borderWidthPx: 3,
  },
  overlay: {
    zIndex: 10,
    elevation: 10,
  },
  radarPing: {
    durationMs: 10000,
    borderWidthPx: 2,
    fillOpacity: 0.5,
    maxScale: 2.5,
    keyframes: {
      hiddenStartPercent: "0%",
      hiddenEndPercent: "49.99%",
      visibleStartPercent: "50%",
      endPercent: "100%",
    },
  },
  motion: {
    progressDurationMs: 5000,
    rocking: {
      minSpeedKnots: 0,
      maxSpeedKnots: 20,
      slowPeriodMs: 25000,
      fastPeriodMs: 7500,
      maxRotationDeg: 4,
      rampInMs: 900,
      rampOutMs: 700,
    },
  },
} as const;

export const TIMELINE_ROW_CONFIG = {
  body: {
    contentNudgePx: 2,
  },
  label: {
    fontSizePx: 18,
  },
  marker: {
    sizePx: 28,
    borderWidthPx: 2,
    iconSizePx: 20,
  },
  terminalName: {
    zIndex: 2,
    elevation: 2,
    outlineWidthPx: 2,
    fontSizePx: 30,
    rotationDeg: -9,
  },
  times: {
    iconSizePx: 22,
    iconStrokeWidth: 2,
    iconOutlineWidth: 2,
    textFontSizePx: 18,
  },
} as const;
