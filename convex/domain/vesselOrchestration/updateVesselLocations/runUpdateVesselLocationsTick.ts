/**
 * **updateVesselLocations** tick entry: maps one WSF batch to `bulkUpsert` args
 * and invokes injected persistence (Convex mutation in production).
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * Persists one tick’s vessel location snapshot via the injected bulk upsert.
 *
 * @param locations - Converted locations from the adapter for this tick
 * @param persistBulkUpsert - Effect that runs `vesselLocation.mutations.bulkUpsert`
 * @returns `undefined` after persistence settles
 */
export const runUpdateVesselLocationsTick = async (
  locations: ReadonlyArray<ConvexVesselLocation>,
  persistBulkUpsert: (args: {
    locations: ConvexVesselLocation[];
  }) => Promise<undefined | null>
): Promise<void> => {
  await persistBulkUpsert({
    locations: locations as ConvexVesselLocation[],
  });
};
