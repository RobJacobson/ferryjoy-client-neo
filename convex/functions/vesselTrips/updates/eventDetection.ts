/**
 * Event detection module for vessel trips.
 *
 * Centralizes all trip event detection logic to avoid scattering
 * detection logic across multiple files.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { computeTripKey } from "./utils";

// ============================================================================
// Trip Events
// ============================================================================

/**
 * Result of trip event detection for a vessel update.
 */
export type TripEvents = {
  isFirstTrip: boolean;
  isTripStartReady: boolean;
  shouldStartTrip: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  keyChanged: boolean;
};

type DockDepartureState = {
  leftDockTime: number | undefined;
  didJustLeaveDock: boolean;
};

/**
 * Derive dock-departure state from the previous trip and current location.
 *
 * Uses one shared rule for both event detection and trip field derivation:
 * preserve an existing LeftDock, prefer feed-provided LeftDock, and infer the
 * departure time from the current tick when the vessel has clearly left the dock.
 *
 * @param existingTrip - Previous trip state (undefined for first appearance)
 * @param currLocation - Current vessel location from REST/API
 * @returns Derived LeftDock timestamp and whether this tick represents departure
 */
export const getDockDepartureState = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): DockDepartureState => {
  // Infer departure time when AtDock flips false (vessel just left)
  const inferredLeftDock =
    existingTrip?.AtDock && !currLocation.AtDock
      ? currLocation.TimeStamp
      : undefined;

  // Prefer feed value, carry forward existing, otherwise use inference
  const leftDockTime =
    currLocation.LeftDock ?? existingTrip?.LeftDock ?? inferredLeftDock;

  // Vessel just left dock if it had no LeftDock before and has one now
  return {
    leftDockTime,
    didJustLeaveDock: Boolean(
      existingTrip &&
        existingTrip.LeftDock === undefined &&
        leftDockTime !== undefined
    ),
  };
};

/**
 * Detect all trip events for a vessel update.
 *
 * Centralized event detection that determines what events occurred
 * between the existing trip state and the current location.
 *
 * @param existingTrip - Previous trip state (undefined for first appearance)
 * @param currLocation - Current vessel location from REST/API
 * @returns Object with all event flags
 */
export const detectTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): TripEvents => {
  const isTripStartReady = Boolean(
    currLocation.ScheduledDeparture && currLocation.ArrivingTerminalAbbrev
  );
  const didJustBecomeStartReady = Boolean(
    existingTrip &&
      !existingTrip.TripStart &&
      !existingTrip.ArrivingTerminalAbbrev &&
      currLocation.ArrivingTerminalAbbrev &&
      currLocation.AtDock
  );

  // Carry forward ArrivingTerminal when curr omits it (feed glitch protection)
  const arrivingTerminalAbbrev =
    currLocation.ArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;

  // Carry forward ScheduledDeparture when curr omits it (feed glitch protection)
  const scheduledDeparture =
    currLocation.ScheduledDeparture ?? existingTrip?.ScheduledDeparture;

  // Compute trip key for schedule lookup (shared with baseTripFromLocation)
  const computedKey = computeTripKey(
    currLocation.VesselAbbrev,
    currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDeparture
  );

  // Dock departure state: shared with trip field derivation
  const { didJustLeaveDock } = getDockDepartureState(
    existingTrip,
    currLocation
  );
  const hasTripEvidence = Boolean(
    existingTrip &&
      (existingTrip.LeftDock !== undefined ||
        existingTrip.ArriveDest !== undefined)
  );

  // Return all computed events in a single object
  return {
    // Vessel's first appearance
    isFirstTrip: !existingTrip,
    // Start a trip only when we actually observed the start transition.
    shouldStartTrip: didJustBecomeStartReady,
    isTripStartReady,
    // Trip boundary: next trip info is available and departing terminal changed.
    isCompletedTrip: Boolean(
      hasTripEvidence &&
        isTripStartReady &&
        existingTrip?.DepartingTerminalAbbrev !==
          currLocation.DepartingTerminalAbbrev
    ),
    // Arrive at dock: destination terminal changes to the newly reached terminal.
    didJustArriveAtDock: Boolean(
      existingTrip &&
        currLocation.ArrivingTerminalAbbrev &&
        existingTrip.ArrivingTerminalAbbrev !==
          currLocation.ArrivingTerminalAbbrev
    ),
    // Dock departure state computed by getDockDepartureState
    didJustLeaveDock,
    // Key changed: newly available or differs from existing (triggers schedule lookup)
    keyChanged: Boolean(computedKey && existingTrip?.Key !== computedKey),
  };
};
