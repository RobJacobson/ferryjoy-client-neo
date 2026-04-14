/**
 * Indexes vessel trip rows by schedule segment key so schedule-hydrated
 * boundary events can resolve `TripKey` / `ScheduleKey` for `eventsActual`
 * rows. PR3: rows are not persisted without a resolved `TripKey`.
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
