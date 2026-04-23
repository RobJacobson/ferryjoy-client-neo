/**
 * Base vessel trip from raw location plus resolved current-trip fields.
 *
 * Builds the base {@link ConvexVesselTrip} for a single ping. Callers pass
 * {@link ResolvedCurrentTripFields} from `resolveCurrentTripFields` in
 * `buildTripCore`; raw-feed lifecycle detection remains in
 * `detectTripEvents.ts`.
 */

import type { ResolvedCurrentTripFields } from "domain/vesselOrchestration/updateVesselTrips/tripFields/types";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { type DerivedTripInputs, deriveTripInputs } from "./tripDerivation";

/**
 * Builds the base trip from the current location, resolved trip fields, and
 * previous trip state.
 *
 * @param currLocation - Raw vessel location for this ping
 * @param existingTrip - Current trip when one exists for the vessel
 * @param isTripStart - True when starting a new trip row (replacement active or boundary)
 * @param resolvedCurrentTripFields - Resolved schedule-facing fields for this row
 * @returns Location-derived trip before next-leg schedule merge in `buildTripCore`
 */
export const baseTripFromLocation = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  isTripStart: boolean,
  resolvedCurrentTripFields: ResolvedCurrentTripFields
): ConvexVesselTrip => {
  const tripInputs = deriveTripInputs(
    existingTrip,
    currLocation,
    resolvedCurrentTripFields
  );
  if (isTripStart) {
    return baseTripForStart(currLocation, existingTrip, tripInputs);
  }

  return baseTripForContinuing(currLocation, existingTrip, tripInputs);
};

/**
 * Build the base trip for a new trip start.
 *
 * @param currLocation - Raw location for this ping
 * @param existingTrip - Previous trip state, when present
 * @param tripInputs - Shared derived values for this ping
 * @returns Base trip for a newly started trip
 */
const baseTripForStart = (
  currLocation: ConvexVesselLocation,
  _existingTrip: ConvexVesselTrip | undefined,
  tripInputs: DerivedTripInputs
): ConvexVesselTrip => {
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
    PrevLeftDock: prevCompleted?.LeftDockActual ?? prevCompleted?.LeftDock,
    ArrivedCurrActual: startTime,
    ArrivedNextActual: undefined,
    StartTime: startTime,
    EndTime: undefined,
    ArriveDest: undefined,
    AtDockActual: startTime,
    TripStart: startTime,
    AtDock: currLocation.AtDock,
    AtDockDuration: undefined,
    ScheduledDeparture: tripInputs.currentScheduledDeparture,
    LeftDock: undefined,
    TripDelay: undefined,
    Eta: undefined,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
    TripEnd: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
  };
};

/**
 * Resolves the immutable physical trip key for a continuing ping.
 *
 * First-seen trips (no prior row) get a new key from the current ping even if
 * the vessel is already mid-voyage. That synthetic anchor is only for physical
 * identity; it must not be interpreted as an observed departure boundary.
 *
 * Rows left over from before the clean-slate cutover without `TripKey` are
 * invalid and must not be silently repaired.
 *
 * @param existingTrip - Prior active trip row, if any
 * @param currLocation - Latest vessel location for this ping
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
 * @param currLocation - Raw location for this ping
 * @param existingTrip - Current ongoing trip, when one exists
 * @param tripInputs - Shared derived values for this ping
 * @returns Base trip for a continuing or first-seen trip
 */
const baseTripForContinuing = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripInputs: DerivedTripInputs
): ConvexVesselTrip => {
  const isBootstrapTrip = existingTrip === undefined;
  const startTime = isBootstrapTrip
    ? currLocation.TimeStamp
    : existingTrip?.StartTime;
  const arriveOriginTime = existingTrip?.ArrivedCurrActual;
  const arriveDestTime = existingTrip?.ArrivedNextActual;
  const departOriginTime =
    existingTrip?.LeftDockActual ??
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
    ArrivedCurrActual: arriveOriginTime,
    ArrivedNextActual: arriveDestTime,
    LeftDockActual: departOriginTime,
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
  };
};
