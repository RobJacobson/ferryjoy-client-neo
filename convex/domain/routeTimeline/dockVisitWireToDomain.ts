/**
 * Converts route-timeline dock visit and boundary wire shapes (epoch ms) into
 * the domain `Date`-based shapes used by visual-span selectors.
 */

import type {
  ConvexRouteTimelineBoundary,
  ConvexRouteTimelineDockVisit,
} from "../../functions/routeTimeline";
import { optionalEpochMsToDate } from "../../shared/convertDates";

/**
 * Converts one route timeline boundary from epoch ms to domain `Date` fields.
 *
 * @param boundary - Wire boundary row
 * @returns Domain boundary with optional `Date` times and normalized
 * `EventOccurred` when an actual time is present
 */
const wireRouteTimelineBoundaryToDomain = (
  boundary: ConvexRouteTimelineBoundary
) => ({
  ...boundary,
  EventScheduledTime: optionalEpochMsToDate(boundary.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(boundary.EventPredictedTime),
  EventOccurred:
    boundary.EventOccurred ??
    (boundary.EventActualTime !== undefined ? true : undefined),
  EventActualTime: optionalEpochMsToDate(boundary.EventActualTime),
});

/**
 * Converts one wire dock visit to the domain shape expected by span geometry.
 *
 * @param visit - Wire dock visit
 * @returns Same visit with `Arrival` / `Departure` passed through the boundary
 * converter when present
 */
const wireRouteTimelineDockVisitToDomain = (
  visit: ConvexRouteTimelineDockVisit
) => ({
  ...visit,
  Arrival: visit.Arrival
    ? wireRouteTimelineBoundaryToDomain(visit.Arrival)
    : undefined,
  Departure: visit.Departure
    ? wireRouteTimelineBoundaryToDomain(visit.Departure)
    : undefined,
});

export {
  wireRouteTimelineBoundaryToDomain,
  wireRouteTimelineDockVisitToDomain,
};
