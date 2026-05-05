/**
 * Pure helpers for deriving predicted boundary projection effects.
 *
 * Maps active vessel-trip ML and ETA fields into eventsPredicted row batches
 * and clear scopes used by the orchestrator mutation layer.
 */

import type {
  ConvexPredictedDockEvent,
  ConvexPredictedDockWriteBatch,
  ConvexPredictedDockWriteRow,
  ConvexPredictionSource,
} from "functions/events/eventsPredicted/schemas";
import type { PredictionType } from "functions/predictions/schemas";
import type { ConvexVesselTripWithML } from "../../../functions/vesselTrips/schemas";
import {
  buildBoundaryKey,
  buildTripPredictionBoundaryKeys,
} from "../../../shared/keys";
import { predictedDockCompositeKey } from "./schemas";

/**
 * Current sailing segment string: schedule anchor when present, else physical
 * TripKey (same format for schedule-backed legs).
 */
const currentLegSegment = (trip: { ScheduleKey?: string; TripKey: string }) =>
  trip.ScheduleKey ?? trip.TripKey;

/**
 * Builds the prediction projection write batch for one active trip row.
 *
 * TargetKeys enumerate boundary keys that reconciliation may delete when absent,
 * while Rows carries deduped predictions across current leg, arrival, and next
 * departure phases. Returns null when sailing day or prediction keys cannot scope.
 *
 * @param trip - Active vessel trip carrying ML and ETA payloads from orchestration
 * @returns Batch descriptor for mutations, or null when scoping fails
 */
export const buildPredictedDockWriteBatch = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null => {
  if (!trip.SailingDay) {
    return null;
  }

  const TargetKeys = getPredictedBoundaryTargetKeys(trip);
  if (TargetKeys.length === 0) {
    return null;
  }

  return {
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    TargetKeys,
    Rows: buildPredictedBoundaryEventsFromTrip(trip).map(
      stripPredictedUpdatedAt
    ),
  };
};

/**
 * Builds a clear-batch effect that deletes scoped predictions without replacements.
 *
 * Used when trips transition states that invalidate predictions but do not yet
 * produce new ML rows, keeping stale TargetKeys from lingering in the database.
 *
 * @param trip - Active trip whose prediction scope should be cleared
 * @returns Batch with empty Rows but populated TargetKeys, or null when unscopable
 */
export const buildPredictedDockClearBatch = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null => {
  if (!trip.SailingDay) {
    return null;
  }

  const TargetKeys = getPredictedBoundaryTargetKeys(trip);
  if (TargetKeys.length === 0) {
    return null;
  }

  return {
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    TargetKeys,
    Rows: [],
  };
};

/**
 * Assembles all predicted dock rows implied by the trips current ML and ETA fields.
 *
 * Combines current departure, current arrival candidates (ETA versus ML), and the
 * next legs departure prediction when NextScheduleKey exists. Deduplicates using
 * predictedDockCompositeKey so phase swaps do not emit duplicate composites.
 *
 * @param trip - Active trip snapshot including timestamps used as UpdatedAt
 * @returns Deduped ConvexPredictedDockEvent rows ready for stripPredictedUpdatedAt
 */
const buildPredictedBoundaryEventsFromTrip = (trip: ConvexVesselTripWithML) => {
  const updatedAt = trip.TimeStamp;
  const rows: ConvexPredictedDockEvent[] = [];

  const currentDeparture = getCurrentDeparturePrediction(trip, updatedAt);
  if (currentDeparture) {
    rows.push(currentDeparture);
  }

  rows.push(...getCurrentArrivalPredictions(trip, updatedAt));

  const nextDeparture = getNextDeparturePrediction(trip, updatedAt);
  if (nextDeparture) {
    rows.push(nextDeparture);
  }

  return dedupePredictedBoundaryEvents(rows);
};

/**
 * Lists distinct boundary keys touched by trip-driven prediction writes.
 *
 * @param trip - Active trip with optional dep, arv, and next dep keys from buildTripPredictionBoundaryKeys
 * @returns Non-empty string keys used as TargetKeys during reconciliation
 */
const getPredictedBoundaryTargetKeys = (trip: ConvexVesselTripWithML) => {
  const { depDockKey, arvDockKey, nextDepDockKey } =
    buildTripPredictionBoundaryKeys(trip);
  return Array.from(
    new Set(
      [depDockKey, arvDockKey, nextDepDockKey].filter(
        (k): k is string => k !== undefined
      )
    )
  );
};

/**
 * Copies optional Actual and DeltaTotal fields when ML payloads carry them.
 *
 * @param p - ML prediction fragment that may include calibration fields
 * @returns Spreadable partial object without undefined entries
 */
const predictionActualFields = (p: {
  Actual?: number;
  DeltaTotal?: number;
}) => ({
  ...(p.Actual !== undefined ? { Actual: p.Actual } : {}),
  ...(p.DeltaTotal !== undefined ? { DeltaTotal: p.DeltaTotal } : {}),
});

/**
 * Builds the current-leg dep-dock ML prediction row when AtDockDepartCurr exists.
 *
 * Requires ScheduleKey and ScheduledDeparture so the boundary Key matches scheduled
 * rows; omits the row entirely when ML did not publish a current departure time.
 *
 * @param trip - Active trip with ML fields on the current leg
 * @param updatedAt - Timestamp stored on the predicted row for staleness checks
 * @returns Predicted row or null when prerequisites or ML payload are missing
 */
const getCurrentDeparturePrediction = (
  trip: ConvexVesselTripWithML,
  updatedAt: number
) => {
  const segment = currentLegSegment(trip);
  if (
    !segment ||
    trip.ScheduledDeparture === undefined ||
    !trip.AtDockDepartCurr
  ) {
    return null;
  }

  return buildPredictedBoundaryEvent({
    Key: buildBoundaryKey(segment, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.DepartingTerminalAbbrev,
    EventPredictedTime: trip.AtDockDepartCurr.PredTime,
    PredictionType: "AtDockDepartCurr",
    PredictionSource: "ml",
    ...predictionActualFields(trip.AtDockDepartCurr),
  });
};

/**
 * Builds arrival prediction rows for the current segment from ETA and ML sources.
 *
 * Emits a WSF ETA row when present, otherwise selects the best ML arrival candidate
 * between at-sea and at-dock phases so only one arrival prediction occupies the arv key.
 *
 * @param trip - Active trip with arrival terminal and optional ETA or ML blocks
 * @param updatedAt - Timestamp stored on emitted predicted rows
 * @returns Zero or more arrival rows sharing the arv-dock boundary Key
 */
const getCurrentArrivalPredictions = (
  trip: ConvexVesselTripWithML,
  updatedAt: number
): ConvexPredictedDockEvent[] => {
  const segment = currentLegSegment(trip);
  if (
    !segment ||
    trip.ScheduledDeparture === undefined ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return [];
  }

  const arvKey = buildBoundaryKey(segment, "arv-dock");
  const base = {
    Key: arvKey,
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
  };

  const rows: ConvexPredictedDockEvent[] = [];

  if (trip.Eta !== undefined) {
    rows.push(
      buildPredictedBoundaryEvent({
        ...base,
        EventPredictedTime: trip.Eta,
        PredictionType: "AtSeaArriveNext" as PredictionType,
        PredictionSource: "wsf_eta" as ConvexPredictionSource,
      })
    );
  }

  const bestMlArrivalPrediction =
    (trip.AtSeaArriveNext
      ? {
          prediction: trip.AtSeaArriveNext,
          PredictionType: "AtSeaArriveNext" as PredictionType,
        }
      : null) ??
    (trip.AtDockArriveNext
      ? {
          prediction: trip.AtDockArriveNext,
          PredictionType: "AtDockArriveNext" as PredictionType,
        }
      : null);

  if (bestMlArrivalPrediction) {
    rows.push(
      buildPredictedBoundaryEvent({
        ...base,
        EventPredictedTime: bestMlArrivalPrediction.prediction.PredTime,
        PredictionType: bestMlArrivalPrediction.PredictionType,
        PredictionSource: "ml" as ConvexPredictionSource,
        ...predictionActualFields(bestMlArrivalPrediction.prediction),
      })
    );
  }

  return rows;
};

/**
 * Builds the next legs dep-dock prediction using at-sea or at-dock depart-next ML.
 *
 * Chooses whichever ML phase is populated for the following ScheduleKey and stamps
 * terminals from the arriving terminal of the current leg. Returns null when next
 * leg metadata or both ML blocks are absent.
 *
 * @param trip - Active trip including NextScheduleKey and depart-next ML payloads
 * @param updatedAt - Timestamp stored on the predicted row
 * @returns Predicted next departure row or null when unavailable
 */
const getNextDeparturePrediction = (
  trip: ConvexVesselTripWithML,
  updatedAt: number
) => {
  if (
    !trip.NextScheduleKey ||
    trip.NextScheduledDeparture === undefined ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  const bestPrediction =
    (trip.AtSeaDepartNext
      ? {
          EventPredictedTime: trip.AtSeaDepartNext.PredTime,
          PredictionType: "AtSeaDepartNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        }
      : null) ??
    (trip.AtDockDepartNext
      ? {
          EventPredictedTime: trip.AtDockDepartNext.PredTime,
          PredictionType: "AtDockDepartNext" as PredictionType,
          PredictionSource: "ml" as ConvexPredictionSource,
        }
      : null);

  if (!bestPrediction) {
    return null;
  }

  const nextFields =
    bestPrediction.PredictionType === "AtSeaDepartNext"
      ? trip.AtSeaDepartNext
      : trip.AtDockDepartNext;

  return buildPredictedBoundaryEvent({
    Key: buildBoundaryKey(trip.NextScheduleKey, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay ?? "",
    UpdatedAt: updatedAt,
    ScheduledDeparture: trip.NextScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    ...bestPrediction,
    ...(nextFields ? predictionActualFields(nextFields) : {}),
  });
};

/**
 * Identity helper that keeps predicted row assembly readable at call sites.
 *
 * @param row - Fully populated ConvexPredictedDockEvent before batch packaging
 * @returns Same row reference for predictable typing in builders
 */
const buildPredictedBoundaryEvent = (
  row: ConvexPredictedDockEvent
): ConvexPredictedDockEvent => row;

/**
 * Removes UpdatedAt from rows bundled inside sparse write payloads.
 *
 * Mutations stamp UpdatedAt at write time; batch Rows omit it so equality checks
 * focus on prediction payload fields only.
 *
 * @param row - Full predicted row including UpdatedAt from trip snapshot time
 * @returns ConvexPredictedDockWriteRow suitable for batch Rows arrays
 */
const stripPredictedUpdatedAt = (
  row: ConvexPredictedDockEvent
): ConvexPredictedDockWriteRow => ({
  Key: row.Key,
  VesselAbbrev: row.VesselAbbrev,
  SailingDay: row.SailingDay,
  ScheduledDeparture: row.ScheduledDeparture,
  TerminalAbbrev: row.TerminalAbbrev,
  EventPredictedTime: row.EventPredictedTime,
  PredictionType: row.PredictionType,
  PredictionSource: row.PredictionSource,
  ...(row.Actual !== undefined ? { Actual: row.Actual } : {}),
  ...(row.DeltaTotal !== undefined ? { DeltaTotal: row.DeltaTotal } : {}),
});

/**
 * Dedupes predicted rows that collide on composite Key, type, and source.
 *
 * @param rows - Candidate rows potentially containing duplicates after phase merges
 * @returns First-seen row per predictedDockCompositeKey stable iteration order
 */
const dedupePredictedBoundaryEvents = (
  rows: ConvexPredictedDockEvent[]
): ConvexPredictedDockEvent[] =>
  Array.from(
    new Map(rows.map((row) => [predictedDockCompositeKey(row), row])).values()
  );
