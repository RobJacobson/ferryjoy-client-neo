/**
 * Shared trip-derivation helpers for vessel trip updates.
 *
 * Base-trip construction derives from an already-prepared location. Raw-feed
 * lifecycle detection stays in `detectTripEvents.ts` so trip-field inference
 * policy remains isolated in `tripFields/`.
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

export type DockDepartureState = {
  leftDockTime: number | undefined;
  didJustLeaveDock: boolean;
};

export type DerivedTripInputs = {
  currentArrivingTerminalAbbrev: string | undefined;
  currentScheduledDeparture: number | undefined;
  startScheduleKey: string | undefined;
  startSailingDay: string | undefined;
  continuingArrivingTerminalAbbrev: string | undefined;
  continuingScheduledDeparture: number | undefined;
  continuingScheduleKey: string | undefined;
  continuingSailingDay: string | undefined;
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
 * Normalizes inputs for base trip construction from the prepared location.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Location for this derivation
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
  const { leftDockTime, didJustLeaveDock } = getDockDepartureState(
    existingTrip,
    currLocation,
    physicalBoundaries
  );
  const identity = deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    scheduledDepartureMs: currLocation.ScheduledDeparture,
  });
  const scheduleKey = currLocation.ScheduleKey ?? identity.ScheduleKey;

  return {
    currentArrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    currentScheduledDeparture: currLocation.ScheduledDeparture,
    startScheduleKey: scheduleKey,
    startSailingDay: identity.SailingDay,
    continuingArrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    continuingScheduledDeparture: currLocation.ScheduledDeparture,
    continuingScheduleKey: scheduleKey,
    continuingSailingDay: identity.SailingDay,
    leftDockTime,
    didJustLeaveDock,
    previousCompletedTrip: hasTripEvidence(existingTrip)
      ? existingTrip
      : undefined,
  };
};
