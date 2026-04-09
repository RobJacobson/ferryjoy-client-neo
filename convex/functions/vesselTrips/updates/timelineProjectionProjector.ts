/**
 * Builds `eventsActual` / `eventsPredicted` overlay payloads from lifecycle
 * facts and intents. Owns imports of `domain/vesselTimeline` projection
 * builders and `actualBoundaryPatchesFromTrip`; branch processors emit DTOs only.
 */

import {
  buildPredictedBoundaryClearEffect,
  buildPredictedBoundaryProjectionEffect,
} from "domain/vesselTimeline/normalizedEvents";
import type { ConvexActualBoundaryPatch } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/eventsPredicted/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  buildArrivalActualPatchForTrip,
  buildDepartureActualPatchForTrip,
} from "./actualBoundaryPatchesFromTrip";
import type { ProjectionBatch } from "./contracts";
import { mergeProjectionBatches } from "./contracts";
import type {
  CompletedTripProjectionFact,
  CurrentTripActualProjectionIntent,
  CurrentTripPredictedProjectionIntent,
} from "./projectionContracts";

type TaggedActualPatch = {
  vesselAbbrev: string;
  patch: ConvexActualBoundaryPatch;
  requiresSuccessfulUpsert: boolean;
};

type TaggedPredictedEffect = {
  vesselAbbrev: string;
  effect: ConvexPredictedBoundaryProjectionEffect;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Converts completed-trip facts into one merged projection batch.
 *
 * @param facts - One entry per successful `completeAndStartNewTrip` boundary
 * @returns Patches and effects for timeline projection mutations
 */
export const buildProjectionBatchFromCompletedFacts = (
  facts: CompletedTripProjectionFact[]
): ProjectionBatch =>
  facts.reduce(
    (acc, fact) =>
      mergeProjectionBatches(acc, projectionBatchFromCompletedTripFact(fact)),
    emptyProjectionBatch()
  );

/**
 * Builds overlay payloads for the current-trip branch after lifecycle writes.
 *
 * @param successfulVessels - Vessels whose batch upsert succeeded (empty if none ran)
 * @param pendingActualIntents - Per-vessel actual patch intents
 * @param pendingPredictedIntents - Per-vessel predicted effect intents
 * @returns Patches and effects after upsert-gated filtering
 */
export const buildProjectionBatchFromCurrentIntents = (
  successfulVessels: Set<string>,
  pendingActualIntents: CurrentTripActualProjectionIntent[],
  pendingPredictedIntents: CurrentTripPredictedProjectionIntent[]
): ProjectionBatch => {
  const taggedActual = pendingActualIntents.flatMap(
    buildTaggedActualPatchesFromIntent
  );
  const taggedPredicted = pendingPredictedIntents.flatMap(
    buildTaggedPredictedEffectsFromIntent
  );

  return {
    actualPatches: filterTaggedActualPatches(taggedActual, successfulVessels),
    predictedEffects: filterTaggedPredictedEffects(
      taggedPredicted,
      successfulVessels
    ),
  };
};

/**
 * Builds one completed-boundary overlay batch (departure + arrival actuals;
 * clear + project predicted).
 *
 * @param fact - Trips involved in one completed boundary transition
 * @returns Single-vessel projection batch
 */
const projectionBatchFromCompletedTripFact = (
  fact: CompletedTripProjectionFact
): ProjectionBatch => ({
  actualPatches: [
    buildDepartureActualPatchForTrip(fact.tripToComplete),
    buildArrivalActualPatchForTrip(fact.tripToComplete),
  ].filter((patch): patch is ConvexActualBoundaryPatch => Boolean(patch)),
  predictedEffects: [
    buildPredictedBoundaryClearEffect(fact.existingTrip),
    buildPredictedBoundaryProjectionEffect(fact.newTrip),
  ].filter((effect): effect is ConvexPredictedBoundaryProjectionEffect =>
    Boolean(effect)
  ),
});

/**
 * Empty reducer seed for folding multiple completed-trip facts.
 *
 * @returns Empty projection batch
 */
const emptyProjectionBatch = (): ProjectionBatch => ({
  actualPatches: [],
  predictedEffects: [],
});

/**
 * Detects when the prior trip no longer owns the prediction overlay scope.
 *
 * @param existingTrip - Previously persisted active trip, if any
 * @param finalProposed - Newly built trip state for this tick
 * @returns True when sailing day, segment key, or next-leg key changed
 */
const shouldClearExistingPredictions = (
  existingTrip: ConvexVesselTrip | undefined,
  finalProposed: ConvexVesselTripWithML
): boolean =>
  existingTrip !== undefined &&
  (existingTrip.SailingDay !== finalProposed.SailingDay ||
    existingTrip.Key !== finalProposed.Key ||
    existingTrip.NextKey !== finalProposed.NextKey);

/**
 * Expands one actual intent into zero or more sparse boundary patches.
 *
 * @param intent - Raw actual-patch inputs for one vessel refresh
 * @returns Zero or more tagged patches (departure and/or arrival)
 */
const buildTaggedActualPatchesFromIntent = (
  intent: CurrentTripActualProjectionIntent
): TaggedActualPatch[] => {
  const patches: ConvexActualBoundaryPatch[] = [];
  const { events, finalProposed, vesselAbbrev, requiresSuccessfulUpsert } =
    intent;

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

/**
 * Expands one predicted intent into project and optional clear effects.
 *
 * @param intent - Raw predicted-effect inputs for one vessel refresh
 * @returns Zero or more tagged effects (project + optional clear)
 */
const buildTaggedPredictedEffectsFromIntent = (
  intent: CurrentTripPredictedProjectionIntent
): TaggedPredictedEffect[] => {
  const effects: ConvexPredictedBoundaryProjectionEffect[] = [];
  const {
    existingTrip,
    finalProposed,
    vesselAbbrev,
    requiresSuccessfulUpsert,
  } = intent;

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

/**
 * @param tagged - Patches gathered from intents
 * @param successfulVessels - Vessels with successful active upserts this tick
 * @returns Patches that pass the upsert gate
 */
const filterTaggedActualPatches = (
  tagged: TaggedActualPatch[],
  successfulVessels: Set<string>
): ConvexActualBoundaryPatch[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.patch);

/**
 * @param tagged - Effects gathered from intents
 * @param successfulVessels - Vessels with successful active upserts this tick
 * @returns Effects that pass the upsert gate
 */
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
