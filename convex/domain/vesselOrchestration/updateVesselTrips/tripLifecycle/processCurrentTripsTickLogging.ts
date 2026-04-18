/**
 * Schedule-key and boundary diagnostic logging for `processCurrentTrips`.
 * Keeps the lifecycle file focused on control flow.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import type { BuildTripCoreResult } from "./buildTrip";
import type { TripEvents } from "./tripEventTypes";

type CurrentTripBuildResult = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTripWithPredictions;
  events: TripEvents;
  tripCore: BuildTripCoreResult;
};

/**
 * Logs schedule-key transitions that may indicate a trip handoff or schedule
 * re-anchoring within the active-trip path.
 *
 * @param buildResult - Fulfilled current-trip build result for one vessel
 * @returns Nothing; emits a warning only when key timing changed
 */
export const logTripTickDiagnostics = ({
  existingTrip,
  currLocation,
  events,
  tripCore,
}: CurrentTripBuildResult) => {
  const proposed = tripCore.withFinalSchedule;
  const scheduleKeyChanged = existingTrip?.ScheduleKey !== proposed.ScheduleKey;
  const scheduledDepartureChanged =
    existingTrip?.ScheduledDeparture !== proposed.ScheduledDeparture;

  if (!scheduleKeyChanged && !scheduledDepartureChanged) {
    return;
  }

  console.warn(
    `[VesselTrips][ScheduleKeyTransition] ${JSON.stringify({
      vesselAbbrev: currLocation.VesselAbbrev,
      timestamp: new Date(currLocation.TimeStamp).toISOString(),
      events,
      liveTick: summarizeLocationTick(currLocation),
      existingTrip: summarizeTripTick(existingTrip),
      finalProposed: summarizeTripTick(proposed),
    })}`
  );
};

/**
 * Logs actual-boundary projection decisions for ticks that crossed a dock
 * boundary.
 *
 * @param buildResult - Fulfilled current-trip build result for one vessel
 * @param persist - Whether the trip row will be upserted
 * @param refresh - Whether overlay rows will be refreshed
 * @returns Nothing; emits a warning only for boundary-crossing ticks
 */
export const logActualProjectionTick = (
  { existingTrip, currLocation, events, tripCore }: CurrentTripBuildResult,
  persist: boolean,
  refresh: boolean
) => {
  const finalProposed = tripCore.withFinalSchedule;
  if (!events.didJustLeaveDock && !events.didJustArriveAtDock) {
    return;
  }

  console.warn(
    `[VesselTrips][BoundaryProjection] ${JSON.stringify({
      vesselAbbrev: currLocation.VesselAbbrev,
      timestamp: new Date(currLocation.TimeStamp).toISOString(),
      persist,
      refresh,
      events,
      liveTick: summarizeLocationTick(currLocation),
      existingTrip: summarizeTripTick(existingTrip),
      finalProposed: summarizeTripTick(finalProposed),
      projectedDeparture:
        events.didJustLeaveDock && finalProposed.LeftDockActual !== undefined
          ? {
              segmentKey: finalProposed.ScheduleKey,
              actualTime: finalProposed.LeftDockActual,
            }
          : null,
      projectedArrival:
        events.didJustArriveAtDock &&
        finalProposed.ArrivedNextActual !== undefined
          ? {
              segmentKey: finalProposed.ScheduleKey,
              actualTime: finalProposed.ArrivedNextActual,
            }
          : null,
    })}`
  );
};

/**
 * Reduces a live location row to the fields used in diagnostic logging.
 *
 * @param location - Live vessel-location subset relevant to trip debugging
 * @returns Compact log-friendly snapshot of the current live tick
 */
const summarizeLocationTick = (
  location: Pick<
    ConvexVesselLocation,
    | "AtDock"
    | "LeftDock"
    | "DepartingTerminalAbbrev"
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
    | "TimeStamp"
    | "Speed"
    | "DepartingDistance"
    | "ArrivingDistance"
  >
) => ({
  atDock: location.AtDock,
  leftDock: location.LeftDock,
  departingTerminalAbbrev: location.DepartingTerminalAbbrev,
  arrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  scheduledDeparture: location.ScheduledDeparture,
  scheduleKey: location.ScheduleKey,
  timeStamp: location.TimeStamp,
  speed: location.Speed,
  departingDistance: location.DepartingDistance,
  arrivingDistance: location.ArrivingDistance,
});

/**
 * Reduces a trip row to the fields used in diagnostic logging.
 *
 * @param trip - Existing or proposed trip subset relevant to trip debugging
 * @returns Compact log-friendly trip snapshot, or `null` when absent
 */
const summarizeTripTick = (
  trip:
    | Pick<
        ConvexVesselTripWithPredictions,
        | "AtDock"
        | "LeftDock"
        | "ArriveDest"
        | "LeftDockActual"
        | "ArrivedNextActual"
        | "DepartingTerminalAbbrev"
        | "ArrivingTerminalAbbrev"
        | "ScheduledDeparture"
        | "ScheduleKey"
        | "NextScheduleKey"
        | "NextScheduledDeparture"
        | "TimeStamp"
      >
    | undefined
) =>
  trip
    ? {
        atDock: trip.AtDock,
        leftDock: trip.LeftDock,
        arriveDest: trip.ArrivedNextActual ?? trip.ArriveDest,
        departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
        arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
        scheduledDeparture: trip.ScheduledDeparture,
        scheduleKey: trip.ScheduleKey,
        nextScheduleKey: trip.NextScheduleKey,
        nextScheduledDeparture: trip.NextScheduledDeparture,
        timeStamp: trip.TimeStamp,
      }
    : null;
