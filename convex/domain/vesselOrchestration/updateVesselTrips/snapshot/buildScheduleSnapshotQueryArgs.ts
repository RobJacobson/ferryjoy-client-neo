import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { addDaysToYyyyMmDd, getSailingDay } from "shared/time";

import {
  MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS,
  MAX_SCHEDULE_SNAPSHOT_SEGMENT_KEYS,
  MAX_SCHEDULE_SNAPSHOT_VESSEL_ABBREVS,
  MAX_SCHEDULE_SNAPSHOT_VESSEL_SAILING_PAIRS,
} from "./scheduleSnapshotLimits";

export type ScheduleSnapshotQueryArgs = {
  vesselAbbrevs: string[];
  sailingDays: string[];
  segmentKeys: string[];
};

/**
 * Builds bounded args for {@link getScheduleSnapshotForTick} from orchestrator tick context.
 *
 * @throws When deduped inputs exceed documented caps (fail fast for tuning)
 */
export const buildScheduleSnapshotQueryArgs = (
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  tickStartedAt: number
): ScheduleSnapshotQueryArgs => {
  const vesselAbbrevs = uniqueSortedStrings(
    vesselsIdentity.map((v) => v.VesselAbbrev)
  );
  if (vesselAbbrevs.length > MAX_SCHEDULE_SNAPSHOT_VESSEL_ABBREVS) {
    throw new Error(
      `schedule snapshot: vesselAbbrevs ${vesselAbbrevs.length} exceeds max ${MAX_SCHEDULE_SNAPSHOT_VESSEL_ABBREVS}`
    );
  }

  const tickDay = getSailingDay(new Date(tickStartedAt));
  const paddedSailingDays = [
    tickDay,
    addDaysToYyyyMmDd(tickDay, -1),
    addDaysToYyyyMmDd(tickDay, 1),
  ];
  const tripSailingDays = activeTrips
    .map((trip) => trip.ScheduledDeparture)
    .filter((ms): ms is number => ms !== undefined)
    .map((ms) => getSailingDay(new Date(ms)));
  const sailingDaySet = new Set([...paddedSailingDays, ...tripSailingDays]);

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

  if (segmentKeySet.size > MAX_SCHEDULE_SNAPSHOT_SEGMENT_KEYS) {
    throw new Error(
      `schedule snapshot: segmentKeys ${segmentKeySet.size} exceeds max ${MAX_SCHEDULE_SNAPSHOT_SEGMENT_KEYS}`
    );
  }

  const pairCount = vesselAbbrevs.length * sailingDaySet.size;
  if (pairCount > MAX_SCHEDULE_SNAPSHOT_VESSEL_SAILING_PAIRS) {
    throw new Error(
      `schedule snapshot: vessel×sailingDay pairs ${pairCount} exceeds max ${MAX_SCHEDULE_SNAPSHOT_VESSEL_SAILING_PAIRS}`
    );
  }

  return {
    vesselAbbrevs,
    sailingDays: [...sailingDaySet].sort(),
    segmentKeys: [...segmentKeySet].sort(),
  };
};

const uniqueSortedStrings = (values: string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));
