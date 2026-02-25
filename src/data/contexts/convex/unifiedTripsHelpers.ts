/**
 * Helper functions for UnifiedTripsContext and consumers.
 *
 * Provides route expansion (F/V/S triangle) and indirect-trip segment resolution.
 */

import type { ScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";

export type UnifiedTrip = {
  scheduledTrip?: ScheduledTrip;
  activeVesselTrip?: VesselTrip;
  completedVesselTrip?: VesselTrip;
  /** Denormalized for filtering/grouping */
  key: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  scheduledDeparture: Date;
};

export type UnifiedTripRecord = Record<string, UnifiedTrip>;
/** South Sound triangle: when routeAbbrev is this, expand to all three routes. */
export const SOUTH_SOUND_TRIANGLE_ROUTE_GROUP = "f-v-s";

/** The three routes that make up the Fauntleroy/Vashon/Southworth triangle. */
const SOUTH_SOUND_TRIANGLE_ROUTES = ["f-s", "f-v-s", "s-v"] as const;

/**
 * Expand route abbreviation to route list for fetching.
 * When routeAbbrev is the triangle group (f-v-s), returns all three triangle routes.
 * Otherwise returns the single route.
 *
 * @param routeAbbrev - Route abbreviation (e.g. "sea-bi" or "f-v-s" for triangle)
 * @returns Array of route abbreviations to fetch
 */
export const expandRouteAbbrev = (routeAbbrev: string): string[] =>
  routeAbbrev === SOUTH_SOUND_TRIANGLE_ROUTE_GROUP
    ? [...SOUTH_SOUND_TRIANGLE_ROUTES]
    : [routeAbbrev];

/**
 * Resolves an indirect trip A→C into direct segments [A→B, B→C].
 * Walks the NextKey chain from the direct segment (via DirectKey) to the target.
 * Each segment's actuals come from unifiedTrips[segment.Key].
 *
 * @param indirectTrip - Scheduled trip with TripType "indirect" and DirectKey
 * @param byKey - Map of all scheduled trips by Key (for NextKey traversal)
 * @param unifiedTrips - Unified trip record (direct-only) for actuals
 * @returns Array of UnifiedTrip, one per direct segment
 */
export const resolveIndirectToSegments = (
  indirectTrip: ScheduledTrip,
  byKey: Map<string, ScheduledTrip>,
  unifiedTrips: UnifiedTripRecord
): UnifiedTrip[] => {
  if (indirectTrip.TripType !== "indirect" || !indirectTrip.DirectKey) {
    return [];
  }

  const startSegment = byKey.get(indirectTrip.DirectKey);
  if (!startSegment) return [];

  const targetTerminal = indirectTrip.ArrivingTerminalAbbrev;
  const segments: ScheduledTrip[] = [];
  let current: ScheduledTrip | undefined = startSegment;

  while (current && !segments.some((s) => s.Key === current?.Key)) {
    segments.push(current);
    if (current.ArrivingTerminalAbbrev === targetTerminal) break;
    current = current.NextKey ? byKey.get(current.NextKey) : undefined;
  }

  return segments
    .map((seg) => unifiedTrips[seg.Key])
    .filter((u): u is UnifiedTrip => u != null);
};
