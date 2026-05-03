/**
 * Trip read-model helpers: prediction merge and trip-key dedupe for queries.
 *
 * Used by `vesselTrips` public queries and orchestrator-facing reads; keeps
 * enrichment and batch shaping out of handler bodies.
 */

export {
  dedupeTripDocBatchesByTripKey,
  dedupeTripDocsByTripKey,
} from "./dedupeTripDocsByTripKey";
export { mergeTripsWithPredictions } from "./mergeTripsWithPredictions";
