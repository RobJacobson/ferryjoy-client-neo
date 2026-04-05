/**
 * Internal pipeline types for the VesselTimeline render-pipeline stages.
 *
 * These types are local to the render-pipeline folder so the public feature
 * `types.ts` stays focused on stable UI-facing boundaries.
 */

import type {
  VesselTimelineActiveInterval,
  VesselTimelineEvent,
  VesselTimelineLiveState,
} from "convex/functions/vesselTimeline/schemas";
import type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineActiveIndicator,
  TimelineRenderRow,
  TimelineVisualTheme,
} from "@/components/timeline";
import type { VesselTimelineLayoutConfig, VesselTimelineRow } from "../types";

/**
 * Full input consumed by the internal render pipeline.
 */
export type VesselTimelinePipelineInput = {
  events: VesselTimelineEvent[];
  activeInterval: VesselTimelineActiveInterval;
  liveState: VesselTimelineLiveState | null;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  layout: VesselTimelineLayoutConfig;
  now: Date;
  theme: TimelineVisualTheme;
};

/**
 * Pipeline context after deriving feature-owned rows from backend events.
 */
export type VesselTimelinePipelineWithRows = VesselTimelinePipelineInput & {
  rows: VesselTimelineRow[];
};

/**
 * Selected active row used by later rendering stages.
 */
export type VesselTimelineActiveRow = {
  row: VesselTimelineRow;
  rowIndex: number;
};

/**
 * Pipeline context after mapping the backend active interval to a local row.
 */
export type VesselTimelinePipelineWithActiveRow =
  VesselTimelinePipelineWithRows & {
    activeRow: VesselTimelineActiveRow | null;
  };

/**
 * Renderer-facing row geometry and layout state.
 */
export type VesselTimelineRenderRowsState = {
  renderRows: TimelineRenderRow[];
  rowLayouts: Record<string, RowLayoutBounds>;
  terminalCards: TerminalCardGeometry[];
  contentHeightPx: number;
  activeRowIndex: number;
};

/**
 * Pipeline context after shaping renderer rows and layout geometry.
 */
export type VesselTimelinePipelineWithRenderRows =
  VesselTimelinePipelineWithActiveRow & VesselTimelineRenderRowsState;

/**
 * Pipeline context after deriving the active indicator overlay payload.
 */
export type VesselTimelinePipelineWithActiveIndicator =
  VesselTimelinePipelineWithRenderRows & {
    activeIndicator: TimelineActiveIndicator | null;
  };
