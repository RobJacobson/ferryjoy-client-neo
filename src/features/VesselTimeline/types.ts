/**
 * Shared types for the VesselTimeline feature.
 *
 * Describes the day-level pipeline from backend `VesselTimelineEvent` rows to
 * `VesselTimelineRenderState`. See `ARCHITECTURE.md` for stage boundaries and
 * data ownership.
 */

import type {
  TerminalCardGeometry,
  TimelineActiveIndicator,
  TimelineRenderRow,
  TimelineVisualTheme,
} from "@/components/timeline";
import type { VesselTimelineEvent } from "@/data/contexts";

/**
 * Supported row kinds for the day-level timeline.
 */
export type VesselTimelineRowKind = "dock" | "sea";

/**
 * Display strategy for a row.
 */
export type VesselTimelineRowDisplayMode =
  | "proportional"
  | "compressed-dock-break";

/**
 * Product policy for timeline semantics independent from pixel layout.
 */
export type VesselTimelinePolicy = {
  compressedDockThresholdMinutes: number;
  compressedDockArrivalStubMinutes: number;
  compressedDockDepartureWindowMinutes: number;
};

/**
 * Feature-local event shape carried by a semantic row.
 */
export type TimelineRowEvent = VesselTimelineEvent & {
  TerminalDisplayName?: string;
  IsArrivalPlaceholder?: boolean;
};

/**
 * Semantic row model for the day-level timeline.
 *
 * Each row is defined by the adjacent event pair that brackets it.
 */
export type TimelineSemanticRow = {
  id: string;
  segmentIndex: number;
  kind: VesselTimelineRowKind;
  isTerminal?: boolean;
  startEvent: TimelineRowEvent;
  endEvent: TimelineRowEvent;
  actualDurationMinutes: number;
  displayDurationMinutes: number;
  displayMode: VesselTimelineRowDisplayMode;
};

/**
 * Layout config for deterministic vessel timeline sizing.
 */
export type VesselTimelineLayoutConfig = {
  pixelsPerMinute: number;
  minRowHeightPx: number;
  compressedBreakMarkerHeightPx: number;
  terminalCardTopOffsetPx: number;
  terminalCardDepartureCapHeightPx: number;
  initialAutoScroll: "center-active-indicator" | "center-active-row" | "none";
  initialScrollAnchorPercent: number;
};

/**
 * Final render state consumed by the timeline UI.
 */
export type VesselTimelineRenderState = {
  rows: TimelineRenderRow[];
  terminalCards: TerminalCardGeometry[];
  activeIndicator: TimelineActiveIndicator | null;
  contentHeightPx: number;
  layout: VesselTimelineLayoutConfig;
  theme: TimelineVisualTheme;
};
