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
import { DEFAULT_VESSEL_TIMELINE_LAYOUT } from "../config";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
} from "../types";
import { buildActiveIndicator } from "./buildActiveIndicator";
import { getLayoutTimelineRows } from "./getLayoutTimelineRows";
import { resolveActiveSegmentIndex } from "./resolveActiveSegmentIndex";

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
  const activeSegmentIndex = resolveActiveSegmentIndex(Segments, activeState);
  const { rows, rowLayouts, terminalCards, contentHeightPx } =
    getLayoutTimelineRows(Segments, activeSegmentIndex, layout);

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
    layout,
    theme,
  };
};
