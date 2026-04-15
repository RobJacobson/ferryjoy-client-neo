/**
 * Base vessel trip from raw location data.
 *
 * Builds the location-derived base `ConvexVesselTrip` for a single vessel tick.
 * The builder uses an explicit mode and shared derived inputs so the same
 * carry-forward rules apply consistently across newly created and continuing
 * updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import {
  type DerivedTripInputs,
  deriveTripInputs,
  determineBaseTripMode,
} from "./tripDerivation";

/**
 * Build the base trip from the current location and previous trip state.
 *
 * @param currLocation - Latest vessel location from the live feed
 * @param existingTrip - Current trip, when one already exists for the vessel
 * @param isTripStart - True when the caller is explicitly starting a new trip
 * @returns Location-derived trip state before schedule and prediction enrichments
 */
export const baseTripFromLocation = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip,
  isTripStart = false
): ConvexVesselTripWithML => {
  const tripInputs = deriveTripInputs(existingTrip, currLocation);
  const tripMode = determineBaseTripMode(
    existingTrip,
    currLocation,
    isTripStart
  );

  switch (tripMode) {
    case "start":
      return baseTripForStart(currLocation, existingTrip, tripInputs);
    case "continue":
      return baseTripForContinuing(currLocation, existingTrip, tripInputs);
  }
};

/**
 * Build the base trip for a new trip start.
 *
 * @param currLocation - Latest vessel location from the live feed
 * @param existingTrip - Previous trip state, when present
 * @param tripInputs - Shared derived values for this tick
 * @returns Base trip for a newly started trip
 */
const baseTripForStart = (
  currLocation: ConvexVesselLocation,
  _existingTrip: ConvexVesselTrip | undefined,
  tripInputs: DerivedTripInputs
): ConvexVesselTripWithML => {
  const startTime = currLocation.TimeStamp;
  const tripKey = generateTripKey(
    currLocation.VesselAbbrev,
    currLocation.TimeStamp
  );
  const prevCompleted = tripInputs.previousCompletedTrip;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: tripInputs.currentArrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    TripKey: tripKey,
    ScheduleKey: tripInputs.startScheduleKey,
    SailingDay: tripInputs.startSailingDay,
    PrevTerminalAbbrev: prevCompleted?.DepartingTerminalAbbrev,
    PrevScheduledDeparture: prevCompleted?.ScheduledDeparture,
    PrevLeftDock:
      prevCompleted?.DepartOriginActual ??
      prevCompleted?.LeftDockActual ??
      prevCompleted?.LeftDock,
    ArriveOriginDockActual: startTime,
    ArriveDestDockActual: undefined,
    DepartOriginActual: undefined,
    StartTime: startTime,
    EndTime: undefined,
    ArriveDest: undefined,
    AtDockActual: startTime,
    TripStart: startTime,
    AtDock: currLocation.AtDock,
    AtDockDuration: undefined,
    ScheduledDeparture: tripInputs.currentScheduledDeparture,
    LeftDock: undefined,
    LeftDockActual: undefined,
    TripDelay: undefined,
    Eta: undefined,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
    TripEnd: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    AtDockDepartCurr: undefined,
    AtDockArriveNext: undefined,
    AtDockDepartNext: undefined,
    AtSeaArriveNext: undefined,
    AtSeaDepartNext: undefined,
  };
};

/**
 * Resolves the immutable physical trip key for a continuing tick.
 *
 * First-seen trips (no prior row) get a new key from the current tick even if
 * the vessel is already mid-voyage. That synthetic anchor is only for physical
 * identity; it must not be interpreted as an observed departure boundary.
 *
 * Rows left over from before the clean-slate cutover without `TripKey` are
 * invalid and must not be silently repaired.
 *
 * @param existingTrip - Prior active trip row, if any
 * @param currLocation - Latest vessel location for this tick
 * @returns Physical trip key for this instance
 */
const tripKeyForContinuing = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): string => {
  if (existingTrip === undefined) {
    return generateTripKey(currLocation.VesselAbbrev, currLocation.TimeStamp);
  }
  if (existingTrip.TripKey === undefined) {
    throw new Error(
      "Continuing vessel trip is missing TripKey. Post-cutover data must " +
        "include TripKey on every active trip row."
    );
  }
  return existingTrip.TripKey;
};

/**
 * Build the base trip for a continuing or first-seen trip.
 *
 * @param currLocation - Latest vessel location from the live feed
 * @param existingTrip - Current ongoing trip, when one exists
 * @param tripInputs - Shared derived values for this tick
 * @returns Base trip for a continuing or first-seen trip
 */
const baseTripForContinuing = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripInputs: DerivedTripInputs
): ConvexVesselTripWithML => {
  const isBootstrapTrip = existingTrip === undefined;
  const startTime = isBootstrapTrip
    ? currLocation.TimeStamp
    : existingTrip?.StartTime;
  const arriveOriginTime = existingTrip?.ArriveOriginDockActual;
  const arriveDestTime = existingTrip?.ArriveDestDockActual;
  const departOriginTime =
    existingTrip?.DepartOriginActual ??
    (tripInputs.didJustLeaveDock ? currLocation.TimeStamp : undefined);
  const endTime = existingTrip?.EndTime;
  const tripKey = tripKeyForContinuing(existingTrip, currLocation);

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: tripInputs.continuingArrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    TripKey: tripKey,
    ScheduleKey: tripInputs.continuingScheduleKey,
    SailingDay: tripInputs.continuingSailingDay,
    PrevTerminalAbbrev: existingTrip?.PrevTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: existingTrip?.PrevLeftDock,
    ArriveOriginDockActual: arriveOriginTime,
    ArriveDestDockActual: arriveDestTime,
    DepartOriginActual: departOriginTime,
    StartTime: startTime,
    EndTime: endTime,
    ArriveDest: arriveDestTime,
    AtDockActual: arriveOriginTime,
    TripStart: startTime,
    AtDock: currLocation.AtDock,
    AtDockDuration: calculateTimeDelta(
      arriveDestTime ?? endTime ?? startTime,
      tripInputs.leftDockTime
    ),
    ScheduledDeparture: tripInputs.continuingScheduledDeparture,
    LeftDock: tripInputs.leftDockTime,
    LeftDockActual: departOriginTime,
    TripDelay: calculateTimeDelta(
      tripInputs.continuingScheduledDeparture,
      tripInputs.leftDockTime
    ),
    Eta: currLocation.Eta ?? existingTrip?.Eta,
    NextScheduleKey: existingTrip?.NextScheduleKey,
    NextScheduledDeparture: existingTrip?.NextScheduledDeparture,
    TripEnd: endTime,
    AtSeaDuration: existingTrip?.AtSeaDuration,
    TotalDuration: existingTrip?.TotalDuration,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    AtDockDepartCurr: existingTrip?.AtDockDepartCurr,
    AtDockArriveNext: existingTrip?.AtDockArriveNext,
    AtDockDepartNext: existingTrip?.AtDockDepartNext,
    AtSeaArriveNext: existingTrip?.AtSeaArriveNext,
    AtSeaDepartNext: existingTrip?.AtSeaDepartNext,
  };
};
