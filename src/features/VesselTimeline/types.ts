/**
 * Shared types for the VesselTimeline feature.
 *
 * Describes the feature-owned row projection and the render-state boundary to
 * the presentation-only `src/components/timeline` renderer.
 */

import type { VesselTimelineEventType } from "convex/functions/vesselTimeline/schemas";
import type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineActiveIndicator,
  TimelineRenderRow,
  TimelineVisualTheme,
} from "@/components/timeline";

/**
 * Layout config for deterministic vessel timeline sizing.
 */
export type VesselTimelineLayoutConfig = {
  rowHeightBasePx: number;
  rowHeightScalePx: number;
  rowHeightExponent: number;
  minRowHeightPx: number;
  terminalCardCapHeightPx: number;
  initialAutoScroll: "center-active-indicator" | "center-active-row" | "none";
  initialScrollAnchorPercent: number;
};

/**
 * Static render state consumed by the timeline UI.
 */
export type VesselTimelineStaticRenderState = {
  rows: TimelineRenderRow[];
  rowLayouts: Record<string, RowLayoutBounds>;
  terminalCards: TerminalCardGeometry[];
  contentHeightPx: number;
  activeRowIndex: number;
  layout: VesselTimelineLayoutConfig;
  theme: TimelineVisualTheme;
};

/**
 * Final render state consumed by the timeline UI.
 */
export type VesselTimelineRenderState = VesselTimelineStaticRenderState & {
  activeIndicator: TimelineActiveIndicator | null;
};

export type VesselTimelineRowPlaceholderReason = "start-of-day";

export type VesselTimelineRowKind = "at-dock" | "at-sea";

export type VesselTimelineRowEdge = "normal" | "terminal-tail";

export type VesselTimelineRowEvent = {
  Key: string;
  ScheduledDeparture: Date;
  TerminalAbbrev: string;
  EventType: VesselTimelineEventType;
  IsArrivalPlaceholder?: boolean;
  EventScheduledTime?: Date;
  EventPredictedTime?: Date;
  EventActualTime?: Date;
};

export type VesselTimelineRow = {
  rowId: string;
  segmentKey: string;
  kind: VesselTimelineRowKind;
  rowEdge: VesselTimelineRowEdge;
  placeholderReason?: VesselTimelineRowPlaceholderReason;
  startEvent: VesselTimelineRowEvent;
  endEvent: VesselTimelineRowEvent;
  durationMinutes: number;
};
