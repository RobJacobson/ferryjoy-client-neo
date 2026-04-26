/**
 * Vessel-orchestrator trip persistence: apply one functions-owned translation
 * from the public trips DTOs to Convex mutations.
 *
 * The trips concern owns the public trip-computation contract, including
 * provisional trip fields already inferred from schedule evidence. This module
 * owns only the one-way translation needed to persist those outputs.
 */

import type { MutationCtx } from "_generated/server";
import type {
  ActualDockWriteIntent,
  CompletedArrivalHandoff,
  PredictedDockWriteIntent,
} from "domain/vesselOrchestration/shared";
import {
  stripTripPredictionsForStorage,
} from "domain/vesselOrchestration/shared";
import {
  completeAndStartNewTripInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
  upsertActiveVesselTripInDb,
} from "functions/vesselTrips/mutations";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type VesselTripWrites = {
  completedTripWrite?: CompletedArrivalHandoff;
  activeTripUpsert?: ConvexVesselTrip;
  actualDockWrite?: ActualDockWriteIntent;
  predictedDockWrite?: PredictedDockWriteIntent;
};

/**
 * Persists one tick of trip-table writes from precomputed write rows.
 *
 * @param ctx - Convex mutation context
 * @param tripWrites - Trip write rows and timeline handoff inputs
 */
export const persistVesselTripWrites = async (
  ctx: MutationCtx,
  tripWrites: VesselTripWrites
): Promise<void> => {
  const {
    completedTripWrite,
    activeTripUpsert,
    actualDockWrite,
  } = tripWrites;

  if (completedTripWrite !== undefined) {
    await completeAndStartNewTripInDb(
      ctx,
      stripTripPredictionsForStorage(completedTripWrite.tripToComplete),
      stripTripPredictionsForStorage(completedTripWrite.scheduleTrip)
    );
  }

  if (activeTripUpsert !== undefined) {
    await upsertActiveVesselTripInDb(ctx, activeTripUpsert);
  }

  await runLeaveDockFromWriteSetIntent(ctx, actualDockWrite);
};

/**
 * Runs depart-next actualization for leave-dock intents.
 */
const runLeaveDockFromWriteSetIntent = async (
  ctx: MutationCtx,
  actualDockWrite: ActualDockWriteIntent | undefined
): Promise<void> => {
  if (
    actualDockWrite === undefined ||
    !actualDockWrite.events.didJustLeaveDock ||
    actualDockWrite.scheduleTrip.LeftDockActual === undefined
  ) {
    return;
  }
  await setDepartNextActualsForMostRecentCompletedTripInDb(
    ctx,
    actualDockWrite.vesselAbbrev,
    actualDockWrite.scheduleTrip.LeftDockActual
  );
};
