/**
 * Day-level VesselTimeline render-state helpers.
 */

import type {
  VesselTimelineActiveInterval,
  VesselTimelineEvent,
  VesselTimelineLiveState,
} from "convex/functions/vesselTimeline/schemas";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import { DEFAULT_VESSEL_TIMELINE_LAYOUT } from "../config";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
  VesselTimelineRow,
  VesselTimelineStaticRenderState,
} from "../types";
import { buildActiveIndicator } from "./buildActiveIndicator";
import { buildRowsFromEvents } from "./buildRowsFromEvents";
import { getLayoutTimelineRows } from "./getLayoutTimelineRows";

/**
 * Builds the full VesselTimeline render state from the backend event contract.
 *
 * This keeps the feature pipeline explicit:
 * `events -> derived rows -> active render row -> final render state`.
 *
 * @param args - Event-first render inputs
 * @param args.events - Ordered backend timeline events for one vessel/day
 * @param args.activeInterval - Backend-owned active interval
 * @param args.liveState - Raw live vessel state for indicator copy and motion
 * @param args.getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @param args.layout - Optional feature layout override
 * @param args.now - Optional wall clock override
 * @param args.theme - Optional shared timeline theme override
 * @returns Final render state consumed by `VesselTimelineContent`
 */
export const getVesselTimelineRenderState = ({
  events,
  activeInterval,
  liveState,
  getTerminalNameByAbbrev,
  layout = DEFAULT_VESSEL_TIMELINE_LAYOUT,
  now = new Date(),
  theme = BASE_TIMELINE_VISUAL_THEME,
}: {
  events: VesselTimelineEvent[];
  activeInterval: VesselTimelineActiveInterval;
  liveState: VesselTimelineLiveState | null;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  layout?: VesselTimelineLayoutConfig;
  now?: Date;
  theme?: VesselTimelineStaticRenderState["theme"];
}): VesselTimelineRenderState => {
  const rows = buildRowsFromEvents(events);
  const activeRowId = resolveActiveRowId(rows, activeInterval);
  const staticRenderState = getStaticVesselTimelineRenderState(
    rows,
    activeRowId,
    getTerminalNameByAbbrev,
    layout,
    theme
  );

  return {
    ...staticRenderState,
    activeIndicator: getVesselTimelineActiveIndicator({
      rows,
      activeRowId,
      liveState,
      now,
    }),
  };
};

/**
 * Builds the static render geometry for a vessel-day timeline.
 *
 * @param rows - Feature-derived timeline rows for the day
 * @param activeRowId - Active row identifier derived from the backend interval
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @param layout - Optional feature layout override
 * @param theme - Optional shared timeline theme override
 * @returns Static render state for rows, cards, and geometry
 */
export const getStaticVesselTimelineRenderState = (
  rows: VesselTimelineRow[],
  activeRowId: string | null,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null,
  layout: VesselTimelineLayoutConfig = DEFAULT_VESSEL_TIMELINE_LAYOUT,
  theme = BASE_TIMELINE_VISUAL_THEME
): VesselTimelineStaticRenderState => {
  const activeRowIndex = resolveActiveRowIndex(rows, activeRowId);
  const {
    rows: renderRows,
    rowLayouts,
    terminalCards,
    contentHeightPx,
  } = getLayoutTimelineRows(
    rows,
    activeRowIndex,
    layout,
    getTerminalNameByAbbrev
  );

  return {
    rows: renderRows,
    rowLayouts,
    terminalCards,
    contentHeightPx,
    activeRowIndex,
    layout,
    theme,
  };
};

/**
 * Builds the ticking active-indicator state for a vessel-day timeline.
 *
 * @param args - Active-indicator inputs
 * @param args.rows - Feature-derived timeline rows for the day
 * @param args.activeRowId - Active row identifier derived from the backend interval
 * @param args.liveState - Raw live vessel state for subtitle and motion
 * @param args.now - Optional wall clock override
 * @returns Timeline indicator payload, or `null`
 */
export const getVesselTimelineActiveIndicator = ({
  rows,
  activeRowId,
  liveState,
  now = new Date(),
}: {
  rows: VesselTimelineRow[];
  activeRowId: string | null;
  liveState: VesselTimelineLiveState | null;
  now?: Date;
}) =>
  buildActiveIndicator({
    rows,
    activeRowId,
    liveState,
    now,
  });

/**
 * Resolves the active row index from the derived row id.
 *
 * @param rows - Feature-derived timeline rows for the day
 * @param activeRowId - Active row identifier derived from the backend interval
 * @returns Index into `rows`, or `-1` when none is active
 */
const resolveActiveRowIndex = (
  rows: VesselTimelineRow[],
  activeRowId: string | null
) => rows.findIndex((row) => row.rowId === activeRowId);

/**
 * Resolves the active derived row id from the backend-owned active interval.
 *
 * @param rows - Rows derived from the public event payload
 * @param activeInterval - Backend-owned active interval
 * @returns Row id matching the active interval, or `null`
 */
const resolveActiveRowId = (
  rows: VesselTimelineRow[],
  activeInterval: VesselTimelineActiveInterval
) => {
  if (!activeInterval) {
    return null;
  }

  if (activeInterval.kind === "at-sea") {
    return (
      rows.find(
        (row) =>
          row.kind === "at-sea" &&
          row.startEvent.Key === activeInterval.startEventKey &&
          row.endEvent.Key === activeInterval.endEventKey
      )?.rowId ?? null
    );
  }

  if (activeInterval.endEventKey === null) {
    return (
      rows.find(
        (row) =>
          row.kind === "at-dock" &&
          row.rowEdge === "terminal-tail" &&
          row.startEvent.Key === activeInterval.startEventKey
      )?.rowId ?? null
    );
  }

  return (
    rows.find(
      (row) =>
        row.kind === "at-dock" &&
        row.rowEdge === "normal" &&
        row.endEvent.Key === activeInterval.endEventKey
    )?.rowId ?? null
  );
};
