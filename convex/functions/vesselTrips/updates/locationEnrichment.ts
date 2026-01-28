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
  // Only update if the API provides a truthy value and it differs from existing.
  // This prevents overwriting non-null values with null/undefined.
  if (
    Boolean(currLocation.ArrivingTerminalAbbrev) &&
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
  // Only update if REST data provides a truthy value and it differs from existing.
  // This prevents overwriting non-null values with null/undefined.
  if (Boolean(currLocation.Eta) && currLocation.Eta !== existingTrip.Eta) {
    updates.Eta = currLocation.Eta;
  }

  // LeftDock is the actual departure timestamp.
  // Handle LeftDock updates with priority rules:
  // 1. If AtDock flips from true to false and LeftDock is missing, set it to
  //    reported LeftDock (if any) or current update's TimeStamp
  // 2. Official LeftDock from currLocation always takes priority over existing,
  //    but only if REST data provides a truthy value (prevents null overwrites)
  if (atDockFlippedToFalse && !existingTrip.LeftDock) {
    // Vessel just left dock and we don't have a LeftDock time yet
    // Use reported LeftDock if available, otherwise use current update timestamp
    updates.LeftDock = currLocation.LeftDock ?? currLocation.TimeStamp;
  } else if (
    Boolean(currLocation.LeftDock) &&
    currLocation.LeftDock !== existingTrip.LeftDock
  ) {
    // Official LeftDock is provided - it always takes priority
    // Only update if REST data provides a truthy value to prevent null overwrites
    updates.LeftDock = currLocation.LeftDock;
  }

  // ScheduledDeparture can be missing or updated by upstream feed.
  // Only update if REST data provides a truthy value and it differs from existing.
  // This prevents overwriting non-null values with null/undefined.
  if (
    Boolean(currLocation.ScheduledDeparture) &&
    currLocation.ScheduledDeparture !== existingTrip.ScheduledDeparture
  ) {
    updates.ScheduledDeparture = currLocation.ScheduledDeparture;
  }

  // Determine effective LeftDock value for derived field calculations.
  // Use the value we just set in updates, or fall back to currLocation or existing.
  const effectiveLeftDock =
    updates.LeftDock ?? currLocation.LeftDock ?? existingTrip.LeftDock;

  const effectiveScheduledDeparture =
    updates.ScheduledDeparture ??
    currLocation.ScheduledDeparture ??
    existingTrip.ScheduledDeparture;

  // TripDelay is derived (minutes), so compute and patch if it changed.
  const tripDelay = calculateTimeDelta(
    effectiveScheduledDeparture,
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
