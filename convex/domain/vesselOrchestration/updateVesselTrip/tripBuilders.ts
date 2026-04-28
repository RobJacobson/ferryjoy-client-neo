/**
 * Trip row orchestration for one vessel ping.
 */

import type { ScheduleDbAccess } from "domain/vesselOrchestration/shared";
import {
  buildBasicUpdatedVesselRows,
  type TripBuildInput,
  type TripRowOutcome,
} from "./basicTripRows";
import { enrichActiveTripWithSchedule } from "./scheduleEnrichment";
import { logTripPipelineFailure } from "./storage";

/**
 * Builds completed/active trip rows for one vessel ping.
 *
 * @param update - Trip build input for the vessel ping
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Completed and/or active trip rows derived from lifecycle state
 */
export const buildUpdatedVesselRows = async (
  update: TripBuildInput,
  scheduleAccess: ScheduleDbAccess
): Promise<TripRowOutcome> => {
  const basicRows = buildBasicRowsForUpdate(update);
  if (basicRows.activeVesselTrip === undefined) {
    return basicRows;
  }

  try {
    return {
      ...basicRows,
      activeVesselTrip: await enrichActiveTripWithSchedule(
        basicRows.activeVesselTrip,
        basicRows.completedVesselTrip ?? update.existingActiveTrip,
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

const buildBasicRowsForUpdate = (update: TripBuildInput): TripRowOutcome => {
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
