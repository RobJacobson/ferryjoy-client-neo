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
 * Resolves each row using a 2-of-3 boolean majority:
 * `AtDock`, low speed, and `LeftDock` absence.
 *
 * @param incomingLocations - Newly normalized rows for this ingest tick
 * @returns Incoming rows augmented with `AtDockObserved`
 */
export const addAtDockObserved = (
  incomingLocations: ReadonlyArray<ConvexVesselLocationIncoming>
): ReadonlyArray<ConvexVesselLocation> =>
  // Enrich each incoming row with a stable observed docked state value.
  incomingLocations.map((incomingLocation) => {
    // Derive the next observed state from current boolean majority votes.
    const resolvedAtDockObserved = resolveAtDockObserved(incomingLocation);
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
 * @returns Majority-vote observed docked state
 */
const resolveAtDockObserved = (location: ConvexVesselLocationIncoming): boolean => {
  // Build the three docked-oriented votes used for majority resolution.
  const votes = [
    location.AtDock === true,
    isSlowSpeed(location.Speed),
    location.LeftDock === undefined,
  ];
  // Resolve to docked when at least two independent signals agree.
  const trueVoteCount = votes.filter((vote) => vote).length;
  return trueVoteCount >= 2;
};

/**
 * Treats low speed as an "at dock" signal boolean.
 *
 * @param speed - Vessel speed from normalized feed row
 * @returns Docked-oriented speed vote
 */
const isSlowSpeed = (speed: number): boolean =>
  speed < SPEED_DOCKED_THRESHOLD_KNOTS;
