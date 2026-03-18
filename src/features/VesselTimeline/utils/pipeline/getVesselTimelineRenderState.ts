/**
 * Day-level vessel timeline view-model entry point.
 */

import type { VesselLocation, VesselTimelineEvent } from "@/data/contexts";
import { clamp } from "@/shared/utils";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelinePolicy,
  VesselTimelineRenderState,
} from "../../types";
import { buildTimelineRows } from "./buildTimelineRows";
import { buildActiveIndicator, getActiveRowIndex } from "./getActiveRowIndex";
import { getLayoutTimelineRows } from "./getLayoutTimelineRows";

const PIXELS_PER_MINUTE_MIN = 4;
const PIXELS_PER_MINUTE_MAX = 8;
const PIXELS_PER_MINUTE_PER_ROW = 0.15;

export const DEFAULT_VESSEL_TIMELINE_POLICY: VesselTimelinePolicy = {
  compressedDockThresholdMinutes: 60,
  compressedDockArrivalStubMinutes: 10,
  compressedDockDepartureWindowMinutes: 50,
};

/**
 * Default display/layout config for the vessel-day timeline.
 */
export const DEFAULT_VESSEL_TIMELINE_LAYOUT: VesselTimelineLayoutConfig = {
  pixelsPerMinute: 4,
  minRowHeightPx: 36,
  compressedBreakMarkerHeightPx: 20,
  terminalCardTopOffsetPx: -20,
  terminalCardDepartureCapHeightPx: 20,
  initialAutoScroll: "center-active-indicator",
  initialScrollAnchorPercent: 0.5,
};

/**
 * Runs the vessel-day timeline pipeline from ordered events to render state.
 *
 * @param Events - Ordered normalized events for one vessel/day
 * @param vesselLocation - Current vessel location for the selected vessel
 * @param now - Current wall-clock time
 * @param layout - Optional layout override
 * @returns Final render state for the VesselTimeline UI
 */
export const getVesselTimelineRenderState = (
  Events: VesselTimelineEvent[],
  vesselLocation: VesselLocation | undefined,
  now: Date = new Date(),
  layout: VesselTimelineLayoutConfig = DEFAULT_VESSEL_TIMELINE_LAYOUT
): VesselTimelineRenderState => {
  const adjustedLayout = {
    ...layout,
    pixelsPerMinute: getAdaptivePixelsPerMinute(Events),
  };

  const semanticRows = buildTimelineRows(
    Events,
    DEFAULT_VESSEL_TIMELINE_POLICY
  );
  const activeRowIndex = getActiveRowIndex(semanticRows, vesselLocation, now);
  const { rows, terminalCards, contentHeightPx } = getLayoutTimelineRows(
    semanticRows,
    activeRowIndex,
    adjustedLayout
  );

  return {
    rows,
    terminalCards,
    activeIndicator: buildActiveIndicator({
      rows: semanticRows,
      activeRowIndex,
      vesselLocation,
      now,
      policy: DEFAULT_VESSEL_TIMELINE_POLICY,
      layout: adjustedLayout,
    }),
    contentHeightPx,
    layout: adjustedLayout,
  };
};

/**
 * Derives pixels-per-minute from the approximate number of visible rows.
 *
 * This uses a single tunable multiplier and clamps the result to keep sparse
 * routes compact while preserving enough vertical space for dense schedules.
 *
 * @param Events - Ordered normalized events for one vessel/day
 * @returns Adaptive pixels-per-minute ratio for the timeline
 */
export const getAdaptivePixelsPerMinute = (Events: VesselTimelineEvent[]) =>
  clamp(
    Math.max(1, Events.length) * PIXELS_PER_MINUTE_PER_ROW,
    PIXELS_PER_MINUTE_MIN,
    PIXELS_PER_MINUTE_MAX
  );
