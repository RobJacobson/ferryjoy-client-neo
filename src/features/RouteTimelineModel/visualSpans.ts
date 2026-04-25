/**
 * Pure visual-span derivation from ordered route timeline dock visits.
 */

import type {
  RouteTimelineBoundary,
  RouteTimelineDockVisit,
} from "convex/functions/routeTimeline";

export type RouteTimelineVisualSpanKind = "at-dock" | "crossing";
export type RouteTimelineVisualSpanEdge =
  | "normal"
  | "start-of-day"
  | "terminal-tail";

export type RouteTimelineVisualSpan = {
  id: string;
  kind: RouteTimelineVisualSpanKind;
  edge: RouteTimelineVisualSpanEdge;
  fromVisitKey?: string;
  toVisitKey?: string;
  startBoundary?: RouteTimelineBoundary;
  endBoundary?: RouteTimelineBoundary;
};

/**
 * Derive ordered visual spans from one vessel's ordered dock visits.
 *
 * @param dockVisits - Ordered dock visits for a selected vessel/trip/journey
 * @returns Ordered visual spans suitable for downstream axis geometry
 */
export const selectDockVisitVisualSpans = (
  dockVisits: Array<RouteTimelineDockVisit>
): Array<RouteTimelineVisualSpan> => {
  const spans: Array<RouteTimelineVisualSpan> = [];

  for (let index = 0; index < dockVisits.length; index++) {
    const visit = dockVisits[index];
    if (!visit) {
      continue;
    }

    const dockSpan = toDockSpan(visit, index, dockVisits.length);
    if (dockSpan) {
      spans.push(dockSpan);
    }

    const nextVisit = dockVisits[index + 1];
    const crossingSpan = toCrossingSpan(visit, nextVisit);
    if (crossingSpan) {
      spans.push(crossingSpan);
    }
  }

  return spans;
};

/**
 * Build one dock span for a visit when enough boundary context exists.
 *
 * @param visit - Dock visit under evaluation
 * @param visitIndex - Visit index in sorted order
 * @param visitCount - Total visit count
 * @returns Dock span or undefined when missing both boundaries
 */
const toDockSpan = (
  visit: RouteTimelineDockVisit,
  visitIndex: number,
  visitCount: number
): RouteTimelineVisualSpan | undefined => {
  const hasArrival = visit.Arrival !== undefined;
  const hasDeparture = visit.Departure !== undefined;

  if (!hasArrival && !hasDeparture) {
    return undefined;
  }

  const edge =
    !hasArrival && hasDeparture && visitIndex === 0
      ? "start-of-day"
      : hasArrival && !hasDeparture && visitIndex === visitCount - 1
        ? "terminal-tail"
        : "normal";

  const startBoundary = visit.Arrival ?? visit.Departure;
  const endBoundary = visit.Departure ?? visit.Arrival;

  return {
    id: getDockSpanId(visit, edge, startBoundary, endBoundary),
    kind: "at-dock",
    edge,
    fromVisitKey: visit.Key,
    toVisitKey: visit.Key,
    startBoundary,
    endBoundary,
  };
};

/**
 * Build one crossing span from adjacent visits.
 *
 * @param currentVisit - Current visit that may provide departure boundary
 * @param nextVisit - Next visit that may provide arrival boundary
 * @returns Crossing span when both boundary endpoints are present
 */
const toCrossingSpan = (
  currentVisit: RouteTimelineDockVisit,
  nextVisit: RouteTimelineDockVisit | undefined
): RouteTimelineVisualSpan | undefined => {
  if (!nextVisit || !currentVisit.Departure || !nextVisit.Arrival) {
    return undefined;
  }

  return {
    id: getCrossingSpanId(currentVisit, nextVisit),
    kind: "crossing",
    edge: "normal",
    fromVisitKey: currentVisit.Key,
    toVisitKey: nextVisit.Key,
    startBoundary: currentVisit.Departure,
    endBoundary: nextVisit.Arrival,
  };
};

/**
 * Build a deterministic dock span identifier.
 *
 * @param visit - Visit for which dock span is created
 * @param edge - Dock edge classification
 * @param startBoundary - Effective start boundary
 * @param endBoundary - Effective end boundary
 * @returns Stable dock span id
 */
const getDockSpanId = (
  visit: RouteTimelineDockVisit,
  edge: RouteTimelineVisualSpanEdge,
  startBoundary: RouteTimelineBoundary | undefined,
  endBoundary: RouteTimelineBoundary | undefined
): string =>
  `dock:${visit.Key}:${edge}:${startBoundary?.Key ?? "none"}:${endBoundary?.Key ?? "none"}`;

/**
 * Build a deterministic crossing span identifier from adjacent visit keys.
 *
 * @param currentVisit - Crossing origin visit
 * @param nextVisit - Crossing destination visit
 * @returns Stable crossing span id
 */
const getCrossingSpanId = (
  currentVisit: RouteTimelineDockVisit,
  nextVisit: RouteTimelineDockVisit
): string => `crossing:${currentVisit.Key}->${nextVisit.Key}`;
