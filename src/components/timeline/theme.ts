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
      iconTintColor: "rgba(34, 197, 94, 0.75)",
    },
    past: {
      containerClassName: "border border-white bg-green-500",
      iconTintColor: "rgba(255, 255, 255, 0.75)",
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
  containerClassName: "bg-white/50",
  blurClassName:
    "items-center justify-center overflow-hidden rounded-full border border-green-500",
  labelClassName: "text-center font-bold text-green-700 text-sm",
} as const;
