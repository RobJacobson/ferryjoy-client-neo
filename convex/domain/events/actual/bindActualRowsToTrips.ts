/**
 * Shared helpers that bind actual dock rows and writes to physical trip
 * context.
 *
 * Segment indexing maps each schedule segment string to the physical TripKey.
 * Schedule-backed legs use the same segment id for lookup while physical-only
 * legs can still be indexed by TripKey.
 */

import {
  hasTripKeyOnActualDockWrite,
  isPersistableActualDockWrite,
} from "./actualDockWriteHelpers";
import type {
  ConvexActualDockWrite,
  ConvexActualDockWritePersistable,
  ConvexActualDockWriteWithTripKey,
} from "./schemas";

/**
 * Resolved physical context stored on each eventsActual row.
 */
export type TripContextForActualRow = {
  TripKey: string;
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
 * actual reconstruction during same-day event reloads.
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
  TripEnd?: number;
  LeftDock?: number;
  TripStart?: number;
};

/**
 * Indexes physical TripKey by canonical segment string.
 *
 * Uses ScheduleKey when present; otherwise TripKey so segment lookups resolve for
 * scheduleless trips that only carry physical TripKey.
 *
 * @param trips - Active and/or completed trips (caller filters by sailing day)
 * @returns Map from segment string to TripKey context for that leg
 */
const indexTripsBySegmentKey = (
  trips: TripRowForActualContext[]
): Map<string, TripContextForActualRow> => {
  const map = new Map<string, TripContextForActualRow>();

  for (const trip of trips) {
    if (!trip.TripKey) {
      continue;
    }

    const scheduleBackedSegment = trip.ScheduleKey ?? trip.TripKey;
    const row = { TripKey: trip.TripKey };

    map.set(scheduleBackedSegment, row);
  }

  return map;
};

/**
 * Indexes at most one active trip per vessel that already carries TripKey.
 *
 * Scheduleless reconciliation proposes physical-only departures and arrivals
 * when the vessel has no schedule row but activeTripsByVesselAbbrev still has
 * a TripKey-only trip (for example early-morning ops). This map answers which
 * trip row backs those patches for each vessel abbreviation.
 *
 * @param trips - Active trips for the reconciliation scope (typically one day)
 * @returns Map from vessel abbreviation to that vessels active trip with TripKey narrowed
 */
const indexActiveTripsByVesselAbbrev = (
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
 * Attaches TripKey to sparse writes using the segment index.
 *
 * Location reconciliation first emits SegmentKey on each patch. When TripKey is
 * missing, this helper copies TripKey from tripBySegmentKey. Writes without
 * SegmentKey or without a matching trip are dropped; the result is filtered to
 * persistable anchors only.
 *
 * @param writes - Sparse writes from reconcileActualDockWritesFromLocations
 * @param tripBySegmentKey - Output of indexTripsBySegmentKey for the same day
 * @returns Persistable writes ready for mergeActualDockWritesIntoRows
 */
const enrichActualDockWritesWithTripContext = (
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
        },
      ];
    })
    .filter(isPersistableActualDockWrite);

export {
  enrichActualDockWritesWithTripContext,
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
};
