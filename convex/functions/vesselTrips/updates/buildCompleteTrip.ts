/**
 * Build complete VesselTrip from existing trip and current location.
 *
 * Used by the build-then-compare refactor for the regular update path (same trip,
 * no boundary). Resolves all location-derived fields per Field Reference 2.6.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import type { ArrivalLookupResult } from "./arrivalTerminalLookup";

/**
 * Build a complete ConvexVesselTrip for the regular update path.
 *
 * Identity fields from currLocation; contextual fields (Prev*, TripStart) carried
 * from existingTrip. Null-overwrite protection for ScheduledDeparture, Eta, LeftDock.
 *
 * @param existingTrip - Current vessel trip state (same trip, prior tick)
 * @param currLocation - Latest vessel location from REST/API
 * @param arrivalLookup - Optional result from lookupArrivalTerminalFromSchedule
 * @returns Complete ConvexVesselTrip with all location-derived fields
 */
export const buildCompleteTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation,
  arrivalLookup?: ArrivalLookupResult
): ConvexVesselTrip => {
  const atDockFlippedToFalse =
    currLocation.AtDock !== existingTrip.AtDock &&
    !currLocation.AtDock &&
    existingTrip.AtDock;

  // LeftDock: special case when AtDock flips false and LeftDock missing
  const leftDock =
    atDockFlippedToFalse && !existingTrip.LeftDock
      ? (currLocation.LeftDock ?? currLocation.TimeStamp)
      : (currLocation.LeftDock ?? existingTrip.LeftDock);

  const scheduledDeparture =
    currLocation.ScheduledDeparture ?? existingTrip.ScheduledDeparture;
  const eta = currLocation.Eta ?? existingTrip.Eta;

  const tripDelay = calculateTimeDelta(scheduledDeparture, leftDock);
  const atDockDuration = calculateTimeDelta(existingTrip.TripStart, leftDock);

  return {
    ...existingTrip,
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev:
      currLocation.ArrivingTerminalAbbrev ??
      arrivalLookup?.arrivalTerminal ??
      existingTrip.ArrivingTerminalAbbrev,
    AtDock: currLocation.AtDock,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    ScheduledDeparture: scheduledDeparture,
    Eta: eta,
    LeftDock: leftDock,
    TripDelay: tripDelay ?? existingTrip.TripDelay,
    AtDockDuration: atDockDuration ?? existingTrip.AtDockDuration,
  };
};
