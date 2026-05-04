/**
 * Domain-owned predicted dock-event contracts.
 */

/**
 * PascalCase prediction type used by vessel-trip ML fields and predicted rows.
 */
export type PredictionType =
  | "AtDockDepartCurr"
  | "AtDockArriveNext"
  | "AtDockDepartNext"
  | "AtSeaArriveNext"
  | "AtSeaDepartNext";

/**
 * Prediction source for persisted predicted dock rows.
 */
export type ConvexPredictionSource = "ml" | "wsf_eta";

/**
 * Persisted prediction row.
 */
export type ConvexPredictedDockEvent = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventPredictedTime: number;
  PredictionType: PredictionType;
  PredictionSource: ConvexPredictionSource;
  Actual?: number;
  DeltaTotal?: number;
  UpdatedAt: number;
};

/**
 * Row shape used inside prediction write batches.
 */
export type ConvexPredictedDockWriteRow = Omit<
  ConvexPredictedDockEvent,
  "UpdatedAt"
>;

/**
 * Batch write input for one vessel/day scope.
 */
export type ConvexPredictedDockWriteBatch = {
  VesselAbbrev: string;
  SailingDay: string;
  TargetKeys: string[];
  Rows: ConvexPredictedDockWriteRow[];
};

/**
 * Builds a stable dedupe and Map key for one predicted dock row.
 *
 * One boundary Key can host multiple prediction kinds (ML phases and ETA) and
 * sources; concatenating type and source with Key prevents collisions when
 * merging batches or comparing incoming rows to stored documents.
 *
 * @param row - Row or row-like object carrying Key, PredictionType, and PredictionSource
 * @returns Single string used as Map key and composite identity
 */
const predictedDockCompositeKey = (row: {
  Key: string;
  PredictionType: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionType}|${row.PredictionSource}`;

export { predictedDockCompositeKey };
