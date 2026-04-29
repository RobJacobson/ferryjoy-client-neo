/**
 * Shared contracts for the pure `updateVesselTrip` pipeline.
 */

import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Canonical Stage 2 per-vessel write intents for the orchestrator pipeline.
 *
 * `activeVesselTripUpdate` is always the next **active** row to persist. When a
 * leg completes, that value is the replacement trip; `completedVesselTripUpdate`
 * is set for the row being archived. When a field is undefined, no write of
 * that kind is emitted.
 */
export type VesselTripUpdate = {
  vesselAbbrev: ConvexVesselLocation["VesselAbbrev"];
  existingActiveTrip?: ConvexVesselTrip;
  activeVesselTripUpdate: ConvexVesselTrip;
  completedVesselTripUpdate?: ConvexVesselTrip;
};

/**
 * Minimal database access contract for update-vessel-trip enrichment reads.
 */
export type UpdateVesselTripDbAccess = {
  /**
   * Loads one terminal identity by abbreviation.
   *
   * @param terminalAbbrev - Terminal abbreviation from the live location row
   * @returns Matching terminal identity row, or `null`
   */
  getTerminalIdentity: (
    terminalAbbrev: string
  ) => Promise<TerminalIdentity | null>;
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
