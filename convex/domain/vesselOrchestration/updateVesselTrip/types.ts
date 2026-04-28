/**
 * Shared contracts for the pure `updateVesselTrip` pipeline.
 */

import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Canonical Stage 2 per-vessel write intents for the orchestrator pipeline.
 *
 * Each field represents a concrete storage update to apply. When a field is
 * undefined, no write should be emitted for that table/branch.
 */
export type VesselTripUpdate = {
  vesselAbbrev: ConvexVesselLocation["VesselAbbrev"];
  existingActiveTrip?: ConvexVesselTrip;
  activeVesselTripUpdate?: ConvexVesselTrip;
  completedVesselTripUpdate?: ConvexVesselTrip;
};

/**
 * Minimal database access contract for scheduled dock events.
 */
export type ScheduleDbAccess = {
  /**
   * Loads scheduled dock rows for one vessel on one sailing day.
   *
   * @param vesselAbbrev - Vessel abbreviation
   * @param sailingDay - Sailing day string (`YYYY-MM-DD`)
   * @returns Scheduled dock event rows for that vessel/day scope
   */
  getScheduledDockEvents: (
    vesselAbbrev: string,
    sailingDay: string
  ) => Promise<ReadonlyArray<ConvexScheduledDockEvent>>;
  /**
   * Loads one scheduled departure dock row by composite segment key.
   *
   * @param scheduleKey - Canonical segment key
   * @returns Matching departure dock row, or `null`
   */
  getScheduledDepartureEvent: (
    scheduleKey: string
  ) => Promise<ConvexScheduledDockEvent | null>;
};
