/**
 * Day-level VesselTimeline render-state helpers.
 */

import type {
  VesselTimelineLiveState,
} from "convex/functions/vesselTimeline/schemas";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import { DEFAULT_VESSEL_TIMELINE_LAYOUT } from "../config";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRow,
  VesselTimelineStaticRenderState,
} from "../types";
import { buildActiveIndicator } from "./buildActiveIndicator";
import { getLayoutTimelineRows } from "./getLayoutTimelineRows";

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
