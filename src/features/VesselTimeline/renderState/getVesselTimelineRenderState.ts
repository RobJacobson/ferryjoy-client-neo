/**
 * Day-level vessel timeline view-model entry point.
 *
 * Composes server-owned semantic segments, active-row selection, layout
 * geometry, and the active indicator into `VesselTimelineRenderState` for the
 * feature UI.
 */

import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineSegment,
} from "@/data/contexts";
import { clamp } from "@/shared/utils";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
} from "../types";
import { buildActiveIndicator } from "./buildActiveIndicator";
import { getLayoutTimelineRows } from "./getLayoutTimelineRows";
import { resolveActiveSegmentIndex } from "./resolveActiveSegmentIndex";

const PIXELS_PER_MINUTE_MIN = 4;
const PIXELS_PER_MINUTE_MAX = 8;
const PIXELS_PER_MINUTE_PER_ROW = 0.15;

/**
 * Default pixel layout for row heights, terminal cards, and initial scroll.
 */
export const DEFAULT_VESSEL_TIMELINE_LAYOUT: VesselTimelineLayoutConfig = {
  pixelsPerMinute: 4,
  minRowHeightPx: 36,
  terminalCardTopOffsetPx: -20,
  terminalCardDepartureCapHeightPx: 20,
  initialAutoScroll: "center-active-indicator",
  initialScrollAnchorPercent: 0.5,
};

/**
 * Runs the vessel-day timeline pipeline from semantic segments to render state.
 *
 * @param Segments - Ordered semantic timeline segments for one vessel/day
 * @param liveState - Compact live vessel state for indicator progress and title
 * @param activeState - Backend-resolved active row selection and copy
 * @param now - Current wall-clock time
 * @param layout - Optional layout override
 * @param theme - Resolved timeline visual theme passed through to render state
 * @returns Final render state for the VesselTimeline UI
 */
export const getVesselTimelineRenderState = (
  Segments: VesselTimelineSegment[],
  liveState: VesselTimelineLiveState | null,
  activeState: VesselTimelineActiveState | null,
  now: Date = new Date(),
  layout: VesselTimelineLayoutConfig = DEFAULT_VESSEL_TIMELINE_LAYOUT,
  theme = BASE_TIMELINE_VISUAL_THEME
): VesselTimelineRenderState => {
  const adjustedLayout = {
    ...layout,
    pixelsPerMinute: getAdaptivePixelsPerMinute(Segments),
  };

  const activeSegmentIndex = resolveActiveSegmentIndex(Segments, activeState);
  const { rows, rowLayouts, terminalCards, contentHeightPx } =
    getLayoutTimelineRows(Segments, activeSegmentIndex, adjustedLayout);

  return {
    rows,
    rowLayouts,
    terminalCards,
    activeIndicator: buildActiveIndicator({
      segments: Segments,
      activeSegmentIndex,
      activeState,
      liveState,
      now,
    }),
    contentHeightPx,
    layout: adjustedLayout,
    theme,
  };
};

/**
 * Derives pixels-per-minute from the approximate number of visible rows.
 *
 * This uses a single tunable multiplier and clamps the result to keep sparse
 * routes compact while preserving enough vertical space for dense schedules.
 *
 * @param Segments - Ordered semantic timeline segments for one vessel/day
 * @returns Adaptive pixels-per-minute ratio for the timeline
 */
export const getAdaptivePixelsPerMinute = (Segments: VesselTimelineSegment[]) =>
  clamp(
    Math.max(1, Segments.length) * PIXELS_PER_MINUTE_PER_ROW,
    PIXELS_PER_MINUTE_MIN,
    PIXELS_PER_MINUTE_MAX
  );
