/**
 * Helpers for constructing sparse trip writes.
 */

import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import {
  areTripStorageRowsEqual,
  stripTripPredictionsForStorage,
} from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type UpdatedTrips = {
  completedVesselTrip?: {
    existingTrip: ConvexVesselTrip;
    tripToComplete: ConvexVesselTrip;
    events: TripLifecycleEventFlags;
    scheduleTrip: ConvexVesselTrip;
  };
  activeVesselTrip?: ConvexVesselTrip;
  actualDockWrite?: {
    events: TripLifecycleEventFlags;
    scheduleTrip: ConvexVesselTrip;
    vesselAbbrev: string;
  };
  predictedDockWrite?: {
    existingTrip?: ConvexVesselTrip;
    scheduleTrip: ConvexVesselTrip;
    vesselAbbrev: string;
  };
};

type PerVesselTripUpdateInput = {
  existingActiveTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
  completedVesselTrip?: ConvexVesselTrip;
};

/**
 * Builds sparse trip-write intents for one vessel branch update.
 *
 * @param tripUpdate - Existing trip plus active/completed update candidates
 * @returns Write-set payload consumed by orchestrator persistence
 */
export const buildUpdatedTripsForVessel = (
  tripUpdate: PerVesselTripUpdateInput
): UpdatedTrips => {
  const existing = tripUpdate.existingActiveTrip;
  const active = tripUpdate.activeVesselTrip;
  const completed = tripUpdate.completedVesselTrip;

  if (
    completed !== undefined &&
    existing !== undefined &&
    active !== undefined
  ) {
    return {
      completedVesselTrip: {
        existingTrip: existing,
        tripToComplete: completed,
        events: buildCompletionTripEvents(existing, completed),
        scheduleTrip: active,
      },
    };
  }

  if (active === undefined) {
    return {};
  }

  const activeUpsert = stripTripPredictionsForStorage(active);
  if (areTripStorageRowsEqual(existing, activeUpsert)) {
    return {};
  }

  const events = currentTripEvents(existing, activeUpsert);
  return {
    activeVesselTrip: activeUpsert,
    actualDockWrite:
      events.didJustLeaveDock || events.didJustArriveAtDock
        ? {
            events,
            scheduleTrip: activeUpsert,
            vesselAbbrev: activeUpsert.VesselAbbrev,
          }
        : undefined,
    predictedDockWrite: {
      existingTrip: existing,
      scheduleTrip: activeUpsert,
      vesselAbbrev: activeUpsert.VesselAbbrev,
    },
  };
};

/**
 * Builds lifecycle flags for completed-trip rollover writes.
 *
 * @param existingTrip - Existing active trip before rollover
 * @param completedTrip - Completed trip row produced this ping
 * @returns Completion event flags for downstream persistence
 */
export const buildCompletionTripEvents = (
  existingTrip: ConvexVesselTrip,
  completedTrip: ConvexVesselTrip
): TripLifecycleEventFlags => ({
  isFirstTrip: false,
  isTripStartReady: true,
  isCompletedTrip: true,
  didJustArriveAtDock:
    completedTrip.ArrivedNextActual !== undefined &&
    existingTrip.ArrivedNextActual !== completedTrip.ArrivedNextActual,
  didJustLeaveDock: false,
  scheduleKeyChanged: existingTrip.ScheduleKey !== completedTrip.ScheduleKey,
});

/**
 * Builds lifecycle flags for active-trip upsert writes.
 *
 * @param existingTrip - Existing active trip before update, if any
 * @param nextTrip - Candidate active trip row for persistence
 * @returns Current-branch event flags for dock write intents
 */
const currentTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): TripLifecycleEventFlags => ({
  isFirstTrip: existingTrip === undefined,
  isTripStartReady:
    nextTrip.DepartingTerminalAbbrev !== undefined &&
    nextTrip.ArrivingTerminalAbbrev !== undefined &&
    nextTrip.ScheduledDeparture !== undefined,
  isCompletedTrip: false,
  didJustArriveAtDock:
    existingTrip?.AtDock !== true &&
    nextTrip.AtDock === true &&
    nextTrip.ArrivedNextActual !== undefined,
  didJustLeaveDock:
    existingTrip?.AtDock === true &&
    nextTrip.AtDock !== true &&
    nextTrip.LeftDockActual !== undefined,
  scheduleKeyChanged: existingTrip?.ScheduleKey !== nextTrip.ScheduleKey,
});
