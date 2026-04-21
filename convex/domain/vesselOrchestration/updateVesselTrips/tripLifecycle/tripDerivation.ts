/**
 * Shared trip-derivation helpers for vessel trip updates.
 *
 * Centralizes normalized per-ping values for base trip construction; shares
 * continuing schedule identity with {@link detectTripEvents} via
 * {@link deriveContinuingScheduleKey}.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { DebouncedPhysicalBoundaryResult } from "./physicalDockSeaDebounce";
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
  didJustArriveAtDock: boolean;
  previousCompletedTrip: ConvexVesselTrip | undefined;
};

type ContinuingTripIdentitySlice = {
  continuingArrivingTerminalAbbrev: string | undefined;
  continuingScheduledDeparture: number | undefined;
  continuingScheduleKey: string | undefined;
  continuingSailingDay: string | undefined;
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
 * @param physicalBoundaries - Result of a single {@link resolveDebouncedPhysicalBoundaries} call for this ping
 * @returns Normalized departure timestamp and whether this ping records departure
 */
export const getDockDepartureState = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation,
  physicalBoundaries: DebouncedPhysicalBoundaryResult
): DockDepartureState => {
  const persistedDeparture = getPhysicalDepartureStamp(existingTrip);
  const { didJustLeaveDock } = physicalBoundaries;
  const leftDockTime = rawDepartureIsContradictory(existingTrip, currLocation)
    ? persistedDeparture
    : (currLocation.LeftDock ?? persistedDeparture);

  return {
    leftDockTime,
    didJustLeaveDock,
  };
};

/**
 * Normalizes inputs shared by event detection and base trip construction.
 *
 * `current*` fields reflect the `currLocation` payload. `continuing*` fields
 * apply carry-forward rules when the feed drops fields while still docked.
 *
 * Call from {@link baseTripFromLocation} with **effective** locations after
 * schedule resolution. For raw-feed lifecycle flags without this full object,
 * see {@link detectTripEvents}.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Location for this derivation (raw or effective)
 * @returns Normalized trip inputs for this ping
 */
export const deriveTripInputs = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): DerivedTripInputs => {
  const physicalBoundaries = resolveDebouncedPhysicalBoundaries(
    existingTrip,
    currLocation
  );
  const currentArrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;
  const currentScheduledDeparture = currLocation.ScheduledDeparture;
  const continuingSlice = computeContinuingTripIdentitySlice(
    existingTrip,
    currLocation
  );
  const { leftDockTime, didJustLeaveDock } = getDockDepartureState(
    existingTrip,
    currLocation,
    physicalBoundaries
  );
  const currentIdentity = deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: currentArrivingTerminalAbbrev,
    scheduledDepartureMs: currentScheduledDeparture,
  });

  return {
    currentArrivingTerminalAbbrev,
    continuingArrivingTerminalAbbrev:
      continuingSlice.continuingArrivingTerminalAbbrev,
    currentScheduledDeparture,
    continuingScheduledDeparture: continuingSlice.continuingScheduledDeparture,
    startScheduleKey: currentIdentity.ScheduleKey,
    continuingScheduleKey: continuingSlice.continuingScheduleKey,
    startSailingDay: currentIdentity.SailingDay,
    continuingSailingDay: continuingSlice.continuingSailingDay,
    currentIsTripStartReady: currentIdentity.isTripStartReady,
    leftDockTime,
    didJustLeaveDock,
    didJustArriveAtDock: physicalBoundaries.didJustArriveAtDock,
    previousCompletedTrip: hasTripEvidence(existingTrip)
      ? existingTrip
      : undefined,
  };
};

/**
 * Returns the continuing `ScheduleKey` for a location sample (raw or effective).
 *
 * Matches the carry-forward rules in {@link deriveTripInputs} so
 * `scheduleKeyChanged` in {@link detectTripEvents} stays aligned with base-trip
 * construction without running the full derivation.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Location for this derivation (raw or effective)
 * @returns Schedule segment key after dock-boundary carry-forward, if any
 */
export const deriveContinuingScheduleKey = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): string | undefined =>
  computeContinuingTripIdentitySlice(existingTrip, currLocation)
    .continuingScheduleKey;

/**
 * Pick the base-trip construction mode for the current ping.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Current vessel location from the live feed
 * @param isTripStart - True when the caller is explicitly starting a new trip
 * @returns Explicit base-trip mode for this ping
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

/**
 * Computes continuing terminal, scheduled departure, and schedule identity while
 * the vessel is in a dock interval (carry-forward when the feed omits fields).
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Location for this derivation (raw or effective)
 * @returns Continuing fields aligned with {@link deriveTripInputs}
 */
function computeContinuingTripIdentitySlice(
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): ContinuingTripIdentitySlice {
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
        // On the exact leave-dock ping, write the departure actual to the
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
  const continuingIdentity = deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: continuingArrivingTerminalAbbrev,
    scheduledDepartureMs: continuingScheduledDeparture,
  });

  return {
    continuingArrivingTerminalAbbrev,
    continuingScheduledDeparture,
    continuingScheduleKey:
      shouldPreserveDockBoundaryOwner && existingTrip?.ScheduleKey
        ? existingTrip.ScheduleKey
        : continuingIdentity.ScheduleKey,
    continuingSailingDay: continuingIdentity.SailingDay,
  };
}
