/**
 * Day-level vessel timeline render-state helpers.
 */

import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineSegment,
} from "@/data/contexts";
import { DEFAULT_VESSEL_TIMELINE_LAYOUT } from "../config";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineStaticRenderState,
} from "../types";
import { buildActiveIndicator } from "./buildActiveIndicator";
import { getLayoutTimelineRows } from "./getLayoutTimelineRows";
import { resolveActiveSegmentIndex } from "./resolveActiveSegmentIndex";

/**
 * Builds the static render geometry for a vessel-day timeline.
 */
export const getStaticVesselTimelineRenderState = (
  segments: VesselTimelineSegment[],
  activeState: VesselTimelineActiveState | null,
  layout: VesselTimelineLayoutConfig = DEFAULT_VESSEL_TIMELINE_LAYOUT,
  theme = BASE_TIMELINE_VISUAL_THEME
): VesselTimelineStaticRenderState => {
  const activeSegmentIndex = resolveActiveSegmentIndex(segments, activeState);
  const { rows, rowLayouts, terminalCards, contentHeightPx } =
    getLayoutTimelineRows(segments, activeSegmentIndex, layout);

  return {
    rows,
    rowLayouts,
    terminalCards,
    contentHeightPx,
    activeSegmentIndex,
    layout,
    theme,
  };
};

/**
 * Builds the ticking active-indicator state for a vessel-day timeline.
 */
export const getVesselTimelineActiveIndicator = ({
  segments,
  activeState,
  liveState,
  now = new Date(),
}: {
  segments: VesselTimelineSegment[];
  activeState: VesselTimelineActiveState | null;
  liveState: VesselTimelineLiveState | null;
  now?: Date;
}) =>
  buildActiveIndicator({
    segments,
    activeSegmentIndex: resolveActiveSegmentIndex(segments, activeState),
    activeState,
    liveState,
    now,
  });
