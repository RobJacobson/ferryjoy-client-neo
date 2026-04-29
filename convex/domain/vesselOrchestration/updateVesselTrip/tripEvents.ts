/**
 * Physical lifecycle detection for one vessel ping.
 *
 * This module owns the feed-driven lifecycle rules and the derived event bundle
 * consumed by the trip builders.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { TripLifecycleEventFlags } from "./tripLifecycle";

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
  if (!existingTrip) {
    return {
      isCompletedTrip: false,
      didJustArriveAtDock: false,
      didJustLeaveDock: false,
      leftDockTime: currLocation.LeftDock,
      scheduleKeyChanged: false,
    };
  }

  const persistedDeparture =
    existingTrip.LeftDockActual ?? existingTrip.LeftDock;
  const didJustLeaveDock = existingTrip.AtDock && !currLocation.AtDockObserved;
  const didJustArriveAtDock =
    existingTrip.DepartingTerminalAbbrev !==
    currLocation.DepartingTerminalAbbrev;

  const leftDockTime = didJustLeaveDock
    ? (currLocation.LeftDock ?? currLocation.TimeStamp)
    : persistedDeparture;
  const continuingScheduleKey = getRawLifecycleScheduleKey(
    existingTrip,
    currLocation
  );

  return {
    isCompletedTrip: didJustArriveAtDock,
    didJustArriveAtDock,
    didJustLeaveDock,
    leftDockTime,
    // Flag schedule transitions so downstream builders can clear stale next-leg data.
    scheduleKeyChanged: existingTrip.ScheduleKey !== continuingScheduleKey,
  };
};

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
