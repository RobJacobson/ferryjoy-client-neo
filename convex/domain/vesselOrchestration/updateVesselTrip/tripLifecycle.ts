import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type TripLifecycleEventFlags = {
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  scheduleKeyChanged: boolean;
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
export const currentTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): TripLifecycleEventFlags => ({
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
