/**
 * Day-level vessel timeline pipeline entry point.
 */

import type { VesselLocation, VesselTimelineTrip } from "@/data/contexts";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
} from "../../types";
import { getBoundaryData } from "./boundaries";
import { getDocument } from "./document";
import { renderRows } from "./renderRows";
import { renderState } from "./renderState";
import { getRows } from "./rows";

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
  const boundaryData = getBoundaryData(trips);
  const rows = getRows(trips, boundaryData, layout);
  const document = getDocument(trips, rows, vesselLocation, now);
  const renderRowsOut = renderRows(document, layout);
  return renderState(document, renderRowsOut, layout, now);
};
