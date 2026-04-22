/**
 * Materializes stored trip rows for one vessel ping: completion close + optional
 * replacement active, or continuing active projection only.
 */

import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import { logTripPipelineFailure } from "domain/vesselOrchestration/updateVesselTrips/logTripPipelineFailure";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type {
  CalculatedTripUpdate,
  CompletedTripUpdate,
  VesselPingTripRows,
} from "domain/vesselOrchestration/updateVesselTrips/types";

/**
 * Builds completed and/or active `ConvexVesselTrip` rows for one calculated
 * update and schedule tables.
 *
 * Completion close runs only when `events.isCompletedTrip` and a prior active
 * exists; otherwise a completion flag without a prior yields no rows (cannot
 * close). Non-completing pings project through {@link buildTripCore} with
 * `tripStart: false`.
 *
 * @param update - Feed row, optional prior active, and detected trip events
 * @param scheduleTables - Prefetched schedule evidence tables for trip-field
 *   inference and next-leg enrichment
 * @returns Optional completed close and/or active row for this vessel
 */
export const tripRowsForVesselPing = (
  update: CalculatedTripUpdate,
  scheduleTables: ScheduledSegmentTables
): VesselPingTripRows => {
  const canCloseCompletion =
    update.events.isCompletedTrip && update.existingActiveTrip !== undefined;

  if (canCloseCompletion) {
    return tripRowsWhenCompleting(
      update as CompletedTripUpdate,
      scheduleTables
    );
  }

  if (update.events.isCompletedTrip) {
    return {};
  }

  return tripRowsWhenContinuing(update, scheduleTables);
};

/**
 * Closes the prior trip and builds the replacement active from the same ping.
 *
 * On failure, returns the prior active as `activeVesselTrip` so the vessel does
 * not disappear from the active set; `completedVesselTrip` may be omitted.
 */
const tripRowsWhenCompleting = (
  update: CompletedTripUpdate,
  scheduleTables: ScheduledSegmentTables
): VesselPingTripRows => {
  try {
    const completedVesselTrip = buildCompletedTrip(
      update.existingActiveTrip,
      update.vesselLocation,
      update.events.didJustArriveAtDock
    );
    const activeVesselTrip = buildTripCore(
      update.vesselLocation,
      completedVesselTrip,
      true,
      update.events,
      scheduleTables
    );

    return { completedVesselTrip, activeVesselTrip };
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      "finalizing completed trip",
      error
    );

    return { activeVesselTrip: update.existingActiveTrip };
  }
};

/**
 * Projects the next active row for pings that did not complete a trip this ping.
 *
 * On failure, returns the previous active when one exists so a bad ping does not
 * drop tracking; otherwise returns an empty outcome.
 */
const tripRowsWhenContinuing = (
  update: CalculatedTripUpdate,
  scheduleTables: ScheduledSegmentTables
): VesselPingTripRows => {
  try {
    const activeVesselTrip = buildTripCore(
      update.vesselLocation,
      update.existingActiveTrip,
      false,
      update.events,
      scheduleTables
    );

    return { activeVesselTrip };
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      "updating active trip",
      error
    );

    return update.existingActiveTrip !== undefined
      ? { activeVesselTrip: update.existingActiveTrip }
      : {};
  }
};
