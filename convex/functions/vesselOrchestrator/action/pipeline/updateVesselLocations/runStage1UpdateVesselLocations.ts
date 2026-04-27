/**
 * Stage #1: fetch, normalize, and persist vessel locations.
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

const EXISTING_LOCATION_CACHE_MAX_AGE_MS = 30_000;

type ExistingLocationCache = {
  cachedAtMs: number;
  rowsByVesselAbbrev: Map<string, ConvexVesselLocation>;
};

let existingLocationCache: ExistingLocationCache | null = null;

type RunStage1UpdateVesselLocationsArgs = {
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Returns cached existing vessel locations when the cache is still fresh.
 *
 * @returns Cached location rows, or `null` when cache is empty/stale
 */
const readExistingLocationsFromCache =
  (): ReadonlyArray<ConvexVesselLocation> | null => {
    if (
      existingLocationCache === null ||
      Date.now() - existingLocationCache.cachedAtMs >
        EXISTING_LOCATION_CACHE_MAX_AGE_MS
    ) {
      return null;
    }
    return [...existingLocationCache.rowsByVesselAbbrev.values()];
  };

/**
 * Rebuilds cache state after one ingest write pass.
 *
 * @param existingRows - Previously known live location rows
 * @param nextRows - Current tick augmented location rows
 */
const updateExistingLocationCache = (
  existingRows: ReadonlyArray<ConvexVesselLocation>,
  nextRows: ReadonlyArray<ConvexVesselLocation>
): void => {
  const rowsByVesselAbbrev = new Map(
    existingRows.map((row) => [row.VesselAbbrev, row] as const)
  );
  for (const row of nextRows) {
    rowsByVesselAbbrev.set(row.VesselAbbrev, row);
  }
  existingLocationCache = {
    cachedAtMs: Date.now(),
    rowsByVesselAbbrev,
  };
};

/**
 * Runs stage #1 for one orchestrator ping.
 *
 * @param ctx - Convex action context used for query and mutation calls
 * @param args - Identity rows required for raw-feed normalization
 * @returns Changed persisted location rows after dedupe
 */
export const runStage1UpdateVesselLocations = async (
  ctx: ActionCtx,
  { terminalsIdentity, vesselsIdentity }: RunStage1UpdateVesselLocationsArgs
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const { vesselLocations: normalizedLocations } = normalizeVesselLocations({
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });

  const cachedExistingLocations = readExistingLocationsFromCache();
  const existingLocations =
    cachedExistingLocations ??
    (await ctx.runQuery(
      internal.functions.vesselLocation.queries.getCurrentVesselLocations
    ));

  const augmentedLocations = withAtDockObserved(
    existingLocations,
    normalizedLocations
  );
  const changedLocations = await persistVesselLocationBatch(
    ctx,
    augmentedLocations
  );
  updateExistingLocationCache(existingLocations, augmentedLocations);
  return changedLocations;
};
