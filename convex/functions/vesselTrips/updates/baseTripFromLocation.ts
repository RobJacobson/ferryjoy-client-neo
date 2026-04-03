/**
 * Base vessel trip from raw location data.
 *
 * Builds the location-derived base `ConvexVesselTrip` for a single vessel tick.
 * The builder uses an explicit mode and shared derived inputs so the same
 * carry-forward rules apply consistently across newly created and continuing
 * updates.
 */

import type { ResolvedVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
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
  currLocation: ResolvedVesselLocation,
  existingTrip?: ConvexVesselTrip,
  isTripStart = false
): ConvexVesselTrip => {
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
  currLocation: ResolvedVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripInputs: DerivedTripInputs
): ConvexVesselTrip => {
  // The next trip begins at the same observed boundary where the previous trip ended.
  const tripStartTime = existingTrip?.TripEnd;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: tripInputs.currentArrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    Key: tripInputs.startKey,
    SailingDay: tripInputs.startSailingDay,
    PrevTerminalAbbrev:
      tripInputs.previousCompletedTrip?.DepartingTerminalAbbrev,
    PrevScheduledDeparture:
      tripInputs.previousCompletedTrip?.ScheduledDeparture,
    PrevLeftDock: tripInputs.previousCompletedTrip?.LeftDock,
    ArriveDest: undefined,
    TripStart: tripStartTime,
    AtDock: currLocation.AtDock,
    AtDockDuration: undefined,
    ScheduledDeparture: tripInputs.currentScheduledDeparture,
    LeftDock: undefined,
    TripDelay: undefined,
    Eta: undefined,
    NextKey: undefined,
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
 * Build the base trip for a continuing or first-seen trip.
 *
 * @param currLocation - Latest vessel location from the live feed
 * @param existingTrip - Current ongoing trip, when one exists
 * @param tripInputs - Shared derived values for this tick
 * @returns Base trip for a continuing or first-seen trip
 */
const baseTripForContinuing = (
  currLocation: ResolvedVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripInputs: DerivedTripInputs
): ConvexVesselTrip => {
  // Preserve the first recorded arrival/start timestamps across later ticks.
  const arriveDestTime = existingTrip?.ArriveDest;
  const tripStartTime = existingTrip?.TripStart;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: tripInputs.continuingArrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    Key: tripInputs.continuingKey,
    SailingDay: tripInputs.continuingSailingDay,
    PrevTerminalAbbrev: existingTrip?.PrevTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: existingTrip?.PrevLeftDock,
    ArriveDest: arriveDestTime,
    TripStart: tripStartTime,
    AtDock: currLocation.AtDock,
    AtDockDuration: calculateTimeDelta(
      arriveDestTime ?? tripStartTime,
      tripInputs.leftDockTime
    ),
    ScheduledDeparture: tripInputs.continuingScheduledDeparture,
    LeftDock: tripInputs.leftDockTime,
    TripDelay: calculateTimeDelta(
      tripInputs.continuingScheduledDeparture,
      tripInputs.leftDockTime
    ),
    Eta: currLocation.Eta ?? existingTrip?.Eta,
    NextKey: existingTrip?.NextKey,
    NextScheduledDeparture: existingTrip?.NextScheduledDeparture,
    TripEnd: undefined,
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
