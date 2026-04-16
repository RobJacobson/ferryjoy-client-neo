/**
 * Assembles `TickEventWrites` from lifecycle facts and per-vessel messages.
 *
 * Owns imports of `domain/timelineRows` projection builders and
 * `actualDockWritesFromTrip`; lifecycle branches emit DTOs only.
 */

import {
  buildPredictedDockClearBatch,
  buildPredictedDockWriteBatch,
} from "domain/timelineRows";
import type { ConvexActualDockWritePersistable } from "functions/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/eventsPredicted/schemas";
import type {
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import type { TickEventWrites } from "../processTick/tickEventWrites";
import { mergeTickEventWrites } from "../processTick/tickEventWrites";
import {
  buildArrivalActualDockWriteForTrip,
  buildDepartureActualDockWriteForTrip,
} from "./actualDockWritesFromTrip";
import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "./types";

type TaggedActualDockWrite = {
  vesselAbbrev: string;
  write: ConvexActualDockWritePersistable;
  requiresSuccessfulUpsert: boolean;
};

type TaggedPredictedDockBatch = {
  vesselAbbrev: string;
  batch: ConvexPredictedDockWriteBatch;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Converts completed-trip facts into merged tick event writes.
 *
 * @param facts - One entry per successful `completeAndStartNewTrip` boundary
 * @returns Actual and predicted dock writes for timeline mutations
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
 * @param pendingActualMessages - Per-vessel actual write messages
 * @param pendingPredictedMessages - Per-vessel predicted-batch messages
 * @returns Dock writes after upsert-gated filtering
 */
export const buildTickEventWritesFromCurrentMessages = (
  successfulVessels: Set<string>,
  pendingActualMessages: CurrentTripActualEventMessage[],
  pendingPredictedMessages: CurrentTripPredictedEventMessage[]
): TickEventWrites => {
  const taggedActual = pendingActualMessages.flatMap(
    buildTaggedActualDockWritesFromMessage
  );
  const taggedPredicted = pendingPredictedMessages.flatMap(
    buildTaggedPredictedBatchesFromMessage
  );

  return {
    actualDockWrites: filterTaggedActualDockWrites(
      taggedActual,
      successfulVessels
    ),
    predictedDockWriteBatches: filterTaggedPredictedDockBatches(
      taggedPredicted,
      successfulVessels
    ),
  };
};

/**
 * Converts one completed-trip fact into actual and predicted timeline writes.
 *
 * @param fact - Completed-trip boundary fact from lifecycle processing
 * @returns Event-write payload for the completed trip
 */
const tickEventWritesFromCompletedFact = (
  fact: CompletedTripBoundaryFact
): TickEventWrites => ({
  actualDockWrites: [
    buildDepartureActualDockWriteForTrip(fact.tripToComplete),
    buildArrivalActualDockWriteForTrip(fact.tripToComplete),
  ].filter(
    (write): write is ConvexActualDockWritePersistable => write !== null
  ),
  predictedDockWriteBatches: [
    buildPredictedDockClearBatch(fact.existingTrip),
    buildPredictedDockWriteBatch(fact.newTrip),
  ].filter((batch): batch is ConvexPredictedDockWriteBatch => Boolean(batch)),
});

/**
 * Creates an empty tick-event accumulator.
 *
 * @returns Tick-event writes with no actual or predicted payloads
 */
const emptyTickEventWrites = (): TickEventWrites => ({
  actualDockWrites: [],
  predictedDockWriteBatches: [],
});

/**
 * Determines whether an old trip's predicted overlays should be cleared before
 * projecting the new proposal.
 *
 * @param existingTrip - Previously persisted trip, when one exists
 * @param finalProposed - Newly built trip proposal for the current tick
 * @returns `true` when the proposal changes sailing-day or schedule identity
 */
const shouldClearExistingPredictions = (
  existingTrip: ConvexVesselTripWithPredictions | undefined,
  finalProposed: ConvexVesselTripWithML
): boolean =>
  existingTrip !== undefined &&
  (existingTrip.SailingDay !== finalProposed.SailingDay ||
    existingTrip.ScheduleKey !== finalProposed.ScheduleKey ||
    existingTrip.NextScheduleKey !== finalProposed.NextScheduleKey);

/**
 * Builds actual dock writes for one current-trip message.
 *
 * @param message - Actual-message payload emitted by the lifecycle branch
 * @returns Vessel-tagged writes gated by upsert success rules
 */
const buildTaggedActualDockWritesFromMessage = (
  message: CurrentTripActualEventMessage
): TaggedActualDockWrite[] => {
  const writes: ConvexActualDockWritePersistable[] = [];
  const { events, finalProposed, vesselAbbrev, requiresSuccessfulUpsert } =
    message;

  if (events.didJustLeaveDock && finalProposed.LeftDockActual !== undefined) {
    const departure = buildDepartureActualDockWriteForTrip(finalProposed);
    if (departure !== null) {
      writes.push(departure);
    }
  }
  if (
    events.didJustArriveAtDock &&
    finalProposed.ArrivedNextActual !== undefined
  ) {
    const arrival = buildArrivalActualDockWriteForTrip(finalProposed);
    if (arrival !== null) {
      writes.push(arrival);
    }
  }

  return writes.map((write) => ({
    vesselAbbrev,
    write,
    requiresSuccessfulUpsert,
  }));
};

/**
 * Builds predicted dock write batches for one current-trip message.
 *
 * @param message - Predicted-message payload emitted by the lifecycle branch
 * @returns Vessel-tagged batches gated by upsert success rules
 */
const buildTaggedPredictedBatchesFromMessage = (
  message: CurrentTripPredictedEventMessage
): TaggedPredictedDockBatch[] => {
  const batches: ConvexPredictedDockWriteBatch[] = [];
  const {
    existingTrip,
    finalProposed,
    vesselAbbrev,
    requiresSuccessfulUpsert,
  } = message;

  const projection = buildPredictedDockWriteBatch(finalProposed);
  if (projection !== null) {
    batches.push(projection);
  }

  if (
    existingTrip !== undefined &&
    shouldClearExistingPredictions(existingTrip, finalProposed)
  ) {
    const clear = buildPredictedDockClearBatch(existingTrip);
    if (clear !== null) {
      batches.push(clear);
    }
  }

  return batches.map((batch) => ({
    vesselAbbrev,
    batch,
    requiresSuccessfulUpsert,
  }));
};

/**
 * Filters actual dock writes by whether their required upsert succeeded.
 *
 * @param tagged - Tagged actual writes emitted during current-trip processing
 * @param successfulVessels - Vessels whose lifecycle upsert completed
 * @returns Persistable actual writes that should be written this tick
 */
const filterTaggedActualDockWrites = (
  tagged: TaggedActualDockWrite[],
  successfulVessels: Set<string>
): ConvexActualDockWritePersistable[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.write);

/**
 * Filters predicted batches by whether their required upsert succeeded.
 *
 * @param tagged - Tagged predicted batches emitted during current-trip
 * processing
 * @param successfulVessels - Vessels whose lifecycle upsert completed
 * @returns Predicted batches that should be written this tick
 */
const filterTaggedPredictedDockBatches = (
  tagged: TaggedPredictedDockBatch[],
  successfulVessels: Set<string>
): ConvexPredictedDockWriteBatch[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.batch);
