/**
 * **updateVesselLocations** (domain): shapes the location snapshot batch for the
 * orchestrator `bulkUpsert` mutation.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * Builds the argument object for `functions.vesselLocation.mutations.bulkUpsert`.
 * Copies the tick batch to a new array so the mutation receives a plain mutable
 * payload for Convex validation.
 *
 * @param locations - Read-only snapshot from one WSF fetch / adapter pass
 * @returns Args object for `bulkUpsert`
 */
export const bulkUpsertArgsFromConvexLocations = (
  locations: ReadonlyArray<ConvexVesselLocation>
): { locations: ConvexVesselLocation[] } => ({
  locations: [...locations],
});
