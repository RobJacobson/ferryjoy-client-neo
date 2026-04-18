/**
 * Shared helpers that bind actual dock rows and writes to physical trip
 * context.
 */

import type {
  ConvexActualDockWrite,
  ConvexActualDockWritePersistable,
  ConvexActualDockWriteWithTripKey,
} from "../../domain/events/actual/schemas";
import {
  hasTripKeyOnActualDockWrite,
  isPersistableActualDockWrite,
} from "./actualDockWriteHelpers";

/**
 * Resolved physical context stored on each `eventsActual` row.
 */
export type TripContextForActualRow = {
  TripKey: string;
  ScheduleKey?: string;
};

/**
 * Minimal trip fields used to attach physical identity to actual dock rows.
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
  LeftDockActual?: number;
  ArrivedNextActual?: number;
  LeftDock?: number;
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
 *
 * @param trips - Active trips keyed by vessel for the current reconciliation scope
 * @returns Map from vessel abbreviation to active trip rows that have `TripKey`
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
 * Fills `TripKey` (and optional `ScheduleKey`) on sparse writes using the
 * segment-key index. Drops writes that still lack `TripKey` after enrichment.
 *
 * @param writes - Writes from live-location reconciliation
 * @param tripBySegmentKey - Segment key to trip context
 * @returns Writes with `TripKey` and at least one anchor timestamp
 */
export const enrichActualDockWritesWithTripContext = (
  writes: ConvexActualDockWrite[],
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualDockWritePersistable[] =>
  writes
    .flatMap((write): ConvexActualDockWriteWithTripKey[] => {
      if (hasTripKeyOnActualDockWrite(write)) {
        return [write];
      }

      const segmentKey = write.SegmentKey;
      if (!segmentKey) {
        return [];
      }

      const trip = tripBySegmentKey.get(segmentKey);
      if (!trip?.TripKey) {
        return [];
      }

      return [
        {
          ...write,
          TripKey: trip.TripKey,
          ScheduleKey: write.ScheduleKey ?? trip.ScheduleKey,
        },
      ];
    })
    .filter(isPersistableActualDockWrite);
