/**
 * Shared trip-derivation helpers for vessel trip updates.
 *
 * Centralizes the normalized per-tick values used by both event detection and
 * base trip construction so the two paths stay in sync.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getSailingDay } from "shared/time";
import { computeTripKey } from "./utils";

export type BaseTripMode = "start" | "dock_hold" | "continue";

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
  leftDockTime: number | undefined;
  didJustLeaveDock: boolean;
  didJustBecomeStartReady: boolean;
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
  currLocation: ConvexVesselLocation
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
 * Detect whether a pre-trip record has just gained enough feed data to become
 * a real trip while the vessel is still at dock.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Current vessel location from the live feed
 * @returns True when the vessel should transition from pre-trip to real trip
 */
export const didTripJustBecomeStartReady = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean =>
  Boolean(
    existingTrip &&
      !existingTrip.TripStart &&
      !existingTrip.ArrivingTerminalAbbrev &&
      currLocation.ArrivingTerminalAbbrev &&
      currLocation.AtDock
  );

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
  const continuingArrivingTerminalAbbrev =
    currentArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;
  const continuingScheduledDeparture =
    currentScheduledDeparture ?? existingTrip?.ScheduledDeparture;
  const { leftDockTime, didJustLeaveDock } = getDockDepartureState(
    existingTrip,
    currLocation
  );

  return {
    currentArrivingTerminalAbbrev,
    continuingArrivingTerminalAbbrev,
    currentScheduledDeparture,
    continuingScheduledDeparture,
    startKey: computeTripKey(
      currLocation.VesselAbbrev,
      currLocation.DepartingTerminalAbbrev,
      currentArrivingTerminalAbbrev,
      currentScheduledDeparture
    ),
    continuingKey: computeTripKey(
      currLocation.VesselAbbrev,
      currLocation.DepartingTerminalAbbrev,
      continuingArrivingTerminalAbbrev,
      continuingScheduledDeparture
    ),
    startSailingDay: toSailingDay(currentScheduledDeparture),
    continuingSailingDay: toSailingDay(continuingScheduledDeparture),
    leftDockTime,
    didJustLeaveDock,
    didJustBecomeStartReady: didTripJustBecomeStartReady(
      existingTrip,
      currLocation
    ),
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
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation,
  isTripStart: boolean
): BaseTripMode => {
  if (isTripStart) {
    return "start";
  }

  if (
    hasTripEvidence(existingTrip) &&
    existingTrip.DepartingTerminalAbbrev !==
      currLocation.DepartingTerminalAbbrev
  ) {
    return "dock_hold";
  }

  return "continue";
};

/**
 * Convert a scheduled departure timestamp into a sailing day when present.
 *
 * @param scheduledDeparture - Scheduled departure timestamp in epoch milliseconds
 * @returns Sailing day string, or undefined when no scheduled departure exists
 */
const toSailingDay = (
  scheduledDeparture: number | undefined
): string | undefined =>
  scheduledDeparture === undefined
    ? undefined
    : getSailingDay(new Date(scheduledDeparture));
