/**
 * Orchestrator ingestion for live vessel positions: converts the upstream WSF
 * feed into canonical {@link ConvexVesselLocation} rows with a stable observed
 * dock phase, persists them with mutation-side dedupe, and returns only rows that
 * actually changed so downstream stages do not rerun on noise.
 */

import type { ActionCtx } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import { updateVesselLocations as normalizeVesselLocations } from "domain/vesselOrchestration/updateVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { persistVesselLocationBatch } from "./persistVesselLocations";

type RunStage1UpdateVesselLocationsArgs = {
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Ingest one vessel-location snapshot for an orchestrator ping.
 *
 * This ties together external data, normalization, and a bulk mutation that does
 * one live-table read, attaches `AtDockObserved`, and writes with dedupe-backed
 * change detection. Trip and downstream stages rely on durable
 * location writes and timestamps; this step is where raw feed jitter is filtered
 * before any trip logic runs.
 *
 * Flow (each line is one logical step):
 *
 * 1. **Fetch raw WSF payloads** via `fetchRawWsfVesselLocations` — pull the latest
 *    fleet snapshot from the adapter (network / external API boundary lives here).
 * 2. **Normalize to Convex rows** via domain `updateVesselLocations` — map feed
 *    shapes + identity tables into validated `ConvexVesselLocationIncoming` rows.
 * 3. **Persist via `bulkUpsertVesselLocations`** — single `collect()` on the live
 *    table, `withAtDockObserved`, then replace or insert where `TimeStamp` changed;
 *    skip unchanged vessels.
 * 4. **Return changed rows only** — same rows the mutation wrote, so the orchestrator
 *    loop runs trip/prediction/timeline only for vessels with new evidence.
 *
 * @param ctx - Convex action context used for mutation calls
 * @param args - Identity rows required for raw-feed normalization
 * @returns Rows that were inserted or replaced after mutation-side timestamp dedupe
 */
export const runUpdateVesselLocations = async (
  ctx: ActionCtx,
  { terminalsIdentity, vesselsIdentity }: RunStage1UpdateVesselLocationsArgs
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  // 1) Fetch raw WSF vessel-location rows from the external adapter.
  const rawFeedLocations = await fetchRawWsfVesselLocations();

  // 2) Normalize feed rows + identity tables into canonical location rows.
  const { vesselLocations: normalizedLocations } = normalizeVesselLocations({
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });

  // 3) Persist with one mutation read + AtDockObserved + timestamp dedupe.
  const changedLocations = await persistVesselLocationBatch(
    ctx,
    normalizedLocations
  );

  // 4) Return only inserted/replaced rows for downstream orchestrator stages.
  return changedLocations;
};
