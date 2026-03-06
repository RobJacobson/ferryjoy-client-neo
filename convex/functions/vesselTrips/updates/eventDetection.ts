/**
 * Event detection module for vessel trips.
 *
 * Centralizes all trip event detection logic to avoid scattering
 * detection logic across multiple files.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/keys";

// ============================================================================
// Trip Events
// ============================================================================

/**
 * Result of trip event detection for a vessel update.
 */
export type TripEvents = {
  isFirstTrip: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  keyChanged: boolean;
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
  const isFirstTrip = !existingTrip;
  const arrivingTerminalAbbrev =
    currLocation.ArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;
  const scheduledDeparture =
    currLocation.ScheduledDeparture ?? existingTrip?.ScheduledDeparture;

  // Trip boundary: DepartingTerminalAbbrev changed
  const isCompletedTrip: boolean =
    !!existingTrip &&
    existingTrip.DepartingTerminalAbbrev !==
      currLocation.DepartingTerminalAbbrev;

  // Arrive at dock: AtDock flipped from false to true
  const didJustArriveAtDock: boolean =
    !!existingTrip && !existingTrip.AtDock && currLocation.AtDock;

  // Leave dock: LeftDock transitioned from undefined to defined,
  // or AtDock flipped false and we infer LeftDock from tick
  const justLeftDock = existingTrip?.AtDock && !currLocation.AtDock;
  const didJustLeaveDock: boolean = Boolean(
    existingTrip &&
      existingTrip.LeftDock === undefined &&
      (currLocation.LeftDock !== undefined || justLeftDock)
  );

  const computedKey = generateTripKey(
    currLocation.VesselAbbrev,
    currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDeparture ? new Date(scheduledDeparture) : undefined
  );

  // Key changed: computed Key is newly available or differs from existing.
  const keyChanged: boolean = Boolean(
    computedKey && existingTrip?.Key !== computedKey
  );

  return {
    isFirstTrip,
    isCompletedTrip,
    didJustArriveAtDock,
    didJustLeaveDock,
    keyChanged,
  };
};
