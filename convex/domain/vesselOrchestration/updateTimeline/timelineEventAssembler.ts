/**
 * Assembles `PingEventWrites` from lifecycle facts and per-vessel messages.
 *
 * Owns imports of `domain/timelineRows` projection builders and converts sparse
 * actual writes into persisted actual rows before they cross the DB boundary.
 */

import type { ConvexActualDockEvent } from "domain/events/actual/schemas";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted/schemas";
import {
  buildActualDockEventFromWrite,
  buildPredictedDockClearBatch,
  buildPredictedDockWriteBatch,
} from "domain/timelineRows";
import type {
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import {
  buildArrivalActualDockWriteForTrip,
  buildDepartureActualDockWriteForTrip,
} from "./actualDockWritesFromTrip";
import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "domain/vesselOrchestration/shared/pingHandshake/types";
import {
  mergePingEventWrites,
  type PingEventWrites,
} from "domain/vesselOrchestration/shared/pingHandshake/projectionWire";

/**
 * Replacement row for predicted timeline writes after **updateVesselPredictions**.
 *
 * @param fact - Boundary fact from the trip applier (must be ML-merged first)
 * @returns ML-shaped new trip for `buildPredictedDockWriteBatch`
 */
const completedBoundaryNewTripForTimeline = (
  fact: CompletedTripBoundaryFact
): ConvexVesselTripWithML => {
  if (fact.newTrip === undefined) {
    throw new Error(
      "CompletedTripBoundaryFact.newTrip is required before timeline projection; run updateVesselPredictions merge first."
    );
  }
  return fact.newTrip;
};

/**
 * Trip shape for current-branch actual dock writes (schedule actuals suffice).
 *
 * @param message - Current-trip actual message from lifecycle
 * @returns Proposed trip row (ML optional for these writes)
 */
const currentTripProposedForActuals = (
  message: CurrentTripActualEventMessage
): ConvexVesselTripWithML =>
  message.finalProposed ??
  (message.scheduleTrip as ConvexVesselTripWithML);

/**
 * Trip shape for current-branch predicted batches (needs ML when present).
 *
 * @param message - Current-trip predicted message from lifecycle
 * @returns Proposed trip for predicted dock projection
 */
const currentTripProposedForPredicted = (
  message: CurrentTripPredictedEventMessage
): ConvexVesselTripWithML =>
  message.finalProposed ??
  (message.scheduleTrip as ConvexVesselTripWithML);

type TaggedActualDockRow = {
  vesselAbbrev: string;
  row: ConvexActualDockEvent;
  requiresSuccessfulUpsert: boolean;
};

type TaggedPredictedDockBatch = {
  vesselAbbrev: string;
  batch: ConvexPredictedDockWriteBatch;
  requiresSuccessfulUpsert: boolean;
};

/**
 * Converts completed-trip facts into merged ping event writes.
 *
 * @param facts - One entry per successful `completeAndStartNewTrip` boundary
 * @param updatedAt - Timestamp used to stamp persisted actual rows
 * @returns Actual and predicted dock writes for timeline mutations
 */
export const buildPingEventWritesFromCompletedFacts = (
  facts: CompletedTripBoundaryFact[],
  updatedAt: number
): PingEventWrites =>
  facts.reduce(
    (acc, fact) =>
      mergePingEventWrites(
        acc,
        pingEventWritesFromCompletedFact(fact, updatedAt)
      ),
    emptyPingEventWrites()
  );

/**
 * Builds ping event writes for the current-trip branch after lifecycle writes.
 *
 * @param successfulVessels - Vessels whose batch upsert succeeded (empty if none ran)
 * @param pendingActualMessages - Per-vessel actual write messages
 * @param pendingPredictedMessages - Per-vessel predicted-batch messages
 * @param updatedAt - Timestamp used to stamp persisted actual rows
 * @returns Dock writes after upsert-gated filtering
 */
export const buildPingEventWritesFromCurrentMessages = (
  successfulVessels: Set<string>,
  pendingActualMessages: CurrentTripActualEventMessage[],
  pendingPredictedMessages: CurrentTripPredictedEventMessage[],
  updatedAt: number
): PingEventWrites => {
  const taggedActual = pendingActualMessages.flatMap((message) =>
    buildTaggedActualDockRowsFromMessage(message, updatedAt)
  );
  const taggedPredicted = pendingPredictedMessages.flatMap(
    buildTaggedPredictedBatchesFromMessage
  );

  return {
    actualDockWrites: filterTaggedActualDockRows(
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
 * @param updatedAt - Timestamp used to stamp persisted actual rows
 * @returns Event-write payload for the completed trip
 */
const pingEventWritesFromCompletedFact = (
  fact: CompletedTripBoundaryFact,
  updatedAt: number
): PingEventWrites => ({
  actualDockWrites: [
    buildDepartureActualDockWriteForTrip(fact.tripToComplete),
    buildArrivalActualDockWriteForTrip(fact.tripToComplete),
  ]
    .filter((write): write is NonNullable<typeof write> => write !== null)
    .map((write) => buildActualDockEventFromWrite(write, updatedAt)),
  predictedDockWriteBatches: [
    buildPredictedDockClearBatch(fact.existingTrip),
    buildPredictedDockWriteBatch(completedBoundaryNewTripForTimeline(fact)),
  ].filter((batch): batch is ConvexPredictedDockWriteBatch => Boolean(batch)),
});

/**
 * Creates an empty ping-event accumulator.
 *
 * @returns Ping-event writes with no actual or predicted payloads
 */
const emptyPingEventWrites = (): PingEventWrites => ({
  actualDockWrites: [],
  predictedDockWriteBatches: [],
});

/**
 * Determines whether an old trip's predicted overlays should be cleared before
 * projecting the new proposal.
 *
 * @param existingTrip - Previously persisted trip, when one exists
 * @param finalProposed - Newly built trip proposal for the current ping
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
 * Builds actual dock rows for one current-trip message.
 *
 * @param message - Actual-message payload emitted by the lifecycle branch
 * @param updatedAt - Timestamp used to stamp persisted actual rows
 * @returns Vessel-tagged rows gated by upsert success rules
 */
const buildTaggedActualDockRowsFromMessage = (
  message: CurrentTripActualEventMessage,
  updatedAt: number
): TaggedActualDockRow[] => {
  const rows: ConvexActualDockEvent[] = [];
  const proposed = currentTripProposedForActuals(message);
  const { events, vesselAbbrev, requiresSuccessfulUpsert } = message;

  if (events.didJustLeaveDock && proposed.LeftDockActual !== undefined) {
    const departure = buildDepartureActualDockWriteForTrip(proposed);
    if (departure !== null) {
      rows.push(buildActualDockEventFromWrite(departure, updatedAt));
    }
  }
  if (events.didJustArriveAtDock && proposed.ArrivedNextActual !== undefined) {
    const arrival = buildArrivalActualDockWriteForTrip(proposed);
    if (arrival !== null) {
      rows.push(buildActualDockEventFromWrite(arrival, updatedAt));
    }
  }

  return rows.map((row) => ({
    vesselAbbrev,
    row,
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
  const { existingTrip, vesselAbbrev, requiresSuccessfulUpsert } = message;
  const finalProposed = currentTripProposedForPredicted(message);

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
 * Filters actual dock rows by whether their required upsert succeeded.
 *
 * @param tagged - Tagged actual rows emitted during current-trip processing
 * @param successfulVessels - Vessels whose lifecycle upsert completed
 * @returns Persisted actual rows that should be written this ping
 */
const filterTaggedActualDockRows = (
  tagged: TaggedActualDockRow[],
  successfulVessels: Set<string>
): ConvexActualDockEvent[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.row);

/**
 * Filters predicted batches by whether their required upsert succeeded.
 *
 * @param tagged - Tagged predicted batches emitted during current-trip
 * processing
 * @param successfulVessels - Vessels whose lifecycle upsert completed
 * @returns Predicted batches that should be written this ping
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
