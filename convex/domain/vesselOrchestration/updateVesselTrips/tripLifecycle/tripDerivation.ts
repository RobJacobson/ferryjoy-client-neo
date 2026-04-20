/**
 * Shared trip-derivation helpers for vessel trip updates.
 *
 * Centralizes the normalized per-tick values used by both event detection and
 * base trip construction so the two paths stay in sync.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import {
  getPhysicalDepartureStamp,
  rawDepartureIsContradictory,
  resolveDebouncedPhysicalBoundaries,
} from "./physicalDockSeaDebounce";

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
  startScheduleKey: string | undefined;
  continuingScheduleKey: string | undefined;
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
      (existingTrip.LeftDockActual !== undefined ||
        existingTrip.ArrivedNextActual !== undefined ||
        existingTrip.LeftDock !== undefined ||
        existingTrip.LeftDockActual !== undefined ||
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
  currLocation: ConvexVesselLocation
): DockDepartureState => {
  const persistedDeparture = getPhysicalDepartureStamp(existingTrip);
  const { didJustLeaveDock } = resolveDebouncedPhysicalBoundaries(
    existingTrip,
    currLocation
  );
  const leftDockTime = rawDepartureIsContradictory(existingTrip, currLocation)
    ? persistedDeparture
    : (currLocation.LeftDock ?? persistedDeparture);

  return {
    leftDockTime,
    didJustLeaveDock,
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
  currLocation: ConvexVesselLocation
): DerivedTripInputs => {
  const currentArrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;
  const currentScheduledDeparture = currLocation.ScheduledDeparture;
  const persistedDeparture = getPhysicalDepartureStamp(existingTrip);
  const shouldPreserveDockBoundaryOwner = Boolean(
    existingTrip?.AtDock &&
      existingTrip.DepartingTerminalAbbrev ===
        currLocation.DepartingTerminalAbbrev &&
      // While the vessel remains docked, preserve the boundary owner for the
      // current dock interval so feed omissions do not churn the active trip.
      ((persistedDeparture === undefined && currLocation.AtDock) ||
        // On the exact leave-dock tick, write the departure actual to the
        // boundary that ended the dock interval and starts the sea interval.
        // Raw feed identity fields can transiently jump ahead as LeftDock first
        // appears, but that should not reassign ownership of the departure.
        (persistedDeparture === undefined &&
          currLocation.LeftDock !== undefined))
  );
  const continuingArrivingTerminalAbbrev = shouldPreserveDockBoundaryOwner
    ? (existingTrip?.ArrivingTerminalAbbrev ?? currentArrivingTerminalAbbrev)
    : (currentArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev);
  const continuingScheduledDeparture = shouldPreserveDockBoundaryOwner
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
    startScheduleKey: currentIdentity.ScheduleKey,
    continuingScheduleKey:
      shouldPreserveDockBoundaryOwner && existingTrip?.ScheduleKey
        ? existingTrip.ScheduleKey
        : continuingIdentity.ScheduleKey,
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
  _currLocation: ConvexVesselLocation,
  isTripStart: boolean
): BaseTripMode => {
  if (isTripStart) {
    return "start";
  }

  return "continue";
};
