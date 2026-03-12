/**
 * Per-component style constants for the Vessel Trip Timeline.
 * Each component imports only the style object it needs.
 */

/** Style constants for timeline rows (TimelineRow, TimelineMarker). */
export const ROW_STYLE = {
  minSegmentPx: 32,
  centerAxisSizePx: 42,
  markerSizePx: 24,
  markerClassName: "border border-green-500 bg-white",
} as const;

/** Style constants for the full-height track (TimelineTrack). */
export const TRACK_STYLE = {
  trackThicknessPx: 8,
  centerAxisSizePx: 42,
  completeTrackClassName: "bg-green-400",
  upcomingTrackClassName: "bg-green-100",
} as const;

/** Style constants for the active indicator overlay (TimelineIndicator). */
export const INDICATOR_STYLE = {
  sizePx: 36,
  containerClassName:
    "items-center justify-center rounded-full border border-green-500 bg-white/75",
  blurClassName:
    "items-center justify-center overflow-hidden rounded-full border border-green-500 bg-white/50",
  labelClassName: "text-center font-bold text-green-700 text-xs",
} as const;
