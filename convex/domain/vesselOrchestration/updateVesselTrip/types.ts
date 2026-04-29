/**
 * Shared contracts for the pure `updateVesselTrip` pipeline.
 */

import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled/schemas";
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

export type GetScheduleRolloverDockEventsArgs = {
  vesselAbbrev: string;
  timestamp: number;
};

export type ScheduleRolloverDockEvents = {
  currentSailingDay: string;
  currentDayEvents: ReadonlyArray<ConvexScheduledDockEvent>;
  nextSailingDay: string;
  nextDayEvents: ReadonlyArray<ConvexScheduledDockEvent>;
};

/**
 * Minimal database access contract for update-vessel-trip schedule enrichment.
 */
export type UpdateVesselTripDbAccess = {
  /**
   * Primary continuity lookup: load one inferred scheduled segment by stable
   * segment key, including the following same-day segment hint when available.
   */
  getScheduledSegmentByScheduleKey: (
    scheduleKey: string
  ) => Promise<ConvexInferredScheduledSegment | null>;
  /**
   * Fallback rollover lookup: load current and next sailing-day dock rows for
   * one vessel/timestamp scope.
   */
  getScheduleRolloverDockEvents: (
    args: GetScheduleRolloverDockEventsArgs
  ) => Promise<ScheduleRolloverDockEvents>;
};
