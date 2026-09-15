/**
 * Direct event projection from a sparse trip update and enriched active trip.
 *
 * Replaces the handoff-based event assembly path with one projector that emits
 * persistence-ready actual rows, predicted batches, and optional leave-dock ML
 * patch payloads for a single orchestrator tick.
 */

import { buildActualDockEventFromWrite } from "domain/events/actual";
import {
  buildPredictedDockClearBatch,
  buildPredictedDockWriteBatch,
} from "domain/events/predicted";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import { buildBoundaryKey } from "shared/keys";
import { floorToSecond } from "shared/time";
import {
  buildArrivalActualDockWriteForTrip,
  buildDepartureActualDockWriteForTrip,
} from "./actualDockWritesFromTrip";
import type {
  ProjectEventsFromTripDeltaInput,
  ProjectEventsFromTripDeltaResult,
  UpdateLeaveDockEventPatch,
} from "./contracts";

/**
 * Projects sparse event-table writes from one trip delta and enriched active trip.
 *
 * Completed rollover emits completed-leg actual rows plus clear/replace predicted
 * batches. Steady-state pings refresh predicted rows through the current branch.
 * Current actual transition rows may still emit on rollover when dock facts
 * indicate them. Leave-dock ML actualization is derived from the same transition
 * facts.
 *
 * @param input - Ping time, sparse trip update, and ML-enriched active trip
 * @returns Persistence-ready actual rows, predicted batches, and optional patch
 */
const projectEventsFromTripDelta = (
  input: ProjectEventsFromTripDeltaInput
): ProjectEventsFromTripDeltaResult => {
  const { pingStartedAt, tripUpdate, enrichedActiveVesselTrip } = input;
  const actualEvents: ConvexActualDockEvent[] = [];
  const predictedEvents: ConvexPredictedDockWriteBatch[] = [];
  const { existingVesselTrip, completedVesselTrip } = tripUpdate;
  const isCompletedRollover =
    existingVesselTrip !== undefined && completedVesselTrip !== undefined;

  if (isCompletedRollover) {
    appendCompletedRolloverEvents({
      existingVesselTrip,
      completedVesselTrip,
      enrichedActiveVesselTrip,
      pingStartedAt,
      actualEvents,
      predictedEvents,
    });
  }

  appendCurrentActualEvents({
    enrichedActiveVesselTrip,
    dockTransitions: tripUpdate.dockTransitions,
    pingStartedAt,
    actualEvents,
  });

  if (!isCompletedRollover) {
    appendCurrentPredictedEvents({
      existingVesselTrip,
      enrichedActiveVesselTrip,
      predictedEvents,
    });
  }

  const updateLeaveDockEventPatch = buildLeaveDockEventPatch(tripUpdate);

  return {
    actualEvents,
    predictedEvents,
    ...(updateLeaveDockEventPatch === undefined
      ? {}
      : { updateLeaveDockEventPatch }),
  };
};

type AppendCompletedRolloverEventsArgs = {
  existingVesselTrip: ConvexVesselTrip;
  completedVesselTrip: ConvexVesselTrip;
  enrichedActiveVesselTrip: ConvexVesselTripWithML;
  pingStartedAt: number;
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockWriteBatch[];
};

/**
 * Appends completed-leg actual and predicted event writes for one rollover.
 *
 * @param args - Completed rollover context and output accumulators
 * @returns void; mutates the supplied event arrays
 */
const appendCompletedRolloverEvents = ({
  existingVesselTrip,
  completedVesselTrip,
  enrichedActiveVesselTrip,
  pingStartedAt,
  actualEvents,
  predictedEvents,
}: AppendCompletedRolloverEventsArgs): void => {
  for (const write of [
    buildDepartureActualDockWriteForTrip(completedVesselTrip),
    buildArrivalActualDockWriteForTrip(completedVesselTrip),
  ]) {
    if (write !== null) {
      actualEvents.push(buildActualDockEventFromWrite(write, pingStartedAt));
    }
  }

  const clearBatch = buildPredictedDockClearBatch(existingVesselTrip);
  if (clearBatch !== null) {
    predictedEvents.push(clearBatch);
  }

  const replacementBatch = buildPredictedDockWriteBatch(
    enrichedActiveVesselTrip
  );
  if (replacementBatch !== null) {
    predictedEvents.push(replacementBatch);
  }
};

type AppendCurrentActualEventsArgs = {
  enrichedActiveVesselTrip: ConvexVesselTripWithML;
  dockTransitions: VesselTripUpdate["dockTransitions"];
  pingStartedAt: number;
  actualEvents: ConvexActualDockEvent[];
};

/**
 * Appends current-branch actual dock rows for leave-dock and arrive-dock edges.
 *
 * @param args - Enriched active trip, transition facts, and output accumulator
 * @returns void; mutates the supplied actual event array
 */
const appendCurrentActualEvents = ({
  enrichedActiveVesselTrip,
  dockTransitions,
  pingStartedAt,
  actualEvents,
}: AppendCurrentActualEventsArgs): void => {
  if (
    dockTransitions.didJustLeaveDock &&
    enrichedActiveVesselTrip.LeftDockActual !== undefined
  ) {
    const departure = buildDepartureActualDockWriteForTrip(
      enrichedActiveVesselTrip
    );
    if (departure !== null) {
      actualEvents.push(
        buildActualDockEventFromWrite(departure, pingStartedAt)
      );
    }
  }

  if (
    dockTransitions.didJustArriveAtDock &&
    enrichedActiveVesselTrip.TripEnd !== undefined
  ) {
    const arrival = buildArrivalActualDockWriteForTrip(
      enrichedActiveVesselTrip
    );
    if (arrival !== null) {
      actualEvents.push(buildActualDockEventFromWrite(arrival, pingStartedAt));
    }
  }
};

type AppendCurrentPredictedEventsArgs = {
  existingVesselTrip: ConvexVesselTrip | undefined;
  enrichedActiveVesselTrip: ConvexVesselTripWithML;
  predictedEvents: ConvexPredictedDockWriteBatch[];
};

/**
 * Appends current-branch predicted write and stale-clear batches.
 *
 * @param args - Prior active trip, enriched active trip, and output accumulator
 * @returns void; mutates the supplied predicted event array
 */
const appendCurrentPredictedEvents = ({
  existingVesselTrip,
  enrichedActiveVesselTrip,
  predictedEvents,
}: AppendCurrentPredictedEventsArgs): void => {
  const projection = buildPredictedDockWriteBatch(enrichedActiveVesselTrip);
  if (projection !== null) {
    predictedEvents.push(projection);
  }

  if (
    existingVesselTrip !== undefined &&
    shouldClearExistingPredictions(existingVesselTrip, enrichedActiveVesselTrip)
  ) {
    const clear = buildPredictedDockClearBatch(existingVesselTrip);
    if (clear !== null) {
      predictedEvents.push(clear);
    }
  }
};

/**
 * Determines whether an old trip's predicted overlays should be cleared before
 * projecting the new proposal.
 *
 * @param existingTrip - Previously persisted trip, when one exists
 * @param finalProposed - Newly built trip proposal for the current ping
 * @returns True when the proposal changes sailing-day or schedule identity
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
 * Builds leave-dock ML patch inputs from one sparse trip update, or undefined.
 *
 * @param tripUpdate - Sparse trip delta from updateVesselTrip for this ping
 * @returns Patch payload for eventsPredicted ML rows, or undefined when skipped
 */
const buildLeaveDockEventPatch = (
  tripUpdate: VesselTripUpdate
): UpdateLeaveDockEventPatch | undefined => {
  const activeTrip = tripUpdate.activeVesselTrip;
  const leftDockActual = activeTrip.LeftDockActual;

  if (leftDockActual === undefined || !activeTrip.ScheduleKey) {
    return undefined;
  }

  if (!tripUpdate.dockTransitions.didJustLeaveDock) {
    return undefined;
  }

  return {
    vesselAbbrev: tripUpdate.vesselAbbrev,
    depBoundaryKey: buildBoundaryKey(activeTrip.ScheduleKey, "dep-dock"),
    actualDepartMs: floorToSecond(leftDockActual),
  };
};

export { buildLeaveDockEventPatch, projectEventsFromTripDelta };
