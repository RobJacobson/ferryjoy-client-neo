/**
 * Day-level vessel timeline pipeline entry point.
 */

import type { VesselLocation, VesselTimelineTrip } from "@/data/contexts";
import { clamp } from "@/shared/utils";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
} from "../../types";
import { getBoundaryData } from "./boundaries";
import { getDocument } from "./document";
import { renderRows } from "./renderRows";
import { renderState } from "./renderState";
import { getRows } from "./rows";

const PIXELS_PER_MINUTE_MIN = 4;
const PIXELS_PER_MINUTE_MAX = 8;
const PIXELS_PER_MINUTE_PER_ROW = 0.1;

/**
 * Default display/layout config for the vessel-day timeline.
 */
export const DEFAULT_VESSEL_TIMELINE_LAYOUT: VesselTimelineLayoutConfig = {
  pixelsPerMinute: 4,
  minRowHeightPx: 64,
  compressedBreakThresholdMinutes: 60,
  compressedBreakMarkerHeightPx: 20,
  compressedBreakStubMinutes: 10,
  compressedBreakDepartureWindowMinutes: 50,
  initialAutoScroll: "center-active-indicator",
  initialScrollAnchorPercent: 0.5,
};

/**
 * Runs the vessel-day timeline pipeline from normalized trips to render state.
 *
 * @param trips - Ordered normalized trips for one vessel/day
 * @param vesselLocation - Current vessel location for the selected vessel
 * @param now - Current wall-clock time
 * @param layout - Optional layout override
 * @returns Final render state for the VesselTimeline UI
 */
export const getVesselTimelineRenderState = (
  trips: VesselTimelineTrip[],
  vesselLocation: VesselLocation | undefined,
  now: Date = new Date(),
  layout: VesselTimelineLayoutConfig = DEFAULT_VESSEL_TIMELINE_LAYOUT
): VesselTimelineRenderState => {
  const adjustedLayout = {
    ...layout,
    pixelsPerMinute: getAdaptivePixelsPerMinute(trips),
  };
  const boundaryData = getBoundaryData(trips);
  const rows = getRows(trips, boundaryData, adjustedLayout);
  const document = getDocument(trips, rows, vesselLocation, now);
  const renderRowsOut = renderRows(document, adjustedLayout);
  return renderState(document, renderRowsOut, adjustedLayout, now);
};

/**
 * Derives pixels-per-minute from the approximate number of visible rows.
 *
 * This uses a single tunable multiplier and clamps the result to keep sparse
 * routes compact while preserving enough vertical space for dense schedules.
 *
 * @param trips - Ordered normalized trips for one vessel/day
 * @returns Adaptive pixels-per-minute ratio for the timeline
 */
export const getAdaptivePixelsPerMinute = (trips: VesselTimelineTrip[]) =>
  clamp(
    (trips.length + Math.max(0, trips.length - 1) + 1) *
      PIXELS_PER_MINUTE_PER_ROW,
    PIXELS_PER_MINUTE_MIN,
    PIXELS_PER_MINUTE_MAX
  );
