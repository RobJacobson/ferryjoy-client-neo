import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { v } from "convex/values";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { toConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { Vessel } from "functions/vessels/schemas";
import { processVesselTrips } from "functions/vesselTrips/updates";
import { fetchWsfVesselLocations } from "shared/fetchWsfVesselLocations";
import { fetchVesselBasics } from "ws-dottie/wsf-vessels/core";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";

type RefreshVesselsResult = {
  success: boolean;
  fetched: number;
  inserted: number;
  replaced: number;
  deleted: number;
  updatedAt?: number;
  error?: string;
};

/**
 * Orchestrator action that fetches vessel locations once and delegates to both
 * updateVesselLocations and processVesselTrips subroutines with robust error isolation.
 *
 * This action eliminates duplicate API calls by fetching vessel locations once,
 * then passing the same converted data to both processing functions. Failures
 * in one function do not prevent the other from executing.
 *
 * Flow:
 * 1. Fetch vessel locations via fetchVesselLocations()
 * 2. Load the canonical vessel snapshot once for this tick
 * 3. Convert each WSF payload to `ConvexVesselLocation`
 * 4. Capture one tick timestamp for downstream consumers
 * 5. Call updateVesselLocations() with error isolation
 * 6. Call processVesselTrips() with error isolation
 *
 * @param ctx - Convex action context
 * @returns Result object indicating success/failure of each subroutine
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    locationsSuccess: boolean;
    tripsSuccess: boolean;
    errors?: {
      fetch?: { message: string; stack?: string };
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
    };
  }> => {
    // Track errors from each processing branch
    const errors: {
      fetch?: { message: string; stack?: string };
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
    } = {};

    // Step 1: Fetch and convert vessel locations
    let convexLocations: ConvexVesselLocation[] = [];

    try {
      const vessels = await loadVesselsForTick(ctx);
      const rawLocations =
        (await fetchWsfVesselLocations()) as unknown as DottieVesselLocation[];

      convexLocations = rawLocations.flatMap((rawLocation) => {
        try {
          return [toConvexVesselLocation(rawLocation, vessels)];
        } catch (error) {
          const err = normalizeError(error);
          console.error("Skipping vessel location due to unresolved vessel:", {
            VesselID: rawLocation.VesselID,
            VesselName: rawLocation.VesselName,
            error: err.message,
          });

          return [];
        }
      });
    } catch (error) {
      const err = normalizeError(error);
      errors.fetch = { message: err.message, stack: err.stack };
      console.error("Failed to fetch or process vessel locations:", err);

      return {
        locationsSuccess: false,
        tripsSuccess: false,
        errors,
      };
    }

    const tickStartedAt = Date.now();

    const branchResults: [
      PromiseSettledResult<void>,
      PromiseSettledResult<void>,
    ] = await Promise.allSettled([
      updateVesselLocations(ctx, convexLocations),
      processVesselTrips(ctx, convexLocations, tickStartedAt),
    ]);

    const [locationsResult, tripsResult] = branchResults;

    if (locationsResult.status === "rejected") {
      const err = normalizeError(locationsResult.reason);
      errors.locations = { message: err.message, stack: err.stack };
      console.error("updateVesselLocations failed:", err);
    }

    if (tripsResult.status === "rejected") {
      const err = normalizeError(tripsResult.reason);
      errors.trips = { message: err.message, stack: err.stack };
      console.error("processVesselTrips failed:", err);
    }

    return {
      locationsSuccess: locationsResult.status === "fulfilled",
      tripsSuccess: tripsResult.status === "fulfilled",
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    };
  },
});

/**
 * Refresh the canonical vessel table from WSF basics and persist the snapshot.
 *
 * Failures are reported without mutating the existing table so prior data
 * remains available to the rest of the system.
 *
 * @param ctx - Convex internal action context
 * @returns Summary of the refresh attempt
 */
export const refreshCanonicalVessels = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    fetched: v.number(),
    inserted: v.number(),
    replaced: v.number(),
    deleted: v.number(),
    updatedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<RefreshVesselsResult> => {
    try {
      return await refreshVesselsOrThrow(ctx);
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      console.error("refreshCanonicalVessels failed:", normalized);

      return {
        success: false,
        fetched: 0,
        inserted: 0,
        replaced: 0,
        deleted: 0,
        error: normalized.message,
      };
    }
  },
});

/**
 * Subroutine function for updating vessel locations in the database.
 *
 * Stores vessel locations to the database using bulk upsert mutation.
 * This is called as a subroutine within the orchestrator action.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to store
 */
async function updateVesselLocations(
  ctx: ActionCtx,
  locations: ConvexVesselLocation[]
): Promise<void> {
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations,
  });
}

/**
 * Load the canonical vessel snapshot for one orchestrator tick.
 *
 * If the table is empty, bootstrap it immediately from WSF basics so the hot
 * path can continue without waiting for the hourly refresh cron.
 *
 * @param ctx - Convex action context for database operations
 * @returns Canonical vessels for this tick
 */
async function loadVesselsForTick(ctx: ActionCtx): Promise<Array<Vessel>> {
  let vessels: Array<Vessel> = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllCanonicalVesselsInternal
  );

  if (vessels.length > 0) {
    return vessels;
  }

  await refreshVesselsOrThrow(ctx);

  vessels = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllCanonicalVesselsInternal
  );

  if (vessels.length === 0) {
    throw new Error(
      "Canonical vessels table is still empty after bootstrap refresh."
    );
  }

  return vessels;
}

/**
 * Fetch and normalize the latest canonical vessel snapshot from WSF basics.
 *
 * @param ctx - Convex internal action context
 * @returns Persisted refresh summary
 */
async function refreshVesselsOrThrow(
  ctx: ActionCtx
): Promise<RefreshVesselsResult> {
  const fetchedVessels = await fetchVesselBasics();
  const updatedAt = Date.now();
  const vessels: Array<Vessel> = fetchedVessels
    .filter(
      (vessel): vessel is typeof vessel & {
        VesselName: string;
        VesselAbbrev: string;
      } => Boolean(vessel.VesselName && vessel.VesselAbbrev)
    )
    .map((vessel) => ({
      VesselID: vessel.VesselID,
      VesselName: vessel.VesselName,
      VesselAbbrev: vessel.VesselAbbrev,
      UpdatedAt: updatedAt,
    }));

  const mutationResult: {
    inserted: number;
    replaced: number;
    deleted: number;
  } = await ctx.runMutation(
    internal.functions.vesselLocation.mutations.replaceCanonicalVessels,
    {
      vessels,
    }
  );

  return {
    success: true,
    fetched: vessels.length,
    inserted: mutationResult.inserted,
    replaced: mutationResult.replaced,
    deleted: mutationResult.deleted,
    updatedAt,
  };
}

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(safeSerialize(error));
};

const safeSerialize = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
