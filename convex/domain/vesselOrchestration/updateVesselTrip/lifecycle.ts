/**
 * Physical lifecycle detection for one vessel ping.
 *
 * This module owns the feed-driven lifecycle rules and the derived event bundle
 * consumed by the trip builders.
 */

import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";

type DetectedTripEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

/**
 * Detects lifecycle transitions and schedule-key continuity for one ping.
 *
 * @param existingTrip - Current active trip row, if present
 * @param currLocation - Incoming vessel location ping
 * @returns Lifecycle event flags and resolved left-dock timestamp
 */
export const detectTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): DetectedTripEvents => {
  // Resolve physical transitions first, then derive schedule semantics.
  const physical = resolvePhysicalState(existingTrip, currLocation);
  const continuingScheduleKey = getRawLifecycleScheduleKey(
    existingTrip,
    currLocation
  );

  return {
    isFirstTrip: existingTrip === undefined,
    isTripStartReady: deriveTripIdentity({
      vesselAbbrev: currLocation.VesselAbbrev,
      departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
      arrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
      scheduledDepartureMs: currLocation.ScheduledDeparture,
    }).isTripStartReady,
    isCompletedTrip: Boolean(
      hasTripEvidence(existingTrip) && physical.didJustArriveAtDock
    ),
    didJustArriveAtDock: physical.didJustArriveAtDock,
    didJustLeaveDock: physical.didJustLeaveDock,
    leftDockTime: physical.leftDockTime,
    // Flag schedule transitions so downstream builders can clear stale next-leg data.
    scheduleKeyChanged: existingTrip?.ScheduleKey !== continuingScheduleKey,
  };
};

/**
 * Returns the persisted departure timestamp for lifecycle, preferring
 * `LeftDockActual` over legacy departure mirrors.
 *
 * @param trip - Active trip row to inspect
 * @returns Preferred departure timestamp or undefined when not departed
 */
const getPhysicalDepartureStamp = (
  trip: ConvexVesselTrip | undefined
): number | undefined => trip?.LeftDockActual ?? trip?.LeftDock;

/**
 * Checks whether the raw ping still describes a docked vessel.
 *
 * @param location - Incoming vessel location ping
 * @returns True when vessel is observed as docked
 */
const rawPingSuggestsDocked = (location: ConvexVesselLocation): boolean =>
  location.AtDockObserved === true;

/**
 * Detects contradictory departure evidence in the same ping.
 *
 * @param existingTrip - Current active trip row, if present
 * @param currLocation - Incoming vessel location ping
 * @returns True when ping reports departure while speed/at-dock indicates otherwise
 */
const rawDepartureIsContradictory = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean =>
  Boolean(
    existingTrip &&
      getPhysicalDepartureStamp(existingTrip) === undefined &&
      currLocation.LeftDock !== undefined &&
      rawPingSuggestsDocked(currLocation)
  );

/**
 * Detects a raw leave-dock transition before contradiction filtering.
 *
 * @param existingTrip - Current active trip row, if present
 * @param currLocation - Incoming vessel location ping
 * @returns True when departure timestamp first appears
 */
const rawDidJustLeaveDock = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean =>
  Boolean(
    existingTrip &&
      getPhysicalDepartureStamp(existingTrip) === undefined &&
      currLocation.LeftDock !== undefined
  );

/**
 * Detects a raw arrive-dock transition before contradiction filtering.
 *
 * @param existingTrip - Current active trip row, if present
 * @param currLocation - Incoming vessel location ping
 * @returns True when vessel reaches a different terminal after departure
 */
const rawDidJustArriveAtDock = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean => {
  if (!existingTrip) {
    return false;
  }

  const departed = getPhysicalDepartureStamp(existingTrip);
  if (
    departed === undefined ||
    existingTrip.ArrivedNextActual !== undefined ||
    existingTrip.ArriveDest !== undefined
  ) {
    return false;
  }

  if (!currLocation.AtDockObserved) {
    return false;
  }

  return (
    currLocation.DepartingTerminalAbbrev !==
    existingTrip.DepartingTerminalAbbrev
  );
};

type PhysicalState = {
  didJustLeaveDock: boolean;
  didJustArriveAtDock: boolean;
  leftDockTime: number | undefined;
};

/**
 * Resolves debounced physical lifecycle state from noisy raw signals.
 *
 * @param existingTrip - Current active trip row, if present
 * @param currLocation - Incoming vessel location ping
 * @returns Filtered leave/arrive booleans and normalized departure timestamp
 */
const resolvePhysicalState = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): PhysicalState => {
  let didJustLeaveDock =
    rawDidJustLeaveDock(existingTrip, currLocation) &&
    !rawDepartureIsContradictory(existingTrip, currLocation);

  let didJustArriveAtDock =
    rawDidJustArriveAtDock(existingTrip, currLocation);

  if (didJustLeaveDock && didJustArriveAtDock) {
    // Drop impossible simultaneous transition events from noisy pings.
    didJustLeaveDock = false;
    didJustArriveAtDock = false;
  }

  const persistedDeparture = getPhysicalDepartureStamp(existingTrip);
  const leftDockTime = rawDepartureIsContradictory(existingTrip, currLocation)
    ? persistedDeparture
    : (currLocation.LeftDock ?? persistedDeparture);

  return {
    didJustLeaveDock,
    didJustArriveAtDock,
    leftDockTime,
  };
};

/**
 * Checks whether a trip has enough evidence to count as an actual trip.
 *
 * @param existingTrip - Current active trip row, if present
 * @returns True when any meaningful lifecycle timestamp exists
 */
const hasTripEvidence = (
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
 * Chooses the schedule key for lifecycle continuity decisions.
 *
 * @param existingTrip - Current active trip row, if present
 * @param currLocation - Incoming vessel location ping
 * @returns Continued schedule key within same dock window or raw ping key
 */
const getRawLifecycleScheduleKey = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): string | undefined => {
  // Preserve schedule attachment while staying in the same dock window.
  const shouldPreserveDockWindowScheduleKey = Boolean(
    existingTrip?.AtDock &&
      existingTrip.LeftDock === undefined &&
      existingTrip.DepartingTerminalAbbrev ===
        currLocation.DepartingTerminalAbbrev &&
      ((currLocation.AtDockObserved && currLocation.LeftDock === undefined) ||
        currLocation.LeftDock !== undefined)
  );

  return shouldPreserveDockWindowScheduleKey
    ? (existingTrip?.ScheduleKey ?? currLocation.ScheduleKey)
    : currLocation.ScheduleKey;
};
