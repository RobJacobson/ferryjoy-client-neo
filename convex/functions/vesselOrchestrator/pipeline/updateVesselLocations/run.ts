/**
 * Orchestrator ingestion for live vessel positions: converts the upstream WSF
 * feed into canonical location rows, persists them with mutation-side dedupe,
 * and returns only rows that actually changed.
 */

import type { ActionCtx } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import { updateVesselLocations as normalizeVesselLocations } from "domain/vesselOrchestration/updateVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { persistVesselLocationBatch } from "./persist";

type RunStage1UpdateVesselLocationsArgs = {
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Ingest one vessel-location snapshot for an orchestrator ping.
 *
 * @param ctx - Convex action context used for mutation calls
 * @param args - Identity rows required for raw-feed normalization
 * @returns Rows that were inserted or replaced after mutation-side timestamp dedupe
 */
export const runUpdateVesselLocations = async (
  ctx: ActionCtx,
  { terminalsIdentity, vesselsIdentity }: RunStage1UpdateVesselLocationsArgs
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const { vesselLocations: normalizedLocations } = normalizeVesselLocations({
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });
  const changedLocations = await persistVesselLocationBatch(
    ctx,
    normalizedLocations
  );
  return changedLocations;
};
