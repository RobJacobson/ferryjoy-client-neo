/**
 * Pure selectors for route timeline domain snapshots.
 */

import type {
  RouteTimelineDockVisit,
  RouteTimelineSnapshot,
  RouteTimelineVessel,
} from "convex/functions/routeTimeline";

export type SelectTripDockVisitsArgs = {
  vesselAbbrev: string;
  fromDepartureBoundaryKey: string;
  toArrivalBoundaryKey: string;
};

export type SelectJourneyDockVisitsArgs = {
  vesselAbbrev: string;
  startVisitKey: string;
  endVisitKey: string;
};

/**
 * Return all vessels from a route timeline snapshot.
 *
 * @param snapshot - Optional cached route timeline snapshot
 * @returns Ordered vessel list from the snapshot, or an empty list
 */
export const selectRouteTimelineVessels = (
  snapshot: RouteTimelineSnapshot | null
): Array<RouteTimelineVessel> => snapshot?.Vessels ?? [];

/**
 * Return dock visits for one vessel from a route timeline snapshot.
 *
 * @param snapshot - Optional cached route timeline snapshot
 * @param vesselAbbrev - Vessel abbreviation to select
 * @returns Ordered dock visits for the vessel, or an empty list
 */
export const selectVesselDockVisits = (
  snapshot: RouteTimelineSnapshot | null,
  vesselAbbrev: string
): Array<RouteTimelineDockVisit> => {
  const vessel = selectRouteTimelineVessels(snapshot).find(
    (candidate) => candidate.VesselAbbrev === vesselAbbrev
  );

  return vessel?.DockVisits ?? [];
};

/**
 * Select one adjacent A-to-B trip slice using stable boundary identity keys.
 *
 * @param snapshot - Optional cached route timeline snapshot
 * @param args - Keyed trip selection arguments
 * @param args.vesselAbbrev - Vessel abbreviation that owns the trip
 * @param args.fromDepartureBoundaryKey - Departure boundary key for visit A
 * @param args.toArrivalBoundaryKey - Arrival boundary key for adjacent visit B
 * @returns Adjacent two-visit slice `[A, B]` or an empty list when unmatched
 */
export const selectTripDockVisits = (
  snapshot: RouteTimelineSnapshot | null,
  args: SelectTripDockVisitsArgs
): Array<RouteTimelineDockVisit> => {
  const visits = selectVesselDockVisits(snapshot, args.vesselAbbrev);
  const fromIndex = visits.findIndex(
    (visit) => visit.Departure?.Key === args.fromDepartureBoundaryKey
  );
  if (fromIndex < 0) {
    return [];
  }

  const fromVisit = visits[fromIndex];
  const toVisit = visits[fromIndex + 1];
  if (!fromVisit || !toVisit) {
    return [];
  }

  if (toVisit.Arrival?.Key !== args.toArrivalBoundaryKey) {
    return [];
  }

  return [fromVisit, toVisit];
};

/**
 * Select a contiguous inclusive journey slice by stable visit identity keys.
 *
 * @param snapshot - Optional cached route timeline snapshot
 * @param args - Keyed journey selection arguments
 * @param args.vesselAbbrev - Vessel abbreviation that owns the journey
 * @param args.startVisitKey - First visit key in the journey
 * @param args.endVisitKey - Last visit key in the journey
 * @returns Contiguous inclusive visit slice or an empty list when invalid
 */
export const selectJourneyDockVisits = (
  snapshot: RouteTimelineSnapshot | null,
  args: SelectJourneyDockVisitsArgs
): Array<RouteTimelineDockVisit> => {
  const visits = selectVesselDockVisits(snapshot, args.vesselAbbrev);
  const startIndex = visits.findIndex(
    (visit) => visit.Key === args.startVisitKey
  );
  const endIndex = visits.findIndex((visit) => visit.Key === args.endVisitKey);

  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
    return [];
  }

  return visits.slice(startIndex, endIndex + 1);
};
