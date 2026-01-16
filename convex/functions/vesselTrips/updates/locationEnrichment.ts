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
  if (currLocation.AtDock !== existingTrip.AtDock) {
    updates.AtDock = currLocation.AtDock;
  }

  // ETA changes are used for UI and at-sea predictions.
  if (currLocation.Eta !== existingTrip.Eta) {
    updates.Eta = currLocation.Eta;
  }

  // LeftDock is the actual departure timestamp.
  if (currLocation.LeftDock !== existingTrip.LeftDock) {
    updates.LeftDock = currLocation.LeftDock;
  }

  // ScheduledDeparture can be missing or updated by upstream feed.
  if (currLocation.ScheduledDeparture !== existingTrip.ScheduledDeparture) {
    updates.ScheduledDeparture = currLocation.ScheduledDeparture;
  }

  // TripDelay is derived (minutes), so compute and patch if it changed.
  const tripDelay = calculateTimeDelta(
    currLocation.ScheduledDeparture,
    currLocation.LeftDock
  );

  if (tripDelay !== undefined && tripDelay !== existingTrip.TripDelay) {
    updates.TripDelay = tripDelay;
  }

  // AtDockDuration is derived (minutes), calculated when trip leaves dock.
  // Time delta: LeftDock - TripStart
  const atDockDuration = calculateTimeDelta(
    existingTrip.TripStart,
    currLocation.LeftDock
  );

  if (
    atDockDuration !== undefined &&
    atDockDuration !== existingTrip.AtDockDuration
  ) {
    updates.AtDockDuration = atDockDuration;
  }

  return updates;
};
