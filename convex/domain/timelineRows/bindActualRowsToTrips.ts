/**
 * Shared helpers that bind actual boundary rows and patches to physical trip
 * context.
 */

import {
  type ConvexActualBoundaryPatch,
  type ConvexActualBoundaryPatchPersistable,
  type ConvexActualBoundaryPatchWithTripKey,
  hasTripKey,
  isPersistableActualBoundaryPatch,
} from "../../functions/eventsActual/schemas";

/**
 * Resolved physical context stored on each `eventsActual` row.
 */
export type TripContextForActualRow = {
  TripKey: string;
  ScheduleKey?: string;
};

/**
 * Minimal trip fields used to attach physical identity to actual boundary rows.
 */
export type TripRowForActualContext = {
  TripKey?: string;
  ScheduleKey?: string;
  SailingDay?: string;
};

/**
 * Active-trip fields needed for scheduleless live reconciliation and physical
 * actual reconstruction during same-day reseed.
 */
export type ActiveTripForPhysicalActualReconcile = {
  TripKey?: string;
  ScheduleKey?: string;
  VesselAbbrev: string;
  SailingDay?: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  DepartOriginActual?: number;
  ArriveDestDockActual?: number;
  LeftDock?: number;
  LeftDockActual?: number;
  ArriveDest?: number;
  AtDockActual?: number;
};

/**
 * Builds a map from schedule segment key (`ScheduleKey`) to physical trip
 * context for one sailing day.
 *
 * @param trips - Active and/or completed trips (caller filters by sailing day)
 * @returns Map keyed by segment strings present on trips
 */
export const indexTripsBySegmentKey = (
  trips: TripRowForActualContext[]
): Map<string, TripContextForActualRow> => {
  const map = new Map<string, TripContextForActualRow>();

  for (const trip of trips) {
    if (!trip.TripKey) {
      continue;
    }

    const row = { TripKey: trip.TripKey, ScheduleKey: trip.ScheduleKey };

    if (trip.ScheduleKey) {
      map.set(trip.ScheduleKey, row);
    }
  }

  return map;
};

/**
 * Builds a map from vessel abbreviation to the current active trip used for
 * scheduleless physical-only reconciliation.
 */
export const indexActiveTripsByVesselAbbrev = (
  trips: ActiveTripForPhysicalActualReconcile[]
): Map<string, ActiveTripForPhysicalActualReconcile & { TripKey: string }> => {
  const map = new Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >();

  for (const trip of trips) {
    if (!trip.TripKey) {
      continue;
    }

    map.set(trip.VesselAbbrev, {
      ...trip,
      TripKey: trip.TripKey,
    });
  }

  return map;
};

/**
 * Fills `TripKey` (and optional `ScheduleKey`) on sparse patches using the
 * segment-key index. Drops patches that still lack `TripKey` after enrichment.
 *
 * @param patches - Patches from live-location reconciliation
 * @param tripBySegmentKey - Segment key to trip context
 * @returns Patches with `TripKey` and at least one anchor timestamp
 */
export const enrichActualBoundaryPatchesWithTripContext = (
  patches: ConvexActualBoundaryPatch[],
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualBoundaryPatchPersistable[] =>
  patches
    .flatMap((patch): ConvexActualBoundaryPatchWithTripKey[] => {
      if (hasTripKey(patch)) {
        return [patch];
      }

      const segmentKey = patch.SegmentKey;
      if (!segmentKey) {
        return [];
      }

      const trip = tripBySegmentKey.get(segmentKey);
      if (!trip?.TripKey) {
        return [];
      }

      return [
        {
          ...patch,
          TripKey: trip.TripKey,
          ScheduleKey: patch.ScheduleKey ?? trip.ScheduleKey,
        },
      ];
    })
    .filter(isPersistableActualBoundaryPatch);
