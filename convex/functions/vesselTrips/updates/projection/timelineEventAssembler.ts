/**
 * Assembles `TickEventWrites` from lifecycle facts and per-vessel messages.
 *
 * Owns imports of `domain/timelineRows` projection builders and
 * `actualBoundaryPatchesFromTrip`; lifecycle branches emit DTOs only.
 */

import {
  buildPredictedBoundaryClearEffect,
  buildPredictedBoundaryProjectionEffect,
} from "domain/timelineRows";
import type { ConvexActualBoundaryPatchPersistable } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/eventsPredicted/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import type { TickEventWrites } from "../processTick/tickEventWrites";
import { mergeTickEventWrites } from "../processTick/tickEventWrites";
import {
  buildArrivalActualPatchForTrip,
  buildDepartureActualPatchForTrip,
} from "./actualBoundaryPatchesFromTrip";
import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "./lifecycleEventTypes";

type TaggedActualPatch = {
  vesselAbbrev: string;
  patch: ConvexActualBoundaryPatchPersistable;
  requiresSuccessfulUpsert: boolean;
};

type TaggedPredictedEffect = {
  vesselAbbrev: string;
  effect: ConvexPredictedBoundaryProjectionEffect;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Converts completed-trip facts into merged tick event writes.
 *
 * @param facts - One entry per successful `completeAndStartNewTrip` boundary
 * @returns Patches and effects for timeline mutations
 */
export const buildTickEventWritesFromCompletedFacts = (
  facts: CompletedTripBoundaryFact[]
): TickEventWrites =>
  facts.reduce(
    (acc, fact) =>
      mergeTickEventWrites(acc, tickEventWritesFromCompletedFact(fact)),
    emptyTickEventWrites()
  );

/**
 * Builds tick event writes for the current-trip branch after lifecycle writes.
 *
 * @param successfulVessels - Vessels whose batch upsert succeeded (empty if none ran)
 * @param pendingActualMessages - Per-vessel actual patch messages
 * @param pendingPredictedMessages - Per-vessel predicted-effect messages
 * @returns Patches and effects after upsert-gated filtering
 */
export const buildTickEventWritesFromCurrentMessages = (
  successfulVessels: Set<string>,
  pendingActualMessages: CurrentTripActualEventMessage[],
  pendingPredictedMessages: CurrentTripPredictedEventMessage[]
): TickEventWrites => {
  const taggedActual = pendingActualMessages.flatMap(
    buildTaggedActualPatchesFromMessage
  );
  const taggedPredicted = pendingPredictedMessages.flatMap(
    buildTaggedPredictedEffectsFromMessage
  );

  return {
    actualPatches: filterTaggedActualPatches(taggedActual, successfulVessels),
    predictedEffects: filterTaggedPredictedEffects(
      taggedPredicted,
      successfulVessels
    ),
  };
};

const tickEventWritesFromCompletedFact = (
  fact: CompletedTripBoundaryFact
): TickEventWrites => ({
  actualPatches: [
    buildDepartureActualPatchForTrip(fact.tripToComplete),
    buildArrivalActualPatchForTrip(fact.tripToComplete),
  ].filter(
    (patch): patch is ConvexActualBoundaryPatchPersistable => patch !== null
  ),
  predictedEffects: [
    buildPredictedBoundaryClearEffect(fact.existingTrip),
    buildPredictedBoundaryProjectionEffect(fact.newTrip),
  ].filter((effect): effect is ConvexPredictedBoundaryProjectionEffect =>
    Boolean(effect)
  ),
});

const emptyTickEventWrites = (): TickEventWrites => ({
  actualPatches: [],
  predictedEffects: [],
});

const shouldClearExistingPredictions = (
  existingTrip: ConvexVesselTrip | undefined,
  finalProposed: ConvexVesselTripWithML
): boolean =>
  existingTrip !== undefined &&
  (existingTrip.SailingDay !== finalProposed.SailingDay ||
    existingTrip.ScheduleKey !== finalProposed.ScheduleKey ||
    existingTrip.NextScheduleKey !== finalProposed.NextScheduleKey);

const buildTaggedActualPatchesFromMessage = (
  message: CurrentTripActualEventMessage
): TaggedActualPatch[] => {
  const patches: ConvexActualBoundaryPatchPersistable[] = [];
  const { events, finalProposed, vesselAbbrev, requiresSuccessfulUpsert } =
    message;

  if (events.didJustLeaveDock && finalProposed.LeftDock !== undefined) {
    const departure = buildDepartureActualPatchForTrip(finalProposed);
    if (departure !== null) {
      patches.push(departure);
    }
  }
  if (events.didJustArriveAtDock && finalProposed.ArriveDest !== undefined) {
    const arrival = buildArrivalActualPatchForTrip(finalProposed);
    if (arrival !== null) {
      patches.push(arrival);
    }
  }

  return patches.map((patch) => ({
    vesselAbbrev,
    patch,
    requiresSuccessfulUpsert,
  }));
};

const buildTaggedPredictedEffectsFromMessage = (
  message: CurrentTripPredictedEventMessage
): TaggedPredictedEffect[] => {
  const effects: ConvexPredictedBoundaryProjectionEffect[] = [];
  const {
    existingTrip,
    finalProposed,
    vesselAbbrev,
    requiresSuccessfulUpsert,
  } = message;

  const projection = buildPredictedBoundaryProjectionEffect(finalProposed);
  if (projection !== null) {
    effects.push(projection);
  }

  if (
    existingTrip !== undefined &&
    shouldClearExistingPredictions(existingTrip, finalProposed)
  ) {
    const clear = buildPredictedBoundaryClearEffect(existingTrip);
    if (clear !== null) {
      effects.push(clear);
    }
  }

  return effects.map((effect) => ({
    vesselAbbrev,
    effect,
    requiresSuccessfulUpsert,
  }));
};

const filterTaggedActualPatches = (
  tagged: TaggedActualPatch[],
  successfulVessels: Set<string>
): ConvexActualBoundaryPatchPersistable[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.patch);

const filterTaggedPredictedEffects = (
  tagged: TaggedPredictedEffect[],
  successfulVessels: Set<string>
): ConvexPredictedBoundaryProjectionEffect[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.effect);
