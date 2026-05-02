/**
 * Orchestrator ingestion for live vessel positions.
 *
 * Converts the WSF feed into canonical location rows, persists them with
 * mutation-side dedupe, and returns changed rows plus active trips for those
 * vessels from the same mutation.
 */

import type { ActionCtx } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import { updateVesselLocations as normalizeVesselLocations } from "domain/vesselOrchestration/updateVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { persistVesselLocationBatch } from "./persist";

type RunStage1UpdateVesselLocationsArgs = {
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

export type RunUpdateVesselLocationsResult = {
  changedLocations: ReadonlyArray<ConvexVesselLocation>;
  activeTripsByVesselAbbrev: Map<string, ConvexVesselTrip>;
};

/**
 * Ingests one vessel-location snapshot for an orchestrator ping.
 *
 * Fetches raw WSF rows, normalizes with identity tables, then delegates to
 * `persistVesselLocationBatch` so dedupe and post-write active-trip reads stay
 * inside `bulkUpsertVesselLocations`. Downstream trip work should use only
 * `changedLocations` and the returned map, not the full normalized batch.
 *
 * @param ctx - Convex action context used for mutation calls
 * @param args - Identity rows required for raw-feed normalization
 * @returns Changed locations and active-trip map keyed by `VesselAbbrev`
 *   (post-write)
 */
export const runUpdateVesselLocations = async (
  ctx: ActionCtx,
  { terminalsIdentity, vesselsIdentity }: RunStage1UpdateVesselLocationsArgs
): Promise<RunUpdateVesselLocationsResult> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const { vesselLocations: normalizedLocations } = normalizeVesselLocations({
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });
  const { changedLocations, activeTripsForChanged } =
    await persistVesselLocationBatch(ctx, normalizedLocations);
  const activeTripsByVesselAbbrev = new Map(
    activeTripsForChanged.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  return { changedLocations, activeTripsByVesselAbbrev };
};
