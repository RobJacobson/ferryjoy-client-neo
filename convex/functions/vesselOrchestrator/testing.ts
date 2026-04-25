/**
 * Focused vessel-orchestrator test helpers.
 *
 * This keeps test helpers out of the production orchestrator action
 * so the hot-path file stays centered on real runtime concerns.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { loadVesselLocationUpdates } from "./locationUpdates";

/**
 * Focused helper for location tests.
 *
 * @param ctx - Action context for snapshot and persistence calls
 * @param pingStartedAt - Orchestrator-owned ping anchor
 * @param vesselsIdentity - Backend vessel rows for feed resolution
 * @param terminalsIdentity - Backend terminal rows for normalization
 * @returns Normalized current vessel-location rows
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const locationUpdates = await loadVesselLocationUpdates({
    pingStartedAt,
    terminalsIdentity,
    vesselsIdentity,
  });

  await ctx.runMutation(
    api.functions.vesselLocation.mutations.bulkUpsertVesselLocations,
    {
      locations: locationUpdates.map((update) => update.vesselLocation),
    }
  );

  return locationUpdates.map((update) => update.vesselLocation);
};
