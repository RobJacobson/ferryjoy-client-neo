/**
 * AtDockObserved vote-resolution and mapping for normalized location rows.
 */

import type {
  ConvexVesselLocation,
  ConvexVesselLocationIncoming,
} from "functions/vesselLocation/schemas";

const SPEED_DOCKED_THRESHOLD_KNOTS = 0.5;

/**
 * Adds `AtDockObserved` to each normalized incoming row.
 *
 * Uses the persisted row for the same vessel (if present) as the fallback when
 * the current signal is indeterminate.
 * This keeps the heuristic pure and deterministic: callers provide prior state,
 * this mapper applies the vote logic, and no database or transport concerns
 * leak into the business rule.
 *
 * @param existingLocations - Existing persisted live vessel locations
 * @param incomingLocations - Newly normalized rows for this ingest tick
 * @returns Incoming rows augmented with `AtDockObserved`
 */
export const addAtDockObserved = (
  existingLocations: ReadonlyArray<ConvexVesselLocation>,
  incomingLocations: ReadonlyArray<ConvexVesselLocationIncoming>
): ReadonlyArray<ConvexVesselLocation> =>
  // Enrich each incoming row with a stable observed docked state value.
  incomingLocations.map((incomingLocation) => {
    // Resolve the previous persisted row for this vessel using fleet-size linear scan.
    const previousLocation = existingLocations.find(
      (existingLocation) =>
        existingLocation.VesselAbbrev === incomingLocation.VesselAbbrev
    );
    // Derive the next observed state from current votes and prior state fallback.
    const resolvedAtDockObserved = resolveAtDockObserved(
      incomingLocation,
      previousLocation?.AtDockObserved
    );
    // Return canonical persisted row shape with observed state attached.
    return {
      ...incomingLocation,
      AtDockObserved: resolvedAtDockObserved,
    };
  });

/**
 * Resolves one vessel row's docked state with a 2-of-3 voting heuristic.
 *
 * @param location - Normalized incoming row for one vessel
 * @param previousAtDockObserved - Previous persisted observed state if available
 * @returns Stable observed docked state
 */
const resolveAtDockObserved = (
  location: ConvexVesselLocationIncoming,
  previousAtDockObserved: boolean | undefined
): boolean => {
  // Build the three docked-oriented votes used for majority resolution.
  const votes = [
    location.AtDock === true,
    getSlowSpeedVote(location.Speed),
    location.LeftDock === undefined,
  ];
  // Count true and false votes; undefined votes remain indeterminate.
  const trueVoteCount = votes.filter((vote) => vote === true).length;
  const falseVoteCount = votes.filter((vote) => vote === false).length;

  // Confirm docked state when at least two independent signals agree.
  if (trueVoteCount >= 2) {
    return true;
  }
  // Confirm at-sea state when at least two opposite signals agree.
  if (falseVoteCount >= 2) {
    return false;
  }

  // Hold the prior observed state until the next definitive 2-of-3 signal.
  return previousAtDockObserved ?? false;
};

/**
 * Converts speed into a docked-oriented vote value.
 *
 * @param speed - Vessel speed from normalized feed row
 * @returns Docked vote, sea vote, or indeterminate vote
 */
const getSlowSpeedVote = (speed: number): boolean | undefined => {
  // Mark speed vote indeterminate when upstream value is not finite.
  if (!Number.isFinite(speed)) {
    return undefined;
  }
  // Treat near-zero speed as a docked-oriented signal.
  return speed < SPEED_DOCKED_THRESHOLD_KNOTS;
};
