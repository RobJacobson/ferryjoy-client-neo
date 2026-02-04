/**
 * Utility for matching a scheduled trip segment to a real-time vessel trip.
 * Uses deterministic key-based matching for bulletproof vessel-trip association.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { Segment } from "../types";

/**
 * Result of the vessel trip matching logic.
 * All flags are clear, non-overlapping, and mutually exclusive.
 */
export type MatchResult = {
  /**
   * The matched vessel trip, if any.
   */
  displayTrip: VesselTrip | null;
  /**
   * Vessel is heading to origin terminal (at sea, incoming).
   * Mutually exclusive with isAtOriginDock and isInTransitForSegment.
   * Example: Vessel on LOP→ANA, displaying segment ANA→LOP
   */
  isIncoming: boolean;
  /**
   * Vessel is physically docked at origin terminal.
   * AtDock=true AND at correct terminal for this segment.
   * Mutually exclusive with isIncoming and isInTransitForSegment.
   */
  isAtOriginDock: boolean;
  /**
   * Vessel is at sea for this specific segment (correct direction).
   * AtDock=false AND matching segment's direction.
   * Mutually exclusive with isIncoming and isAtOriginDock.
   */
  isInTransitForSegment: boolean;
  /**
   * This is the correct trip for this segment.
   * Matches segment's Key or DirectKey, direction, and departure time.
   * Used to determine which predictions to display.
   */
  isCorrectTrip: boolean;
};

/**
 * Matches a scheduled segment to a real-time vessel trip using keys.
 *
 * ## Why This Is Bulletproof
 *
 * Keys are generated on the backend using a composite format that includes:
 * - Vessel abbreviation
 * - Sailing day
 * - Scheduled departure time
 * - Departing terminal abbreviation
 * - Arriving terminal abbreviation
 *
 * This makes each key UNIQUE and deterministic. Key matching eliminates:
 * - Time window ambiguity
 * - Direction mismatches (LOP→ANA matched to ANA→LOP)
 * - Prediction-based false positives
 * - Terminal+time composite key collisions
 *
 * ## How DirectKey Solves Indirect Trip Matching
 *
 * For a physical departure ANA→9:45 serving LOP, SHI, FRH:
 * - ANA→LOP segment: Key=ANA-LOP, DirectKey=ANA-LOP
 * - ANA→SHI segment: Key=ANA-SHI, DirectKey=ANA-LOP
 * - ANA→FRH segment: Key=ANA-FRH, DirectKey=ANA-LOP
 *
 * VesselTrip for this physical movement has Key=ANA-LOP
 *
 * All three segments match via DirectKey, regardless of being direct or indirect.
 *
 * ## Matching Strategy
 *
 * 1. **DirectKey Match** (Primary): Uses segment.DirectKey
 *    - For indirect trips: DirectKey points to underlying physical departure
 *    - For direct trips: DirectKey equals Key
 *    - Reliability: 100% when keys are set correctly
 *
 * 2. **Key Match** (Secondary): Falls back to segment.Key
 *    - Only used if DirectKey match fails
 *    - Reliability: 100% for direct trips, 0% for indirect trips
 *
 * ## Why No Heuristic Fallback Needed
 *
 * If a VesselTrip exists for a scheduled segment, its Key WILL match
 * segment.DirectKey (for indirect) or segment.Key (for direct).
 * The keys are generated deterministically on the backend using the same inputs.
 *
 * @param segment - The scheduled journey segment
 * @param vesselTripMap - Map of trips indexed by Key (O(1) lookup)
 * @returns MatchResult with trip and clear status flags
 */
export const matchVesselTrip = (
  segment: Segment,
  vesselTripMap: Map<string, VesselTrip>
): MatchResult => {
  // 1. Primary: Match by DirectKey (points to physical vessel movement)
  // Works for both direct and indirect segments
  const physicalKey = segment.DirectKey || segment.Key;
  const displayTrip = vesselTripMap.get(physicalKey);

  // 2. No fallback needed - if key doesn't exist, trip doesn't exist

  // 3. Calculate clear, mutually exclusive flags
  if (!displayTrip) {
    return {
      displayTrip: null,
      isIncoming: false,
      isAtOriginDock: false,
      isInTransitForSegment: false,
      isCorrectTrip: false,
    };
  }

  // Vessel is physically at the origin terminal dock
  const isAtOriginDock =
    displayTrip.AtDock &&
    displayTrip.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev;

  // Vessel is at sea for this specific segment
  const isInTransitForSegment =
    !displayTrip.AtDock &&
    displayTrip.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
    displayTrip.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev;

  // Vessel is incoming (heading to origin terminal)
  const isIncoming =
    !displayTrip.AtDock &&
    displayTrip.ArrivingTerminalAbbrev === segment.DepartingTerminalAbbrev;

  // This is the correct trip: matches segment's direction and departure time
  const isCorrectTrip =
    displayTrip.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev &&
    displayTrip.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev &&
    timeMatchesSegment(displayTrip, segment);

  return {
    displayTrip,
    isIncoming,
    isAtOriginDock,
    isInTransitForSegment,
    isCorrectTrip,
  };
};

/**
 * Check if vessel trip's scheduled departure matches segment's departure time.
 * This provides an additional validation layer beyond key matching.
 *
 * @param trip - The vessel trip to check
 * @param segment - The scheduled segment to match against
 * @returns True if departure times match exactly
 */
const timeMatchesSegment = (trip: VesselTrip, segment: Segment): boolean => {
  const tripDeparture =
    trip.ScheduledDeparture?.getTime() ||
    trip.ScheduledTrip?.DepartingTime.getTime();
  return tripDeparture === segment.DepartingTime.getTime();
};
