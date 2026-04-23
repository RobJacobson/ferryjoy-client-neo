/**
 * Focused vessel-orchestrator test helpers.
 *
 * This keeps snapshot-only compatibility helpers out of the production
 * orchestrator action so the hot-path file stays centered on real runtime
 * concerns.
 */

import { createScheduleContinuityAccessFromSnapshot } from "domain/vesselOrchestration/shared";
import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
import { computeVesselTripsBatch } from "domain/vesselOrchestration/updateVesselTrips";
import type {
  VesselLocationUpdates,
  VesselTripUpdate,
} from "functions/vesselOrchestrator/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Backward-compatible helper for focused tests that still provide a snapshot.
 *
 * @param locationUpdates - Location updates for the ping
 * @param existingActiveTrips - Active trips from storage
 * @param scheduleSnapshot - In-memory schedule snapshot for tests
 * @param sailingDay - Sailing day represented by the snapshot
 * @returns Trip updates and authoritative trip rows for the ping
 */
export const computeTripBatchForPing = async (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleSnapshot: ScheduleSnapshot,
  sailingDay: string
): Promise<{
  updates: ReadonlyArray<VesselTripUpdate>;
  rows: RunUpdateVesselTripsOutput;
}> =>
  computeVesselTripsBatch({
    vesselLocations: locationUpdates
      .filter((update) => update.locationChanged)
      .map((update) => update.vesselLocation),
    existingActiveTrips,
    scheduleAccess: createScheduleContinuityAccessFromSnapshot(
      scheduleSnapshot,
      sailingDay
    ),
  });
