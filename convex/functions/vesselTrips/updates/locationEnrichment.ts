import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

/**
 * Compute field-level changes from the vessel location feed.
 *
 * This is intentionally a *diff* generator: only changed fields are included in
 * the returned patch.
 *
 * @param existingTrip - Current vessel trip state
 * @param currLocation - Latest vessel location data
 * @returns Partial trip update with only changed fields
 */
export const enrichTripFields = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Partial<ConvexVesselTrip> => {
  const updates: Partial<ConvexVesselTrip> = {};

  // Terminal changes are meaningful trip identity signals.
  if (
    currLocation.ArrivingTerminalAbbrev !== existingTrip.ArrivingTerminalAbbrev
  ) {
    updates.ArrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;
  }

  // AtDock can flip frequently and drives prediction strategy.
  const atDockFlipped = currLocation.AtDock !== existingTrip.AtDock;
  const atDockFlippedToFalse =
    atDockFlipped && !currLocation.AtDock && existingTrip.AtDock;

  if (atDockFlipped) {
    updates.AtDock = currLocation.AtDock;
  }

  // ETA changes are used for UI and at-sea predictions.
  if (currLocation.Eta !== existingTrip.Eta) {
    updates.Eta = currLocation.Eta;
  }

  // LeftDock is the actual departure timestamp.
  // Handle LeftDock updates with priority rules:
  // 1. If AtDock flips from true to false and LeftDock is missing, set it to
  //    reported LeftDock (if any) or current update's TimeStamp
  // 2. Official LeftDock from currLocation always takes priority over existing
  if (atDockFlippedToFalse && !existingTrip.LeftDock) {
    // Vessel just left dock and we don't have a LeftDock time yet
    // Use reported LeftDock if available, otherwise use current update timestamp
    updates.LeftDock = currLocation.LeftDock ?? currLocation.TimeStamp;
  } else if (currLocation.LeftDock !== undefined) {
    // Official LeftDock is provided - it always takes priority
    if (currLocation.LeftDock !== existingTrip.LeftDock) {
      updates.LeftDock = currLocation.LeftDock;
    }
  }

  // ScheduledDeparture can be missing or updated by upstream feed.
  if (currLocation.ScheduledDeparture !== existingTrip.ScheduledDeparture) {
    updates.ScheduledDeparture = currLocation.ScheduledDeparture;
  }

  // Determine effective LeftDock value for derived field calculations.
  // Use the value we just set in updates, or fall back to currLocation or existing.
  const effectiveLeftDock =
    updates.LeftDock ?? currLocation.LeftDock ?? existingTrip.LeftDock;

  // TripDelay is derived (minutes), so compute and patch if it changed.
  const tripDelay = calculateTimeDelta(
    currLocation.ScheduledDeparture,
    effectiveLeftDock
  );

  if (tripDelay !== undefined && tripDelay !== existingTrip.TripDelay) {
    updates.TripDelay = tripDelay;
  }

  // AtDockDuration is derived (minutes), calculated when trip leaves dock.
  // Time delta: LeftDock - TripStart
  const atDockDuration = calculateTimeDelta(
    existingTrip.TripStart,
    effectiveLeftDock
  );

  if (
    atDockDuration !== undefined &&
    atDockDuration !== existingTrip.AtDockDuration
  ) {
    updates.AtDockDuration = atDockDuration;
  }

  return updates;
};
