/**
 * Minimal predicted event domain primitives used outside table persistence.
 *
 * Realtime vessel orchestration uses this module to turn prediction-enriched
 * trip rows into sparse predicted dock write batches. The eventsPredicted table
 * still owns storage reconciliation and UpdatedAt stamping.
 */

import type {
  ConvexPredictedDockWriteBatch,
  ConvexPredictedDockWriteRow,
} from "functions/events/eventsPredicted/schemas";
import type { PredictionType } from "functions/predictions/schemas";
import type {
  ConvexJoinedTripPrediction,
  ConvexPrediction,
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { buildBoundaryKey, buildTripPredictionBoundaryKeys } from "shared/keys";

type PredictionPayload = Pick<
  ConvexPrediction,
  "PredTime" | "Actual" | "DeltaTotal"
>;

/**
 * Prefers at-sea ML payload when present, otherwise at-dock ML for the same leg.
 *
 * @param atSea - At-sea prediction field when trained
 * @param atDock - At-dock prediction field when trained
 * @param atSeaType - PredictionType for the at-sea row
 * @param atDockType - PredictionType for the at-dock row
 * @returns Chosen payload and type, or null when neither exists
 */
const preferAtSeaThenAtDockMl = (
  atSea: ConvexPrediction | ConvexJoinedTripPrediction | undefined,
  atDock: ConvexPrediction | ConvexJoinedTripPrediction | undefined,
  atSeaType: PredictionType,
  atDockType: PredictionType
): {
  prediction: PredictionPayload;
  predictionType: PredictionType;
} | null => {
  if (atSea !== undefined) {
    return { prediction: atSea, predictionType: atSeaType };
  }
  if (atDock !== undefined) {
    return { prediction: atDock, predictionType: atDockType };
  }
  return null;
};

/**
 * Builds the map key for one predicted dock row identity.
 *
 * Predicted rows are uniquely identified by their boundary key, prediction
 * type, and prediction source so multiple prediction families can coexist on
 * the same boundary. The predicted-table mutation, the predicted-table
 * queries, and the orchestrator all rely on this identity for upsert and
 * grouping, so it lives in shared domain code instead of being redefined per
 * caller.
 *
 * @param row - Row-like value with boundary key, prediction type, and source
 * @returns Composite predicted dock row identity
 */
const predictedDockCompositeKey = (row: {
  Key: string;
  PredictionType: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionType}|${row.PredictionSource}`;

/**
 * Builds the prediction projection write batch for one active trip row.
 *
 * TargetKeys enumerate every boundary owned by the trip scope, while Rows
 * contains only active ETA and ML predictions. Rows omit UpdatedAt because the
 * table mutation stamps that field during persistence.
 *
 * @param trip - Active vessel trip carrying ETA and optional ML predictions
 * @returns Sparse predicted write batch, or null when the trip cannot be scoped
 */
const buildPredictedDockWriteBatch = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null => {
  if (trip.SailingDay === undefined) {
    return null;
  }

  const targetKeys = getPredictedBoundaryTargetKeys(trip);
  if (targetKeys.length === 0) {
    return null;
  }

  const rows: ConvexPredictedDockWriteRow[] = [];
  const currentDeparture = buildCurrentDeparturePredictionRow(trip);
  if (currentDeparture !== null) {
    rows.push(currentDeparture);
  }
  rows.push(...buildCurrentArrivalPredictionRows(trip));

  const nextDeparture = buildNextDeparturePredictionRow(trip);
  if (nextDeparture !== null) {
    rows.push(nextDeparture);
  }

  return {
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    TargetKeys: targetKeys,
    Rows: rows,
  };
};

/**
 * Builds an empty predicted write batch for clearing one trip scope.
 *
 * Clear batches use the same target key derivation as write batches, allowing
 * persistence to delete stale rows for the scoped boundaries without emitting
 * replacement prediction rows.
 *
 * @param trip - Trip whose predicted dock scope should be cleared
 * @returns Empty sparse batch, or null when the trip cannot be scoped
 */
const buildPredictedDockClearBatch = (
  trip: ConvexVesselTrip | ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null => {
  if (trip.SailingDay === undefined) {
    return null;
  }

  const targetKeys = getPredictedBoundaryTargetKeys(trip);
  if (targetKeys.length === 0) {
    return null;
  }

  return {
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    TargetKeys: targetKeys,
    Rows: [],
  };
};

/**
 * Derives distinct predicted boundary keys owned by one trip.
 *
 * @param trip - Trip identity with current and optional next segment keys
 * @returns Distinct current departure, current arrival, and next departure keys
 */
const getPredictedBoundaryTargetKeys = (trip: {
  ScheduleKey?: string;
  TripKey?: string;
  NextScheduleKey?: string;
}): string[] => {
  const { depDockKey, arvDockKey, nextDepDockKey } =
    buildTripPredictionBoundaryKeys(trip);

  return Array.from(
    new Set(
      [depDockKey, arvDockKey, nextDepDockKey].filter(
        (key): key is string => key !== undefined
      )
    )
  );
};

/**
 * Builds the current departure ML row when prerequisites are present.
 *
 * @param trip - Prediction-enriched trip row
 * @returns Current departure predicted row, or null when unavailable
 */
const buildCurrentDeparturePredictionRow = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteRow | null => {
  const segment = getCurrentLegSegment(trip);
  if (
    segment === undefined ||
    trip.SailingDay === undefined ||
    trip.ScheduledDeparture === undefined ||
    trip.AtDockDepartCurr === undefined
  ) {
    return null;
  }

  return buildPredictedDockWriteRow({
    Key: buildBoundaryKey(segment, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.DepartingTerminalAbbrev,
    EventPredictedTime: trip.AtDockDepartCurr.PredTime,
    PredictionType: "AtDockDepartCurr",
    PredictionSource: "ml",
    prediction: trip.AtDockDepartCurr,
  });
};

/**
 * Builds current arrival rows from WSF ETA and the best ML arrival payload.
 *
 * @param trip - Prediction-enriched trip row
 * @returns Zero, one, or two current arrival predicted rows
 */
const buildCurrentArrivalPredictionRows = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteRow[] => {
  const segment = getCurrentLegSegment(trip);
  if (
    segment === undefined ||
    trip.SailingDay === undefined ||
    trip.ScheduledDeparture === undefined ||
    trip.ArrivingTerminalAbbrev === undefined
  ) {
    return [];
  }

  const base = {
    Key: buildBoundaryKey(segment, "arv-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
  };
  const rows: ConvexPredictedDockWriteRow[] = [];

  if (trip.Eta !== undefined) {
    rows.push({
      ...base,
      EventPredictedTime: trip.Eta,
      PredictionType: "AtSeaArriveNext",
      PredictionSource: "wsf_eta",
    });
  }

  const bestMlArrival = getBestCurrentArrivalMlPrediction(trip);
  if (bestMlArrival !== null) {
    rows.push(
      buildPredictedDockWriteRow({
        ...base,
        EventPredictedTime: bestMlArrival.prediction.PredTime,
        PredictionType: bestMlArrival.predictionType,
        PredictionSource: "ml",
        prediction: bestMlArrival.prediction,
      })
    );
  }

  return rows;
};

/**
 * Builds the next departure ML row when next-leg metadata is present.
 *
 * @param trip - Prediction-enriched trip row
 * @returns Next departure predicted row, or null when unavailable
 */
const buildNextDeparturePredictionRow = (
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteRow | null => {
  if (
    trip.SailingDay === undefined ||
    trip.NextScheduleKey === undefined ||
    trip.NextScheduledDeparture === undefined ||
    trip.ArrivingTerminalAbbrev === undefined
  ) {
    return null;
  }

  const bestNextDeparture = getBestNextDepartureMlPrediction(trip);
  if (bestNextDeparture === null) {
    return null;
  }

  return buildPredictedDockWriteRow({
    Key: buildBoundaryKey(trip.NextScheduleKey, "dep-dock"),
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    ScheduledDeparture: trip.NextScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    EventPredictedTime: bestNextDeparture.prediction.PredTime,
    PredictionType: bestNextDeparture.predictionType,
    PredictionSource: "ml",
    prediction: bestNextDeparture.prediction,
  });
};

/**
 * Selects the strongest current-arrival ML payload.
 *
 * @param trip - Prediction-enriched trip row
 * @returns At-sea arrival prediction when present, then at-dock arrival
 */
const getBestCurrentArrivalMlPrediction = (
  trip: ConvexVesselTripWithML
): {
  prediction: PredictionPayload;
  predictionType: PredictionType;
} | null =>
  preferAtSeaThenAtDockMl(
    trip.AtSeaArriveNext,
    trip.AtDockArriveNext,
    "AtSeaArriveNext",
    "AtDockArriveNext"
  );

/**
 * Selects the strongest next-departure ML payload.
 *
 * @param trip - Prediction-enriched trip row
 * @returns At-sea depart-next prediction when present, then at-dock depart-next
 */
const getBestNextDepartureMlPrediction = (
  trip: ConvexVesselTripWithML
): {
  prediction: PredictionPayload;
  predictionType: PredictionType;
} | null =>
  preferAtSeaThenAtDockMl(
    trip.AtSeaDepartNext,
    trip.AtDockDepartNext,
    "AtSeaDepartNext",
    "AtDockDepartNext"
  );

/**
 * Builds one sparse predicted dock write row and copies optional actual fields.
 *
 * @param row - Required row fields plus optional ML payload source
 * @returns Sparse predicted dock write row
 */
const buildPredictedDockWriteRow = (
  row: ConvexPredictedDockWriteRow & {
    prediction?: { Actual?: number; DeltaTotal?: number };
  }
): ConvexPredictedDockWriteRow => ({
  Key: row.Key,
  VesselAbbrev: row.VesselAbbrev,
  SailingDay: row.SailingDay,
  ScheduledDeparture: row.ScheduledDeparture,
  TerminalAbbrev: row.TerminalAbbrev,
  EventPredictedTime: row.EventPredictedTime,
  PredictionType: row.PredictionType,
  PredictionSource: row.PredictionSource,
  ...(row.prediction?.Actual !== undefined
    ? { Actual: row.prediction.Actual }
    : {}),
  ...(row.prediction?.DeltaTotal !== undefined
    ? { DeltaTotal: row.prediction.DeltaTotal }
    : {}),
});

/**
 * Resolves the current trip segment key for prediction boundaries.
 *
 * @param trip - Trip with optional schedule alignment and physical identity
 * @returns Schedule key when present, otherwise TripKey
 */
const getCurrentLegSegment = (trip: {
  ScheduleKey?: string;
  TripKey?: string;
}): string | undefined => trip.ScheduleKey ?? trip.TripKey;

export {
  buildPredictedDockClearBatch,
  buildPredictedDockWriteBatch,
  predictedDockCompositeKey,
};
