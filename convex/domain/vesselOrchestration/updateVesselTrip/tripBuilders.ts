/**
 * Trip row orchestration for one vessel ping.
 */

import {
  type BuiltTripRows,
  buildBasicUpdatedVesselRows,
  type TripRowBuildInput,
} from "./basicTripRows";
import { enrichActiveTripWithSchedule } from "./scheduleEnrichment";
import { logTripPipelineFailure } from "./storage";
import type { ScheduleDbAccess } from "./types";

/**
 * Builds completed/active trip rows for one vessel ping.
 *
 * @param update - Trip build input for the vessel ping
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Completed and/or active trip rows derived from lifecycle state
 */
export const buildUpdatedVesselRows = async (
  update: TripRowBuildInput,
  scheduleAccess: ScheduleDbAccess
): Promise<BuiltTripRows> => {
  const basicRows = buildBasicRowsOrEmpty(update);
  if (basicRows.activeVesselTrip === undefined) {
    return basicRows;
  }

  try {
    const scheduleContinuityTrip =
      basicRows.completedVesselTrip === undefined
        ? update.existingActiveTrip
        : tripScheduleContinuityAfterCompletion(basicRows.completedVesselTrip);

    return {
      ...basicRows,
      activeVesselTrip: await enrichActiveTripWithSchedule(
        basicRows.activeVesselTrip,
        scheduleContinuityTrip,
        update.vesselLocation,
        update.events,
        scheduleAccess
      ),
    };
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      basicRows.completedVesselTrip === undefined
        ? "updating active trip"
        : "finalizing completed trip",
      error
    );

    return basicRows.completedVesselTrip === undefined
      ? {}
      : { completedVesselTrip: basicRows.completedVesselTrip };
  }
};

export { buildBasicUpdatedVesselRows } from "./basicTripRows";

// Basic construction failures drop the whole row update; enrichment failures
// keep a completed row when one was already built so completion can persist.
const buildBasicRowsOrEmpty = (update: TripRowBuildInput): BuiltTripRows => {
  try {
    return buildBasicUpdatedVesselRows(update);
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      update.events.isCompletedTrip
        ? "finalizing completed trip"
        : "updating active trip",
      error
    );

    return {};
  }
};

const tripScheduleContinuityAfterCompletion = (
  completedTrip: NonNullable<BuiltTripRows["completedVesselTrip"]>
) => ({
  ...completedTrip,
  ArrivingTerminalAbbrev: undefined,
  ScheduledDeparture: undefined,
  ScheduleKey: undefined,
  SailingDay: undefined,
});
