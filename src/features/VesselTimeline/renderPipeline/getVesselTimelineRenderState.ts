/**
 * Public entrypoint for the VesselTimeline render pipeline.
 */

import type {
  VesselTimelineActiveInterval,
  VesselTimelineEvent,
} from "convex/functions/vesselTimeline/schemas";
import type { VesselLocation } from "@/types";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import { DEFAULT_VESSEL_TIMELINE_LAYOUT } from "../config";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
} from "../types";
import type { VesselTimelinePipelineInput } from "./pipelineTypes";
import { toActiveIndicator } from "./toActiveIndicator";
import { toActiveRow } from "./toActiveRow";
import { toDerivedRows } from "./toDerivedRows";
import { toRenderRows } from "./toRenderRows";
import { toTimelineRenderState } from "./toTimelineRenderState";

/**
 * Builds the full VesselTimeline render state from the backend event contract.
 *
 * This keeps the feature pipeline explicit:
 * `events -> derived rows -> active render row -> render rows/layout -> indicator -> final render state`.
 *
 * @param args - Event-first render inputs
 * @param args.events - Ordered backend timeline events for one vessel/day
 * @param args.activeInterval - Client-derived active interval
 * @param args.vesselLocation - Raw live vessel location for indicator copy and motion
 * @param args.getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @param args.layout - Optional feature layout override
 * @param args.now - Optional wall clock override
 * @param args.theme - Optional shared timeline theme override
 * @returns Final render state consumed by `VesselTimelineContent`
 */
export const getVesselTimelineRenderState = ({
  events,
  activeInterval,
  vesselLocation,
  getTerminalNameByAbbrev,
  layout = DEFAULT_VESSEL_TIMELINE_LAYOUT,
  now = new Date(),
  theme = BASE_TIMELINE_VISUAL_THEME,
}: {
  events: VesselTimelineEvent[];
  activeInterval: VesselTimelineActiveInterval;
  vesselLocation: VesselLocation | null;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  layout?: VesselTimelineLayoutConfig;
  now?: Date;
  theme?: VesselTimelinePipelineInput["theme"];
}): VesselTimelineRenderState => {
  const input = {
    events,
    activeInterval,
    vesselLocation,
    getTerminalNameByAbbrev,
    layout,
    now,
    theme,
  } satisfies VesselTimelinePipelineInput;
  const withRows = toDerivedRows(input);
  const withActiveRow = toActiveRow(withRows);
  const withRenderRows = toRenderRows(withActiveRow);
  const withActiveIndicator = toActiveIndicator(withRenderRows);

  return toTimelineRenderState(withActiveIndicator);
};
