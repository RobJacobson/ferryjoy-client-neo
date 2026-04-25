/**
 * Pure adapter from `RouteTimelineModel` data to `VesselTimeline` render state.
 */

import type { RouteTimelineSnapshot } from "convex/functions/routeTimeline";
import type { TimelineActiveIndicator } from "@/components/timeline";
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
  getDisplayTime,
  type RouteTimelineAxisSpan,
  selectDockVisitVisualSpans,
  selectVesselDockVisits,
} from "@/features/RouteTimelineModel";
import { clamp } from "@/shared/utils";
import type { VesselLocation } from "@/types";
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
  vesselLocation?: VesselLocation | null;
  now?: Date;
  layout?: VesselTimelineLayoutConfig;
  theme?: TimelineVisualTheme;
};

type AdapterRenderRow = {
  row: TimelineRenderRow;
  startY: number;
  spanEdge: "normal" | "start-of-day" | "terminal-tail";
  startTerminalAbbrev?: string;
};

/**
 * Build a `VesselTimelineRenderState` from the route timeline model.
 *
 * @param args - Route-model adapter args
 * @param args.snapshot - Cached route timeline snapshot
 * @param args.vesselAbbrev - Vessel scope for row selection
 * @param args.getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @param args.vesselLocation - Optional vessel location for active indicator
 * @param args.now - Optional active-indicator time source
 * @param args.layout - Optional feature layout override
 * @param args.theme - Optional shared timeline theme override
 * @returns Static render scaffold compatible with the existing timeline renderer
 */
export const fromRouteTimelineModel = ({
  snapshot,
  vesselAbbrev,
  getTerminalNameByAbbrev,
  vesselLocation = null,
  now = new Date(),
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
  const activeSpan = resolveActiveAxisSpan(axisGeometry.spans);
  const activeRowIndex = activeSpan
    ? axisGeometry.spans.findIndex((span) => span.id === activeSpan.id)
    : -1;

  const adaptedRows = axisGeometry.spans.map((span, rowIndex) =>
    toAdapterRow({
      spanId: span.id,
      spanKind: span.kind,
      spanEdge: span.edge,
      startBoundary: span.startBoundary,
      endBoundary: span.endBoundary,
      displayHeightPx: span.heightPx,
      markerAppearance: rowIndex <= activeRowIndex ? "past" : "future",
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
    activeRowIndex,
    layout,
    theme,
    activeIndicator:
      activeRowIndex >= 0 && adaptedRows[activeRowIndex]
        ? getActiveIndicator(adaptedRows[activeRowIndex], vesselLocation, now)
        : null,
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
  markerAppearance: "past" | "future";
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
    spanEdge: args.spanEdge,
    startTerminalAbbrev: startEvent.currTerminalAbbrev,
    row: {
      id: `route-model:${args.spanId}`,
      kind,
      markerAppearance: args.markerAppearance,
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

const INDICATOR_ANIMATION_SPEED_THRESHOLD = 0.1;

/**
 * Resolve active ownership from route-model boundaries and span adjacency.
 *
 * @param spans - Axis spans in display order
 * @returns Active axis span, or `null` when no ownership can be proven
 */
const resolveActiveAxisSpan = (
  spans: Array<RouteTimelineAxisSpan>
): RouteTimelineAxisSpan | null => {
  const latestOccurredBoundary = getLatestOccurredBoundary(spans);
  if (latestOccurredBoundary?.EventType === "dep-dock") {
    return (
      spans.find(
        (span) =>
          span.kind === "crossing" &&
          span.startBoundary?.Key === latestOccurredBoundary.Key
      ) ?? null
    );
  }

  if (latestOccurredBoundary?.EventType === "arv-dock") {
    return (
      spans.find(
        (span) =>
          span.kind === "at-dock" &&
          span.startBoundary?.Key === latestOccurredBoundary.Key
      ) ?? null
    );
  }

  return spans.find((span) => span.kind === "at-dock") ?? null;
};

/**
 * Find the latest occurred boundary in span order.
 *
 * @param spans - Axis spans in display order
 * @returns Latest occurred boundary, or `undefined`
 */
const getLatestOccurredBoundary = (spans: Array<RouteTimelineAxisSpan>) => {
  const boundaries = spans.flatMap((span) => [
    span.startBoundary,
    span.endBoundary,
  ]);

  return [...boundaries]
    .reverse()
    .find(
      (boundary) =>
        boundary?.EventOccurred === true ||
        boundary?.EventActualTime !== undefined
    );
};

/**
 * Build the active indicator payload for the selected adapted row.
 *
 * @param adaptedRow - Selected adapted row and source span metadata
 * @param vesselLocation - Optional vessel location snapshot
 * @param now - Current wall-clock instant
 * @returns Active indicator payload
 */
const getActiveIndicator = (
  adaptedRow: AdapterRenderRow,
  vesselLocation: VesselLocation | null,
  now: Date
): TimelineActiveIndicator => ({
  rowId: adaptedRow.row.id,
  positionPercent: getIndicatorPositionPercent(adaptedRow, vesselLocation, now),
  label: getMinutesUntil(adaptedRow, now),
  title: vesselLocation?.VesselName,
  subtitle: getIndicatorSubtitle(adaptedRow, vesselLocation),
  animate: shouldAnimateIndicator(adaptedRow, vesselLocation),
  speedKnots: vesselLocation?.Speed ?? 0,
});

/**
 * Resolve indicator position within the active row.
 *
 * @param adaptedRow - Selected adapted row and source span metadata
 * @param vesselLocation - Optional vessel location snapshot
 * @param now - Current wall-clock instant
 * @returns Clamped row-local position
 */
const getIndicatorPositionPercent = (
  adaptedRow: AdapterRenderRow,
  vesselLocation: VesselLocation | null,
  now: Date
) => {
  if (adaptedRow.row.kind === "at-dock") {
    if (adaptedRow.spanEdge === "terminal-tail") {
      return 0;
    }
    if (adaptedRow.spanEdge === "start-of-day") {
      return easeInSine(getTimeProgress(adaptedRow.row, now));
    }

    const startTime = getDisplayTimeFromRenderEvent(adaptedRow.row.startEvent);
    if (!startTime || startTime.getTime() > now.getTime()) {
      return 0.5;
    }

    return getTimeProgress(adaptedRow.row, now);
  }

  if (
    vesselLocation?.DepartingDistance !== undefined &&
    vesselLocation?.ArrivingDistance !== undefined
  ) {
    return getDistanceProgress(
      vesselLocation.DepartingDistance,
      vesselLocation.ArrivingDistance
    );
  }

  return getTimeProgress(adaptedRow.row, now);
};

/**
 * Calculate in-transit progress from live distance telemetry.
 *
 * @param departingDistance - Distance from the vessel to the departing terminal
 * @param arrivingDistance - Distance from the vessel to the arriving terminal
 * @returns Clamped distance ratio
 */
const getDistanceProgress = (
  departingDistance: number,
  arrivingDistance: number
) =>
  clamp(
    departingDistance /
      Math.max(1e-9, departingDistance + Math.max(0, arrivingDistance)),
    0,
    1
  );

/**
 * Calculate display-time progress for one render row.
 *
 * @param row - Render row containing start/end event times
 * @param now - Current wall-clock instant
 * @returns Clamped elapsed progress
 */
const getTimeProgress = (row: TimelineRenderRow, now: Date) =>
  getClampedProgress(
    getDisplayTimeFromRenderEvent(row.startEvent),
    getDisplayTimeFromRenderEvent(row.endEvent),
    now
  );

/**
 * Resolve display precedence instant from a renderer event.
 *
 * @param event - Renderer-facing event boundary
 * @returns Display-precedence instant, when available
 */
const getDisplayTimeFromRenderEvent = (
  event: TimelineRenderEvent | undefined
): Date | undefined =>
  getDisplayTime(
    event
      ? {
          Key: "",
          SegmentKey: "",
          TerminalAbbrev: event.currTerminalAbbrev ?? "",
          EventType: event.eventType === "depart" ? "dep-dock" : "arv-dock",
          EventScheduledTime: event.timePoint.scheduled,
          EventPredictedTime: event.timePoint.estimated,
          EventOccurred: event.timePoint.actual ? true : undefined,
          EventActualTime: event.timePoint.actual,
        }
      : undefined
  );

/**
 * Calculate clamped elapsed progress between two instants.
 *
 * @param startTime - Interval start time
 * @param endTime - Interval end time
 * @param now - Current wall-clock instant
 * @returns Clamped elapsed progress
 */
const getClampedProgress = (
  startTime: Date | undefined,
  endTime: Date | undefined,
  now: Date
) => {
  if (!startTime || !endTime) {
    return 0;
  }

  const totalMs = endTime.getTime() - startTime.getTime();
  if (totalMs <= 0) {
    return 0;
  }

  return clamp((now.getTime() - startTime.getTime()) / totalMs, 0, 1);
};

/**
 * Apply easing for compressed start-of-day dock visuals.
 *
 * @param progress - Clamped interval progress
 * @returns Eased progress
 */
const easeInSine = (progress: number) =>
  1 - Math.cos((Math.PI / 2) * clamp(progress, 0, 1));

/**
 * Build the indicator countdown label.
 *
 * @param adaptedRow - Selected adapted row and source span metadata
 * @param now - Current wall-clock instant
 * @returns Minutes-until label, or `"--"`
 */
const getMinutesUntil = (adaptedRow: AdapterRenderRow, now: Date) => {
  if (adaptedRow.spanEdge === "terminal-tail") {
    return "--";
  }

  const targetTime = getDisplayTimeFromRenderEvent(adaptedRow.row.endEvent);
  if (!targetTime) {
    return "--";
  }

  const remainingMinutes = Math.max(
    0,
    Math.ceil((targetTime.getTime() - now.getTime()) / 60_000)
  );
  return `${remainingMinutes}m`;
};

/**
 * Build indicator subtitle copy from row kind and vessel telemetry.
 *
 * @param adaptedRow - Selected adapted row and source span metadata
 * @param vesselLocation - Optional vessel location snapshot
 * @returns Indicator subtitle copy, or `undefined`
 */
const getIndicatorSubtitle = (
  adaptedRow: AdapterRenderRow,
  vesselLocation: VesselLocation | null
) =>
  adaptedRow.row.kind === "at-dock"
    ? getDockSubtitle(adaptedRow.row, vesselLocation)
    : getSeaSubtitle(vesselLocation);

/**
 * Build dock-state subtitle copy.
 *
 * @param row - Active dock row
 * @param vesselLocation - Optional vessel location snapshot
 * @returns Dock subtitle copy, or `undefined`
 */
const getDockSubtitle = (
  row: TimelineRenderRow,
  vesselLocation: VesselLocation | null
) => {
  const terminalAbbrev =
    vesselLocation?.DepartingTerminalAbbrev ??
    row.endEvent?.currTerminalAbbrev ??
    row.startEvent.currTerminalAbbrev;

  return terminalAbbrev ? `At dock ${terminalAbbrev}` : undefined;
};

/**
 * Build at-sea subtitle copy.
 *
 * @param vesselLocation - Optional vessel location snapshot
 * @returns At-sea subtitle copy, or `undefined`
 */
const getSeaSubtitle = (vesselLocation: VesselLocation | null) => {
  if (!vesselLocation) {
    return undefined;
  }

  const speed = vesselLocation.Speed ?? 0;
  if (vesselLocation.ArrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }

  const terminalPart = vesselLocation.ArrivingTerminalAbbrev
    ? ` to ${vesselLocation.ArrivingTerminalAbbrev}`
    : "";

  return `${speed.toFixed(0)} kn · ${vesselLocation.ArrivingDistance.toFixed(
    1
  )} mi${terminalPart}`;
};

/**
 * Determine whether the active indicator should animate.
 *
 * @param adaptedRow - Selected adapted row and source span metadata
 * @param vesselLocation - Optional vessel location snapshot
 * @returns Whether indicator animation should run
 */
const shouldAnimateIndicator = (
  adaptedRow: AdapterRenderRow,
  vesselLocation: VesselLocation | null
) =>
  adaptedRow.row.kind === "at-sea" &&
  vesselLocation?.InService !== false &&
  vesselLocation?.AtDock !== true &&
  (vesselLocation?.Speed ?? 0) > INDICATOR_ANIMATION_SPEED_THRESHOLD;
