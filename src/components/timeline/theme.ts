/**
 * Shared style constants for the vertical timeline renderer.
 */

export const ROW_STYLE = {
  minSegmentPx: 32,
  centerAxisSizePx: 42,
  markerSizePx: 32,
  markerAppearance: {
    future: {
      containerClassName: "border border-green-500 bg-white",
      iconTintColor: "rgba(34, 197, 94, 1)",
    },
    past: {
      containerClassName: "border border-green-200 bg-green-500",
      iconTintColor: "rgba(255, 255, 255, 1)",
    },
  },
} as const;

export const TRACK_STYLE = {
  trackThicknessPx: 8,
  centerAxisSizePx: 42,
  completeTrackClassName: "bg-green-400",
  upcomingTrackClassName: "bg-green-100",
} as const;

export const INDICATOR_STYLE = {
  sizePx: 42,
  blurIntensity: 8,
  bannerWidthPx: 140,
  bannerOffsetPx: 6,
  containerClassName: "",
  surfaceClassName: "overflow-hidden rounded-full border border-green-500",
  blurClassName: "absolute inset-0",
  overlayClassName: "absolute inset-0 bg-white/60",
  contentClassName: "items-center justify-center",
  labelClassName: "text-center font-bold text-green-700 text-sm",
  bannerContainerClassName: "absolute items-center",
  bannerSurfaceClassName:
    "overflow-hidden rounded-full border border-green-500",
  bannerBlurClassName: "absolute inset-0",
  bannerOverlayClassName: "absolute inset-0 bg-white/50",
  bannerContentClassName: "items-center px-4 py-1",
  bannerTitleClassName: "text-center font-playpen-600 leading-tight",
  bannerSubtitleClassName: "text-center font-playpen-300 leading-tight text-sm",
  rocking: {
    maxRotationDeg: 4,
    minSpeedKnots: 0,
    maxSpeedKnots: 20,
    periodSlowMs: 25000,
    periodFastMs: 7500,
    rampInMs: 900,
    rampOutMs: 700,
  },
} as const;
