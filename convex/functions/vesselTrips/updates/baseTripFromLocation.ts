/**
 * Base vessel trip from raw location data.
 *
 * Single function that constructs the full ConvexVesselTrip using simple
 * assignment statements per Field Reference 2.6. SailingDay comes from raw
 * data via getSailingDay (prefer ScheduledDeparture). Schedule-derived:
 * Key from raw data; schedule joins happen later by Key.
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { getSailingDay } from "shared/time";
import { getDockDepartureState } from "./eventDetection";
import { computeTripKey } from "./utils";

/**
 * Base complete VesselTrip from raw location data using simple assignments.
 *
 * Handles first trip, trip boundary (new trip), and regular update. Per Field
 * Reference 2.6. SailingDay from getSailingDay (prefer ScheduledDeparture).
 * Key derived from raw data, used for schedule lookup and joins.
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Current trip (regular update only; undefined for first/boundary)
 * @param isTripStart - True for new trip (boundary or first appearance), false for continuing
 * @returns Complete ConvexVesselTrip with location-derived fields
 */
export const baseTripFromLocation = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip,
  isTripStart?: boolean
): ConvexVesselTrip =>
  isTripStart
    ? baseTripForStart(currLocation, existingTrip)
    : baseTripForContinuing(currLocation, existingTrip);

// ============================================================================
// baseTripFromLocation
// ============================================================================

/**
 * Base trip for trip start scenario (vessel just arrived at dock after completing
 * previous trip). At this point, `existingTrip` is the trip being completed.
 *
 * Key characteristics:
 * - TripStart is set to current timestamp
 * - Prev* fields are carried from the completing trip
 * - Predictions are cleared (undefined)
 * - ArrivingTerminalAbbrev comes only from currLocation (not existingTrip)
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - The trip being completed (provides Prev* fields)
 * @returns Complete ConvexVesselTrip for new trip start
 */
const baseTripForStart = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip
): ConvexVesselTrip => {
  const arrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    // Key for schedule lookup - derived from vessel, terminals, and departure time
    Key: computeTripKey(
      currLocation.VesselAbbrev,
      currLocation.DepartingTerminalAbbrev,
      arrivingTerminalAbbrev,
      currLocation.ScheduledDeparture
    ),
    // WSF sailing day (3 AM Pacific cutoff)
    SailingDay: currLocation.ScheduledDeparture
      ? getSailingDay(new Date(currLocation.ScheduledDeparture))
      : "",
    // Carry forward context from the trip being completed
    PrevTerminalAbbrev: existingTrip?.DepartingTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.ScheduledDeparture,
    PrevLeftDock: existingTrip?.LeftDock,
    // Vessel just arrived at dock - start timing the new trip
    TripStart: currLocation.TimeStamp,
    AtDock: currLocation.AtDock,
    AtDockDuration: undefined, // Will be computed when vessel leaves dock
    ScheduledDeparture: currLocation.ScheduledDeparture,
    LeftDock: undefined, // Not departed yet
    TripDelay: undefined, // Will be computed when vessel leaves dock
    Eta: undefined,
    TripEnd: undefined, // Only set on completed trips
    AtSeaDuration: undefined, // Only set on completed trips
    TotalDuration: undefined, // Only set on completed trips
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    // Predictions reset for new trip (will be regenerated)
    AtDockDepartCurr: undefined,
    AtDockArriveNext: undefined,
    AtDockDepartNext: undefined,
    AtSeaArriveNext: undefined,
    AtSeaDepartNext: undefined,
  };
};

/**
 * Base trip for continuing scenario (vessel is on the same trip as existingTrip,
 * or this is the first trip with no existingTrip).
 *
 * Key characteristics:
 * - TripStart is carried from existingTrip
 * - Prev* fields are carried from existingTrip
 * - Predictions are carried from existingTrip
 * - ArrivingTerminalAbbrev: currLocation or fallback to existingTrip
 * - LeftDock: currLocation or inferred when AtDock flips false
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Current ongoing trip (undefined for first appearance)
 * @returns Complete ConvexVesselTrip for continuing trip
 */
const baseTripForContinuing = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip
): ConvexVesselTrip => {
  // Carry forward ScheduledDeparture when curr omits it (feed glitch protection)
  const scheduledDeparture =
    currLocation.ScheduledDeparture ?? existingTrip?.ScheduledDeparture;
  // Shared dock-departure inference (same logic as event detection)
  const { leftDockTime } = getDockDepartureState(existingTrip, currLocation);

  // Carry forward ArrivingTerminal when curr omits it (feed glitch protection)
  const arrivingTerminalAbbrev =
    currLocation.ArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;

  // TripStart is carried from existing trip
  const tripStartTime = existingTrip?.TripStart;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    // Key for schedule lookup
    Key: computeTripKey(
      currLocation.VesselAbbrev,
      currLocation.DepartingTerminalAbbrev,
      arrivingTerminalAbbrev,
      scheduledDeparture
    ),
    // WSF sailing day (3 AM Pacific cutoff)
    SailingDay: scheduledDeparture
      ? getSailingDay(new Date(scheduledDeparture))
      : "",
    // Prev* fields carried from existing trip (unchanged mid-trip)
    PrevTerminalAbbrev: existingTrip?.PrevTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: existingTrip?.PrevLeftDock,
    // TripStart carried from existing trip (unchanged)
    TripStart: tripStartTime,
    AtDock: currLocation.AtDock,
    // Time from arrival to departure (only when vessel has left dock)
    AtDockDuration: calculateTimeDelta(tripStartTime, leftDockTime),
    ScheduledDeparture: scheduledDeparture,
    LeftDock: leftDockTime,
    // Delay from scheduled departure to actual departure
    TripDelay: calculateTimeDelta(scheduledDeparture, leftDockTime),
    // Eta: null-overwrite protection (preserve existing when curr omits it)
    Eta: currLocation.Eta ?? existingTrip?.Eta,
    // NextScheduledDeparture: from schedule lookups; carry forward when appends don't run
    NextScheduledDeparture: existingTrip?.NextScheduledDeparture,
    TripEnd: undefined, // Only set on completed trips
    AtSeaDuration: existingTrip?.AtSeaDuration, // Carried from existing
    TotalDuration: existingTrip?.TotalDuration, // Carried from existing
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    // Predictions carried from existing trip (preserved mid-trip)
    AtDockDepartCurr: existingTrip?.AtDockDepartCurr,
    AtDockArriveNext: existingTrip?.AtDockArriveNext,
    AtDockDepartNext: existingTrip?.AtDockDepartNext,
    AtSeaArriveNext: existingTrip?.AtSeaArriveNext,
    AtSeaDepartNext: existingTrip?.AtSeaDepartNext,
  };
};
