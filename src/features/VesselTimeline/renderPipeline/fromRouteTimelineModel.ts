/**
 * Pure adapter from `RouteTimelineModel` data to `VesselTimeline` render state.
 */

import type { RouteTimelineSnapshot } from "convex/functions/routeTimeline";
import type { TimelineVisualTheme } from "@/components/timeline/theme";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineRenderEvent,
  TimelineRenderRow,
} from "@/components/timeline/types";
import {
  deriveRouteTimelineAxisGeometry,
  selectDockVisitVisualSpans,
  selectVesselDockVisits,
} from "@/features/RouteTimelineModel";
import {
  DEFAULT_VESSEL_TIMELINE_LAYOUT,
  START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
} from "../config";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRenderState,
} from "../types";

type RouteModelAdapterArgs = {
  snapshot: RouteTimelineSnapshot | null;
  vesselAbbrev: string;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  layout?: VesselTimelineLayoutConfig;
  theme?: TimelineVisualTheme;
};

type AdapterRenderRow = {
  row: TimelineRenderRow;
  startY: number;
  startTerminalAbbrev?: string;
};

/**
 * Build a static `VesselTimelineRenderState` from the route timeline model.
 *
 * This stage intentionally leaves active indicator behavior for a later pass.
 *
 * @param args - Route-model adapter args
 * @param args.snapshot - Cached route timeline snapshot
 * @param args.vesselAbbrev - Vessel scope for row selection
 * @param args.getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @param args.layout - Optional feature layout override
 * @param args.theme - Optional shared timeline theme override
 * @returns Static render scaffold compatible with the existing timeline renderer
 */
export const fromRouteTimelineModel = ({
  snapshot,
  vesselAbbrev,
  getTerminalNameByAbbrev,
  layout = DEFAULT_VESSEL_TIMELINE_LAYOUT,
  theme = BASE_TIMELINE_VISUAL_THEME,
}: RouteModelAdapterArgs): VesselTimelineRenderState => {
  const dockVisits = selectVesselDockVisits(snapshot, vesselAbbrev);
  if (dockVisits.length === 0) {
    return buildEmptyRenderState(layout, theme);
  }

  const spans = selectDockVisitVisualSpans(dockVisits);
  if (spans.length === 0) {
    return buildEmptyRenderState(layout, theme);
  }

  const axisGeometry = deriveRouteTimelineAxisGeometry(spans, {
    rowHeightBasePx: layout.rowHeightBasePx,
    rowHeightScalePx: layout.rowHeightScalePx,
    rowHeightExponent: layout.rowHeightExponent,
    minSpanHeightPx: layout.minRowHeightPx,
    startOfDayDockVisualCapMinutes: START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
  });

  const adaptedRows = axisGeometry.spans.map((span, rowIndex) =>
    toAdapterRow({
      spanId: span.id,
      spanKind: span.kind,
      spanEdge: span.edge,
      startBoundary: span.startBoundary,
      endBoundary: span.endBoundary,
      displayHeightPx: span.heightPx,
      rowIndex,
      startY: span.startY,
      getTerminalNameByAbbrev,
    })
  );
  const rows = adaptedRows.map((entry) => entry.row);
  const rowLayouts = adaptedRows.reduce<Record<string, RowLayoutBounds>>(
    (accumulator, entry) => ({
      ...accumulator,
      [entry.row.id]: {
        y: entry.startY,
        height: entry.row.displayHeightPx,
      },
    }),
    {}
  );

  return {
    rows,
    rowLayouts,
    terminalCards: computeTerminalCards(adaptedRows, layout),
    contentHeightPx: axisGeometry.contentHeightPx,
    activeRowIndex: -1,
    layout,
    theme,
    activeIndicator: null,
  };
};

/**
 * Build an empty static render scaffold.
 *
 * @param layout - Feature layout configuration
 * @param theme - Shared timeline theme
 * @returns Empty render scaffold
 */
const buildEmptyRenderState = (
  layout: VesselTimelineLayoutConfig,
  theme: TimelineVisualTheme
): VesselTimelineRenderState => ({
  rows: [],
  rowLayouts: {},
  terminalCards: [],
  contentHeightPx: 0,
  activeRowIndex: -1,
  layout,
  theme,
  activeIndicator: null,
});

/**
 * Map one route-model axis span into a renderer row.
 *
 * @param args - Adapter row mapping inputs
 * @returns Renderer row with start-Y metadata
 */
const toAdapterRow = (args: {
  spanId: string;
  spanKind: "at-dock" | "crossing";
  spanEdge: "normal" | "start-of-day" | "terminal-tail";
  startBoundary?: {
    EventType: "arv-dock" | "dep-dock";
    TerminalAbbrev: string;
    EventScheduledTime?: Date;
    EventPredictedTime?: Date;
    EventActualTime?: Date;
  };
  endBoundary?: {
    EventType: "arv-dock" | "dep-dock";
    TerminalAbbrev: string;
    EventScheduledTime?: Date;
    EventPredictedTime?: Date;
    EventActualTime?: Date;
  };
  displayHeightPx: number;
  rowIndex: number;
  startY: number;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
}): AdapterRenderRow => {
  const kind = args.spanKind === "crossing" ? "at-sea" : "at-dock";
  const startEvent = toRenderEvent({
    kind,
    side: "start",
    startBoundary: args.startBoundary,
    endBoundary: args.endBoundary,
    getTerminalNameByAbbrev: args.getTerminalNameByAbbrev,
  });
  const endEvent = toRenderEvent({
    kind,
    side: "end",
    startBoundary: args.startBoundary,
    endBoundary: args.endBoundary,
    getTerminalNameByAbbrev: args.getTerminalNameByAbbrev,
  });

  return {
    startY: args.startY,
    startTerminalAbbrev: startEvent.currTerminalAbbrev,
    row: {
      id: `route-model:${args.spanId}`,
      kind,
      markerAppearance: "future",
      segmentIndex: args.rowIndex,
      displayHeightPx: args.displayHeightPx,
      startLabel: getStartEventLabel(startEvent),
      showStartTimePlaceholder: shouldShowStartTimePlaceholder(startEvent),
      terminalHeadline: getTerminalHeadline(startEvent),
      startEvent,
      endEvent,
      isFinalRow: args.spanEdge === "terminal-tail",
    },
  };
};

/**
 * Convert one span boundary side into a renderer-facing event.
 *
 * @param args - Render-event mapping inputs
 * @returns Shared renderer event
 */
const toRenderEvent = (args: {
  kind: "at-dock" | "at-sea";
  side: "start" | "end";
  startBoundary?: {
    EventType: "arv-dock" | "dep-dock";
    TerminalAbbrev: string;
    EventScheduledTime?: Date;
    EventPredictedTime?: Date;
    EventActualTime?: Date;
  };
  endBoundary?: {
    EventType: "arv-dock" | "dep-dock";
    TerminalAbbrev: string;
    EventScheduledTime?: Date;
    EventPredictedTime?: Date;
    EventActualTime?: Date;
  };
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
}): TimelineRenderEvent => {
  const boundary =
    args.side === "start" ? args.startBoundary : args.endBoundary;
  const oppositeBoundary =
    args.side === "start" ? args.endBoundary : args.startBoundary;
  const eventType =
    args.side === "start"
      ? args.kind === "at-dock"
        ? "arrive"
        : "depart"
      : args.kind === "at-dock"
        ? "depart"
        : "arrive";

  return {
    eventType,
    currTerminalAbbrev: boundary?.TerminalAbbrev,
    currTerminalDisplayName: getDisplayTerminalName(
      boundary?.TerminalAbbrev,
      args.getTerminalNameByAbbrev
    ),
    nextTerminalAbbrev:
      args.side === "start" && args.kind === "at-sea"
        ? oppositeBoundary?.TerminalAbbrev
        : undefined,
    isArrivalPlaceholder:
      args.side === "start" &&
      args.kind === "at-dock" &&
      boundary?.EventType === "dep-dock",
    timePoint: {
      scheduled: boundary?.EventScheduledTime,
      actual: boundary?.EventActualTime,
      estimated: boundary?.EventPredictedTime,
    },
  };
};

/**
 * Build the compact row-start label used by the timeline renderer.
 *
 * @param event - Renderer-facing start event
 * @returns Start label text
 */
const getStartEventLabel = (event: TimelineRenderEvent) =>
  event.eventType === "arrive"
    ? event.currTerminalAbbrev
      ? `Arv: ${event.currTerminalAbbrev}`
      : "Arv"
    : event.nextTerminalAbbrev
      ? `To: ${event.nextTerminalAbbrev}`
      : "Dep";

/**
 * Resolve dock terminal headline text.
 *
 * @param event - Renderer-facing start event
 * @returns Terminal headline for dock rows
 */
const getTerminalHeadline = (event: TimelineRenderEvent) =>
  event.eventType === "arrive" ? event.currTerminalDisplayName : undefined;

/**
 * Whether the start row should reserve the secondary-time placeholder slot.
 *
 * @param event - Renderer-facing start event
 * @returns Placeholder visibility
 */
const shouldShowStartTimePlaceholder = (event: TimelineRenderEvent): boolean =>
  event.isArrivalPlaceholder === true ||
  event.timePoint.scheduled !== undefined;

/**
 * Resolve terminal display name with fallback and abbreviation style.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @param getTerminalNameByAbbrev - Terminal-name lookup
 * @returns Display terminal name, or `undefined`
 */
const getDisplayTerminalName = (
  terminalAbbrev: string | undefined,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  if (!terminalName) {
    return terminalAbbrev;
  }

  return terminalName.replace(/Island\b/, "Is.").trim();
};

/**
 * Build terminal-card geometry for dock rows and adjacent paired sea rows.
 *
 * @param rows - Adapted rows with geometry metadata
 * @param layout - Feature layout config
 * @returns Terminal-card geometry list
 */
const computeTerminalCards = (
  rows: Array<AdapterRenderRow>,
  layout: VesselTimelineLayoutConfig
): Array<TerminalCardGeometry> => {
  const terminalCards: Array<TerminalCardGeometry> = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const current = rows[rowIndex];
    if (!current) {
      continue;
    }

    const cardRole = getCardRole(rows, rowIndex);
    if (!cardRole || cardRole === "pair-bottom") {
      continue;
    }

    terminalCards.push({
      id: current.row.id,
      position: "single",
      topPx: current.startY - layout.terminalCardCapHeightPx,
      heightPx:
        cardRole === "merged-top"
          ? current.row.displayHeightPx + layout.terminalCardCapHeightPx * 2
          : current.row.displayHeightPx,
    });
  }

  return terminalCards;
};

/**
 * Classify terminal-card rendering role for one row.
 *
 * @param rows - Adapted rows in render order
 * @param rowIndex - Row index to classify
 * @returns Card role token, or `null`
 */
const getCardRole = (
  rows: Array<AdapterRenderRow>,
  rowIndex: number
): "merged-top" | "pair-bottom" | "single" | null => {
  const current = rows[rowIndex];
  if (!current) {
    return null;
  }

  const previous = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
  const next = rows[rowIndex + 1];
  const terminalAbbrev = current.startTerminalAbbrev;
  const matchesNext =
    current.row.kind === "at-dock" &&
    next?.row.kind === "at-sea" &&
    terminalAbbrev !== undefined &&
    terminalAbbrev === next.startTerminalAbbrev;
  const matchesPrevious =
    previous?.row.kind === "at-dock" &&
    current.row.kind === "at-sea" &&
    previous.startTerminalAbbrev !== undefined &&
    previous.startTerminalAbbrev === terminalAbbrev;

  if (matchesNext) {
    return "merged-top";
  }

  if (matchesPrevious) {
    return "pair-bottom";
  }

  return current.row.kind === "at-dock" && terminalAbbrev ? "single" : null;
};
