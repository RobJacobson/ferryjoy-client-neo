/**
 * Public barrel for vessel-trip ML prediction persistence (not ML model params).
 */

export * from "./mutations";
export {
  convexPredictionFromVesselTripPredictionRow,
  normalizeConvexPredictionForOverlayEquality,
  overlayPredictionProjectionsEqual,
} from "./predictionOverlayCompare";
export * from "./queries";
export * from "./schemas";
export {
  decideVesselTripPredictionUpsert,
  type VesselTripPredictionUpsertDecision,
  vesselTripPredictionUnchangedForPersist,
} from "./vesselTripPredictionPersistPlan";
