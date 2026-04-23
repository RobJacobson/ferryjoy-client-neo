/**
 * Physical lifecycle detection for one vessel ping.
 *
 * This module owns the feed-driven dock/sea debounce rules and the derived
 * event bundle consumed by the trip builders.
 */

import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";

type DetectedTripEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

/**
 * Returns the persisted departure timestamp for lifecycle, preferring
 * `LeftDockActual` over legacy departure mirrors.
 */
const getPhysicalDepartureStamp = (
  trip: ConvexVesselTrip | undefined
): number | undefined => trip?.LeftDockActual ?? trip?.LeftDock;

const rawPingSuggestsDocked = (location: ConvexVesselLocation): boolean =>
  location.AtDock && !(location.Speed > 1);

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

const rawArrivalIsContradictory = (
  currLocation: ConvexVesselLocation
): boolean => Boolean(currLocation.AtDock && currLocation.Speed > 1);

const rawDidJustLeaveDock = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean =>
  Boolean(
    existingTrip &&
      getPhysicalDepartureStamp(existingTrip) === undefined &&
      currLocation.LeftDock !== undefined
  );

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

  if (!currLocation.AtDock) {
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

const resolvePhysicalState = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): PhysicalState => {
  let didJustLeaveDock =
    rawDidJustLeaveDock(existingTrip, currLocation) &&
    !rawDepartureIsContradictory(existingTrip, currLocation);

  let didJustArriveAtDock =
    rawDidJustArriveAtDock(existingTrip, currLocation) &&
    !rawArrivalIsContradictory(currLocation);

  if (didJustLeaveDock && didJustArriveAtDock) {
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

const getRawLifecycleScheduleKey = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): string | undefined => {
  const shouldPreserveDockWindowScheduleKey = Boolean(
    existingTrip?.AtDock &&
      existingTrip.LeftDock === undefined &&
      existingTrip.DepartingTerminalAbbrev ===
        currLocation.DepartingTerminalAbbrev &&
      ((currLocation.AtDock && currLocation.LeftDock === undefined) ||
        currLocation.LeftDock !== undefined)
  );

  return shouldPreserveDockWindowScheduleKey
    ? (existingTrip?.ScheduleKey ?? currLocation.ScheduleKey)
    : currLocation.ScheduleKey;
};

export const detectTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): DetectedTripEvents => {
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
    scheduleKeyChanged: existingTrip?.ScheduleKey !== continuingScheduleKey,
  };
};
