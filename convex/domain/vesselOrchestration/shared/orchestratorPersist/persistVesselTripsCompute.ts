/**
 * Legacy compatibility shim for the former domain-owned persist entrypoint.
 *
 * S10 moves trip-table mutation application into `functions/vesselOrchestrator`;
 * domain code keeps the serializable write-set builders only.
 */

export {
  persistVesselTripsCompute,
  persistVesselTripWriteSet,
  type VesselTripTableMutations,
  type VesselTripUpsertBatchResult,
} from "functions/vesselOrchestrator/persistVesselTripWriteSet";
