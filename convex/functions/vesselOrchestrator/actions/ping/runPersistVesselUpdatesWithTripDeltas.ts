/**
 * Action-side wrapper: computes active-trip field deltas for logging, then
 * invokes the internal `persistVesselUpdates` mutation (see
 * `functions/vesselOrchestrator/mutations/orchestratorPersistMutations`).
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** Stored trip fields that hold epoch ms wall-clock instants (not durations). */
const EPOCH_MS_TRIP_FIELD_KEYS = new Set<string>([
  "TripStart",
  "TripEnd",
  "ScheduledDeparture",
  "LeftDock",
  "LeftDockActual",
  "Eta",
  "PrevScheduledDeparture",
  "PrevLeftDock",
  "NextScheduledDeparture",
]);

/**
 * Logs field-level diffs between the prior active trip and the new
 * `activeVesselTrip` (see {@link buildActiveTripFieldDeltaLogObject}), then runs
 * `ctx.runMutation` for
 * `internal.functions.vesselOrchestrator.mutations.orchestratorPersistMutations.persistVesselUpdates`
 * with the same `args`.
 *
 * @param ctx - Convex action context; used to invoke the internal mutation
 * @param existingActiveTrip - The active trip row as of the start of this
 *   branch, or `undefined` when no row existed (e.g. first upsert)
 * @param args - Same payload passed through to `persistVesselUpdates`
 * @returns `null` when the mutation completes
 */
export const runPersistVesselUpdatesWithTripDeltas = async (
  ctx: ActionCtx,
  existingActiveTrip: ConvexVesselTrip | undefined,
  args: {
    vesselAbbrev: string;
    activeVesselTrip: ConvexVesselTrip;
    completedVesselTrip?: ConvexVesselTrip;
    predictionRows: VesselTripPredictionProposal[];
    actualEvents: ConvexActualDockEvent[];
    predictedEvents: ConvexPredictedDockWriteBatch[];
    updateLeaveDockEventPatch?: {
      vesselAbbrev: string;
      depBoundaryKey: string;
      actualDepartMs: number;
    };
  }
): Promise<null> => {
  const deltas = buildActiveTripFieldDeltaLogObject(
    existingActiveTrip,
    args.activeVesselTrip
  );
  console.log(
    "[runPersistVesselUpdatesWithTripDeltas] activeVesselTripDeltas",
    {
      vesselAbbrev: existingActiveTrip?.VesselAbbrev,
      ...deltas,
    }
  );

  return ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.orchestratorPersistMutations
      .persistVesselUpdates,
    args
  );
};

/**
 * Formats an epoch-ms instant as the time-of-day portion of
 * `Date#toISOString` (e.g. `14:30:00.000Z`), discarding the calendar date.
 *
 * @param epochMs - Wall-clock instant in milliseconds since Unix epoch
 * @returns ISO 8601 time substring after `T`, including `Z` suffix
 */
const epochMsToIsoTimeOnly = (epochMs: number): string => {
  const iso = new Date(epochMs).toISOString();
  const timePart = iso.split("T")[1];
  return timePart ?? iso;
};

/**
 * Renders one side of a trip field delta for logs: primitives as readable
 * text; epoch-ms fields in {@link EPOCH_MS_TRIP_FIELD_KEYS} as ISO time-only
 * via {@link epochMsToIsoTimeOnly}; other values as `JSON.stringify`.
 *
 * @param key - Trip document property name; selects epoch vs plain formatting
 * @param value - Prior or next field value from the compared trip objects
 * @returns Human-readable segment used inside `prev -> next` strings
 */
const formatDeltaSegment = (key: string, value: unknown): string => {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "number" && EPOCH_MS_TRIP_FIELD_KEYS.has(key)) {
    return epochMsToIsoTimeOnly(value);
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
};

/**
 * Builds a plain object of changed active-trip fields suitable for
 * `console.log`: each key is a persisted field name, each value is
 * `prev -> next` with {@link formatDeltaSegment} applied on both sides.
 * Omits `TimeStamp` entirely so volatile clock bumps do not flood logs.
 *
 * @param existingActiveTrip - Baseline row from the snapshot (or `undefined`)
 * @param activeVesselTrip - New row about to be upserted
 * @returns Map of field name to `formattedPrev -> formattedNext`; empty when
 *   no comparable fields differ
 */
const buildActiveTripFieldDeltaLogObject = (
  existingActiveTrip: ConvexVesselTrip | undefined,
  activeVesselTrip: ConvexVesselTrip
): Record<string, string> => {
  const prev = existingActiveTrip as Record<string, unknown> | undefined;
  const next = activeVesselTrip as Record<string, unknown>;
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)]);
  const out: Record<string, string> = {};
  for (const key of keys) {
    if (key === "TimeStamp") {
      continue;
    }
    const a = prev?.[key];
    const b = next[key];
    if (a !== b) {
      out[key] =
        `${formatDeltaSegment(key, a)} -> ${formatDeltaSegment(key, b)}`;
    }
  }
  return out;
};
