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

const EXISTING_LOCATION_CACHE_MAX_AGE_MS = 30_000;

/**
 * In-memory cache snapshot for existing live vessel locations.
 *
 * This cache is best-effort and runtime-local. It is used only to reduce
 * repeated DB reads for `AtDockObserved` continuity between nearby ticks.
 */
type ExistingLocationCache = {
  cachedAtMs: number;
  rowsByVesselAbbrev: Map<string, ConvexVesselLocation>;
};

let existingLocationCache: ExistingLocationCache | null = null;

type UpdateVesselLocationsArgs = {
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Returns cached existing vessel locations when the cache is still fresh.
 *
 * @returns Cached location rows, or `null` when cache is empty/stale
 */
const readExistingLocationsFromCache = (): ReadonlyArray<ConvexVesselLocation> | null => {
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
 * The merge keeps prior rows for vessels not present in this tick while
 * replacing rows for vessels included in the current augmented batch.
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

  // Reuse short-lived in-memory snapshot when available; otherwise read from DB.
  const cachedExistingLocations = readExistingLocationsFromCache();
  const existingLocations =
    cachedExistingLocations ??
    (await ctx.runQuery(
      internal.functions.vesselLocation.queries.getCurrentVesselLocations
    ));

  // Apply AtDockObserved heuristic using prior persisted vessel state.
  const augmentedLocations = withAtDockObserved(
    existingLocations,
    normalizedLocations
  );

  // Persist batch with mutation-side dedupe and return changed rows only.
  const changedLocations = await persistVesselLocationBatch(ctx, augmentedLocations);

  // Keep cache aligned with the rows we just attempted to persist for next tick continuity.
  updateExistingLocationCache(existingLocations, augmentedLocations);

  return changedLocations;
};
