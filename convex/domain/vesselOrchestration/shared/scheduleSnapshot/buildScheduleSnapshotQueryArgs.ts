import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getSailingDay } from "shared/time";

import type { ScheduleSnapshotQueryArgs } from "./scheduleSnapshotTypes";
/**
 * Hard caps for schedule snapshot bulk loads (orchestrator tick).
 * Keep aligned with {@link getScheduleSnapshotForTick} validators and handler checks.
 */
export const MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS = 2;

/**
 * Builds bounded args for {@link getScheduleSnapshotForTick} from orchestrator tick context.
 *
 * @throws When deduped inputs exceed documented caps (fail fast for tuning)
 */
export const buildScheduleSnapshotQueryArgs = (
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  tickStartedAt: number
): ScheduleSnapshotQueryArgs => {
  const tickDay = getSailingDay(new Date(tickStartedAt));
  const tripSailingDays = activeTrips.flatMap((trip) => {
    if (trip.SailingDay !== undefined) {
      return [trip.SailingDay];
    }
    if (trip.ScheduledDeparture !== undefined) {
      return [getSailingDay(new Date(trip.ScheduledDeparture))];
    }
    return [];
  });
  const sailingDaySet = new Set([tickDay, ...tripSailingDays]);

  if (sailingDaySet.size > MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS) {
    throw new Error(
      `schedule snapshot: sailingDays ${sailingDaySet.size} exceeds max ${MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS}`
    );
  }

  const segmentKeysFromTrips = activeTrips.flatMap((trip) =>
    [trip.ScheduleKey, trip.NextScheduleKey].filter((key): key is string =>
      Boolean(key)
    )
  );
  const segmentKeysFromLocations = convexLocations
    .map((loc) => loc.ScheduleKey)
    .filter((key): key is string => Boolean(key));
  const segmentKeySet = new Set([
    ...segmentKeysFromTrips,
    ...segmentKeysFromLocations,
  ]);

  return {
    sailingDays: [...sailingDaySet].sort(),
    segmentKeys: [...segmentKeySet].sort(),
  };
};
