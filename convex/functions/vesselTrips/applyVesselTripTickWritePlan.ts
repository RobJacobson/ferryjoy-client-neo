/**
 * Functions-layer applier for `VesselTripTickWritePlan`: runs trip lifecycle
 * Convex mutations in tick order and returns branch results for timeline assembly.
 *
 * Strips ML prediction fields for storage **here** only (parity with pre-refactor
 * call sites).
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type {
  CompletedTripBoundaryFact,
  CurrentTripLifecycleBranchResult,
} from "domain/vesselOrchestration/updateTimeline/types";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/updateVesselPredictions/stripTripPredictionsForStorage";
import type {
  PendingLeaveDockEffect,
  VesselTripTickWritePlan,
} from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripTickWritePlan";

type UpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
};

/** Outcome of applying a tick write plan: facts and current branch for timeline. */
export type ApplyVesselTripTickWritePlanResult = {
  completedFacts: CompletedTripBoundaryFact[];
  currentBranch: CurrentTripLifecycleBranchResult;
};

/**
 * Runs completed handoffs (`Promise.allSettled`), optional batch upsert, then
 * leave-dock mutations for vessels that upserted successfully.
 *
 * @param ctx - Convex action context
 * @param plan - Domain-built write plan for this tick
 * @returns Persist-derived facts and current branch (including `successfulVessels`)
 */
export const applyVesselTripTickWritePlan = async (
  ctx: ActionCtx,
  plan: VesselTripTickWritePlan
): Promise<ApplyVesselTripTickWritePlanResult> => {
  const completedFacts = await applyCompletedHandoffs(ctx, plan);

  const { current } = plan;
  const successfulVessels =
    current.activeUpserts.length > 0
      ? getSuccessfulVessels(
          await ctx.runMutation(
            api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
            {
              activeUpserts: current.activeUpserts.map(
                stripTripPredictionsForStorage
              ),
            }
          )
        )
      : new Set<string>();

  await runLeaveDockPostPersistEffects(
    ctx,
    successfulVessels,
    current.pendingLeaveDockEffects
  );

  return {
    completedFacts,
    currentBranch: {
      successfulVessels,
      pendingActualMessages: current.pendingActualMessages,
      pendingPredictedMessages: current.pendingPredictedMessages,
    },
  };
};

/**
 * Applies `completeAndStartNewTrip` for each planned handoff; collects boundary
 * facts for mutations that succeed.
 *
 * @param ctx - Convex action context
 * @param plan - Tick write plan
 * @returns Boundary facts in handoff input order for successful mutations only
 */
const applyCompletedHandoffs = async (
  ctx: ActionCtx,
  plan: VesselTripTickWritePlan
): Promise<CompletedTripBoundaryFact[]> => {
  const settled = await Promise.allSettled(
    plan.completedHandoffs.map((fact) =>
      ctx.runMutation(
        api.functions.vesselTrips.mutations.completeAndStartNewTrip,
        {
          completedTrip: stripTripPredictionsForStorage(fact.tripToComplete),
          newTrip: stripTripPredictionsForStorage(fact.newTrip),
        }
      )
    )
  );

  const completedFacts: CompletedTripBoundaryFact[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const fact = plan.completedHandoffs[i];
    if (result === undefined || fact === undefined) {
      continue;
    }
    if (result.status === "fulfilled") {
      completedFacts.push(fact);
      continue;
    }
    const vesselAbbrev = fact.tripToComplete.VesselAbbrev;
    const err =
      result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));
    // Same format as `logVesselProcessingError` in `processVesselTripsWithDeps`
    // (phase matches completed-branch build failures for ops consistency).
    const phase = "completed-trip processing";
    console.error(
      `[VesselTrips] Failed ${phase} for ${vesselAbbrev}: ${err.message}`,
      err
    );
  }
  return completedFacts;
};

/**
 * Builds the set of vessels whose batch upsert row succeeded.
 *
 * @param upsertResult - Per-vessel batch upsert result from the mutation
 * @returns Set of vessel abbreviations with successful upserts
 */
const getSuccessfulVessels = (upsertResult: UpsertBatchResult): Set<string> =>
  new Set(
    upsertResult.perVessel
      .filter((result) => {
        if (result.ok) {
          return true;
        }

        console.error(
          `[VesselTrips] Failed active-trip upsert for ${result.vesselAbbrev}: ${
            result.reason ?? "unknown error"
          }`
        );
        return false;
      })
      .map((result) => result.vesselAbbrev)
  );

/**
 * Backfills depart-next prediction actuals after a successful active-trip upsert.
 *
 * @param ctx - Convex action context
 * @param successfulVessels - Set of vessels with successful upserts
 * @param pendingLeaveDockEffects - Leave-dock effects from the write plan
 * @returns Promise that settles when all leave-dock attempts finish
 */
const runLeaveDockPostPersistEffects = async (
  ctx: ActionCtx,
  successfulVessels: Set<string>,
  pendingLeaveDockEffects: PendingLeaveDockEffect[]
): Promise<void> => {
  await Promise.allSettled(
    pendingLeaveDockEffects
      .filter((effect) => successfulVessels.has(effect.vesselAbbrev))
      .map(async (effect) => {
        try {
          const leftDockMs = effect.trip.LeftDockActual ?? effect.trip.LeftDock;
          if (leftDockMs === undefined) {
            return;
          }

          await ctx.runMutation(
            api.functions.vesselTrips.mutations
              .setDepartNextActualsForMostRecentCompletedTrip,
            {
              vesselAbbrev: effect.vesselAbbrev,
              actualDepartMs: leftDockMs,
            }
          );
        } catch (error) {
          console.error("[VesselTrips] leave-dock post-persist failed", {
            vesselAbbrev: effect.vesselAbbrev,
            trip: effect.trip,
            error,
          });
        }
      })
  );
};
