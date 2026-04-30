/**
 * Schedule policy application for active-trip rows.
 *
 * This module owns schedule-field resolution for the already-built active trip
 * row during one orchestrator tick. It is used by `updateVesselTrip` to
 * stabilize `ScheduleKey`, `ScheduledDeparture`, and next-leg hints when WSF
 * realtime schedule fields are incomplete around dock arrivals and trip starts.
 * Resolution runs before `applyResolvedTripScheduleFields`, which performs the
 * canonical merge into the trip row.
 *
 * It selects one of three alternatives:
 * - Path A — apply authoritative WSF realtime destination/departure fields.
 * - Path B — on new in-service trips, infer from next-key continuity, then
 *   fall back to schedule-table lookup.
 * - Path C — if neither source resolves schedule evidence, emit a warning and
 *   return the built row unchanged (no-op schedule outcome).
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { applyResolvedTripScheduleFields } from "./scheduleEnrichment";
import {
  hasWsfScheduleFields,
  resolveScheduleFromWsfRealtime,
} from "./activeTripSchedule/resolveScheduleFromWsfRealtime";
import { tryResolveScheduledSegmentFromNextTripKey } from "./activeTripSchedule/resolveSegmentFromNextTripKey";
import { tryResolveScheduledSegmentFromScheduleTables } from "./activeTripSchedule/resolveSegmentFromScheduleLookup";
import type { ResolvedTripScheduleFields } from "./activeTripSchedule/types";
import type { UpdateVesselTripDbAccess } from "./types";

type ApplyScheduleForActiveTripInput = {
  /** Active trip row built for this ping (before schedule merge). */
  curr: ConvexVesselTrip;
  /** Prior stored active trip for this vessel, when any. */
  prev: ConvexVesselTrip | undefined;
  location: ConvexVesselLocation;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Applies schedule fields to an active trip.
 *
 * This function is the schedule-policy entry point for one active-trip update.
 * It chooses between authoritative realtime WSF fields and new-trip continuity
 * inference from schedule evidence, then forwards any resolved payload to the
 * centralized merge layer. When no evidence applies, it returns the built trip
 * unchanged so the pipeline can continue without forcing weak schedule values.
 *
 * @param args - Built active trip (`curr`), prior active row (`prev`), ping context
 * @returns Active trip row with schedule fields preserved or enriched; if
 *   unchanged, returns `curr`
 */
export const applyScheduleForActiveTrip = async (
  args: ApplyScheduleForActiveTripInput
): Promise<ConvexVesselTrip> => {
  const { curr, prev, location, isNewTrip, dbAccess } = args;

  // Select the highest-confidence schedule source first so downstream merge logic stays deterministic.
  const resolution = hasWsfScheduleFields(location)
    ? resolveScheduleFromWsfRealtime(location)
    : await resolveScheduleForNewTrip({
        location,
        existingTrip: prev,
        isNewTrip,
        dbAccess,
      });

  if (resolution === undefined) {
    return curr;
  }

  // Apply resolved schedule fields in one place to preserve continuity and keep write semantics centralized.
  return applyResolvedTripScheduleFields({
    activeTrip: curr,
    existingTrip: prev,
    scheduleKeyChanged: prev?.ScheduleKey !== curr.ScheduleKey,
    resolution,
  });
};

/**
 * Resolves schedule fields for a new in-service trip using continuity evidence.
 *
 * This helper implements the ordered fallback chain for arrival/start-of-trip
 * schedule recovery. It attempts prior-row `NextScheduleKey` continuity first,
 * then queries schedule tables for the next plausible departure segment from
 * the vessel's terminal context. If both strategies fail, it emits a warning
 * and returns undefined so callers can preserve a no-op schedule outcome.
 *
 * @param input - Ping context, prior trip context, and `UpdateVesselTripDbAccess`
 * @returns Resolved schedule fields when evidence exists, otherwise undefined
 */
const resolveScheduleForNewTrip = async ({
  location,
  existingTrip,
  isNewTrip,
  dbAccess,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
}): Promise<ResolvedTripScheduleFields | undefined> => {
  if (!isNewTrip || !location.InService) {
    return undefined;
  }

  // Prefer prior-row next-key continuity to avoid unnecessary schedule-table scans and keep trip identity stable.
  const segmentFromNextTripKey =
    await tryResolveScheduledSegmentFromNextTripKey({
      nextScheduleKey: existingTrip?.NextScheduleKey,
      departingTerminalAbbrev: location.DepartingTerminalAbbrev,
      dbAccess,
    });
  if (segmentFromNextTripKey) {
    return resolutionFromScheduledSegment(
      segmentFromNextTripKey,
      "nextTripKey"
    );
  }

  // Fall back to schedule tables only when key continuity fails so new-trip starts still recover useful schedule context.
  const segmentFromScheduleTables =
    await tryResolveScheduledSegmentFromScheduleTables({
      location,
      dbAccess,
    });
  if (segmentFromScheduleTables) {
    return resolutionFromScheduledSegment(
      segmentFromScheduleTables,
      "scheduleLookup"
    );
  }

  // Emit an explicit unresolved warning so no-op outcomes are observable during dock-arrival schedule gaps.
  console.warn(
    "[TripFields] unable to identify scheduled trip after new-trip start",
    {
      vesselAbbrev: location.VesselAbbrev,
      departingTerminalAbbrev: location.DepartingTerminalAbbrev,
      timeStamp: location.TimeStamp,
      existingScheduleKey: existingTrip?.ScheduleKey,
      existingNextScheduleKey: existingTrip?.NextScheduleKey,
    }
  );
  return undefined;
};

/**
 * Maps one scheduled segment into the schedule-field resolution payload.
 *
 * This adapter translates schedule-segment vocabulary into vessel-trip-facing
 * field names expected by schedule enrichment. It preserves both the current
 * leg identity (`ScheduleKey`, `ScheduledDeparture`) and next-leg hints used
 * by downstream continuity logic. The method tag records which resolution
 * channel produced the segment for diagnostics and traceability.
 *
 * @param segment - Scheduled segment selected for the new active trip
 * @param method - Resolution channel used for this segment
 * @returns Current and next schedule fields for merge
 */
const resolutionFromScheduledSegment = (
  segment: ConvexInferredScheduledSegment,
  method: "nextTripKey" | "scheduleLookup"
): ResolvedTripScheduleFields => ({
  current: {
    ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
    ScheduledDeparture: segment.DepartingTime,
    ScheduleKey: segment.Key,
    SailingDay: segment.SailingDay,
    tripFieldResolutionMethod: method,
  },
  next: {
    NextScheduleKey: segment.NextKey,
    NextScheduledDeparture: segment.NextDepartingTime,
  },
});
