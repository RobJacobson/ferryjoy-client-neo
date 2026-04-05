/**
 * Shared trip-derivation helpers for vessel trip updates.
 *
 * Centralizes the normalized per-tick values used by both event detection and
 * base trip construction so the two paths stay in sync.
 */

import type { ResolvedVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";

export type BaseTripMode = "start" | "continue";

export type DockDepartureState = {
  leftDockTime: number | undefined;
  didJustLeaveDock: boolean;
};

export type DerivedTripInputs = {
  currentArrivingTerminalAbbrev: string | undefined;
  continuingArrivingTerminalAbbrev: string | undefined;
  currentScheduledDeparture: number | undefined;
  continuingScheduledDeparture: number | undefined;
  startKey: string | undefined;
  continuingKey: string | undefined;
  startSailingDay: string | undefined;
  continuingSailingDay: string | undefined;
  currentIsTripStartReady: boolean;
  leftDockTime: number | undefined;
  didJustLeaveDock: boolean;
  previousCompletedTrip: ConvexVesselTrip | undefined;
};

/**
 * Determine whether a trip has enough evidence to be treated as a real sailing
 * leg instead of a pre-trip placeholder.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @returns True when the trip has departure or arrival evidence
 */
export const hasTripEvidence = (
  existingTrip: ConvexVesselTrip | undefined
): existingTrip is ConvexVesselTrip =>
  Boolean(
    existingTrip &&
      (existingTrip.LeftDock !== undefined ||
        existingTrip.ArriveDest !== undefined)
  );

/**
 * Derive dock-departure state from the previous trip and current location.
 *
 * Departure is recorded only when the feed exposes `LeftDock`. We preserve any
 * previously recorded departure and never infer one solely from `AtDock`.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Current vessel location from the live feed
 * @returns Normalized departure timestamp and whether this tick is the departure tick
 */
export const getDockDepartureState = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ResolvedVesselLocation
): DockDepartureState => {
  const leftDockTime = currLocation.LeftDock ?? existingTrip?.LeftDock;

  return {
    leftDockTime,
    didJustLeaveDock: Boolean(
      existingTrip &&
        existingTrip.LeftDock === undefined &&
        currLocation.LeftDock !== undefined
    ),
  };
};

/**
 * Normalize the shared inputs needed by event detection and base trip
 * construction.
 *
 * `current*` values use only the current feed payload. `continuing*` values
 * apply carry-forward protection for transient feed omissions.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Current vessel location from the live feed
 * @returns Normalized trip inputs for this tick
 */
export const deriveTripInputs = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ResolvedVesselLocation
): DerivedTripInputs => {
  const currentArrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;
  const currentScheduledDeparture = currLocation.ScheduledDeparture;
  const shouldPreserveDockedScheduleIdentity = Boolean(
    existingTrip?.AtDock &&
      existingTrip.LeftDock === undefined &&
      currLocation.AtDock &&
      currLocation.DepartingTerminalAbbrev ===
        existingTrip.DepartingTerminalAbbrev
  );
  const continuingArrivingTerminalAbbrev = shouldPreserveDockedScheduleIdentity
    ? (existingTrip?.ArrivingTerminalAbbrev ?? currentArrivingTerminalAbbrev)
    : (currentArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev);
  const continuingScheduledDeparture = shouldPreserveDockedScheduleIdentity
    ? (existingTrip?.ScheduledDeparture ?? currentScheduledDeparture)
    : (currentScheduledDeparture ?? existingTrip?.ScheduledDeparture);
  const { leftDockTime, didJustLeaveDock } = getDockDepartureState(
    existingTrip,
    currLocation
  );
  const currentIdentity = deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: currentArrivingTerminalAbbrev,
    scheduledDepartureMs: currentScheduledDeparture,
  });
  const continuingIdentity = deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: continuingArrivingTerminalAbbrev,
    scheduledDepartureMs: continuingScheduledDeparture,
  });

  return {
    currentArrivingTerminalAbbrev,
    continuingArrivingTerminalAbbrev,
    currentScheduledDeparture,
    continuingScheduledDeparture,
    startKey: currentIdentity.Key,
    continuingKey:
      shouldPreserveDockedScheduleIdentity && existingTrip?.Key
        ? existingTrip.Key
        : continuingIdentity.Key,
    startSailingDay: currentIdentity.SailingDay,
    continuingSailingDay: continuingIdentity.SailingDay,
    currentIsTripStartReady: currentIdentity.isTripStartReady,
    leftDockTime,
    didJustLeaveDock,
    previousCompletedTrip: hasTripEvidence(existingTrip)
      ? existingTrip
      : undefined,
  };
};

/**
 * Pick the base-trip construction mode for the current tick.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Current vessel location from the live feed
 * @param isTripStart - True when the caller is explicitly starting a new trip
 * @returns Explicit base-trip mode for this tick
 */
export const determineBaseTripMode = (
  _existingTrip: ConvexVesselTrip | undefined,
  _currLocation: ResolvedVesselLocation,
  isTripStart: boolean
): BaseTripMode => {
  if (isTripStart) {
    return "start";
  }

  return "continue";
};
