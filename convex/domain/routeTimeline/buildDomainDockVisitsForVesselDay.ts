/**
 * Pure helper: vessel/day scheduled, actual, and predicted rows → ordered
 * domain dock visits for `RouteTimelineModel` span derivation (same merge and
 * visit pairing as `buildRouteTimelineSnapshot` for one vessel).
 */

import type { RouteTimelineDockVisit } from "../../functions/routeTimeline";
import type { ConvexActualDockEvent } from "../events/actual/schemas";
import type { ConvexPredictedDockEvent } from "../events/predicted/schemas";
import type { ConvexScheduledDockEvent } from "../events/scheduled/schemas";
import { mergeTimelineRows } from "../timelineRows";
import { wireRouteTimelineDockVisitToDomain } from "./dockVisitWireToDomain";
import { mergedEventsToWireDockVisits } from "./mergedEventsToWireDockVisits";

type BuildDomainDockVisitsForVesselDayArgs = {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
  vesselAbbrev: string;
  sailingDay: string;
};

/**
 * Filters scheduled dock rows to the given sailing day and vessel.
 *
 * @param events - Scheduled dock events
 * @param sailingDay - Target sailing day
 * @param vesselAbbrev - Vessel abbreviation
 * @returns Scoped scheduled rows
 */
const scheduledForVesselDay = (
  events: ConvexScheduledDockEvent[],
  sailingDay: string,
  vesselAbbrev: string
) =>
  events.filter(
    (event) =>
      event.SailingDay === sailingDay && event.VesselAbbrev === vesselAbbrev
  );

/**
 * Filters actual events to sailing day and vessel.
 *
 * @param events - Actual dock events
 * @param sailingDay - Target sailing day
 * @param vesselAbbrev - Vessel abbreviation
 * @returns Filtered rows
 */
const actualForVesselDay = (
  events: ConvexActualDockEvent[],
  sailingDay: string,
  vesselAbbrev: string
) =>
  events.filter(
    (event) =>
      event.SailingDay === sailingDay && event.VesselAbbrev === vesselAbbrev
  );

/**
 * Filters predicted events to sailing day and vessel.
 *
 * @param events - Predicted dock events
 * @param sailingDay - Target sailing day
 * @param vesselAbbrev - Vessel abbreviation
 * @returns Filtered rows
 */
const predictedForVesselDay = (
  events: ConvexPredictedDockEvent[],
  sailingDay: string,
  vesselAbbrev: string
) =>
  events.filter(
    (event) =>
      event.SailingDay === sailingDay && event.VesselAbbrev === vesselAbbrev
  );

/**
 * Merges scoped event rows and returns ordered domain dock visits for one
 * vessel/day (Date boundaries), matching snapshot assembly semantics.
 *
 * Re-filters by vessel and day even when inputs are already list-query scoped,
 * so callers stay safe if arrays are ever widened.
 *
 * @param args - Event tables and vessel/day identity
 * @returns Ordered domain dock visits for span/axis pipelines
 */
const buildDomainDockVisitsForVesselDay = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
  vesselAbbrev,
  sailingDay,
}: BuildDomainDockVisitsForVesselDayArgs): Array<RouteTimelineDockVisit> => {
  const scheduled = scheduledForVesselDay(
    scheduledEvents,
    sailingDay,
    vesselAbbrev
  );
  const actual = actualForVesselDay(actualEvents, sailingDay, vesselAbbrev);
  const predicted = predictedForVesselDay(
    predictedEvents,
    sailingDay,
    vesselAbbrev
  );
  const merged = mergeTimelineRows({
    scheduledEvents: scheduled,
    actualEvents: actual,
    predictedEvents: predicted,
  });
  const wire = mergedEventsToWireDockVisits(merged, vesselAbbrev, sailingDay);
  return wire.map(wireRouteTimelineDockVisitToDomain);
};

export type { BuildDomainDockVisitsForVesselDayArgs };
export { buildDomainDockVisitsForVesselDay };
