/**
 * Single-stage vessel-location update pipeline for orchestrator pings.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import {
  updateVesselLocations as normalizeVesselLocations,
  withAtDockObserved,
} from "domain/vesselOrchestration/updateVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { persistVesselLocationBatch } from "./persistVesselLocations";

type UpdateVesselLocationsArgs = {
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Fetches, normalizes, augments, and persists vessel-location rows for one ping.
 *
 * This stage is the action-layer boundary between external WSF transport data
 * and durable Convex location state. It intentionally composes domain mapping
 * with persistence-side context so AtDockObserved can use prior stored values
 * while keeping downstream trip/prediction stages focused on changed rows only.
 *
 * @param ctx - Convex action context used for query and mutation calls
 * @param args - Identity rows required for raw-feed normalization
 * @returns Changed persisted location rows after dedupe
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  { terminalsIdentity, vesselsIdentity }: UpdateVesselLocationsArgs
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  // Fetch one raw WSF location snapshot for this orchestrator ping.
  const rawFeedLocations = await fetchRawWsfVesselLocations();

  // Normalize raw feed rows into canonical incoming location rows.
  const { vesselLocations: normalizedLocations } = normalizeVesselLocations({
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });

  // Load current persisted live locations for observed-state continuity.
  const existingLocations = await ctx.runQuery(
    internal.functions.vesselOrchestrator.query.queries
      .getCurrentVesselLocationsForIngest
  );

  // Apply AtDockObserved heuristic using prior persisted vessel state.
  const augmentedLocations = withAtDockObserved(
    existingLocations,
    normalizedLocations
  );

  // Persist batch with mutation-side dedupe and return changed rows only.
  return persistVesselLocationBatch(ctx, augmentedLocations);
};
