/**
 * Insert / replace / skip for `vesselTripPredictions` upserts (overlay equality).
 */

import type { Doc, Id } from "_generated/dataModel";
import {
  convexPredictionFromVesselTripPredictionRow,
  overlayPredictionProjectionsEqual,
} from "./predictionOverlayCompare";
import type {
  VesselTripPredictionProposal,
  VesselTripPredictionStored,
} from "./schemas";

/**
 * Returns whether a stored prediction row matches the proposed ML payload.
 *
 * Converts the existing row with `convexPredictionFromVesselTripPredictionRow`,
 * then compares via `overlayPredictionProjectionsEqual` to honor overlay rules.
 *
 * @param existing - Current DB row, or `null` when none exists
 * @param proposed - Incoming ML payload for this slot
 * @returns `true` when overlay projection matches (skip write)
 */
export const vesselTripPredictionUnchangedForPersist = (
  existing: Doc<"vesselTripPredictions"> | null,
  proposed: VesselTripPredictionProposal["prediction"]
): boolean => {
  if (existing === null) {
    return false;
  }
  return overlayPredictionProjectionsEqual(
    convexPredictionFromVesselTripPredictionRow(existing),
    proposed
  );
};

export type VesselTripPredictionUpsertDecision =
  | { type: "skip" }
  | { type: "insert"; row: VesselTripPredictionStored }
  | {
      type: "replace";
      existingId: Id<"vesselTripPredictions">;
      row: VesselTripPredictionStored;
    };

/**
 * Decides insert, replace, or skip for one vessel-trip prediction proposal.
 *
 * Skips when `vesselTripPredictionUnchangedForPersist` is true; otherwise builds
 * the stored row shape with the shared `updatedAt` timestamp.
 *
 * @param existing - Loaded row for this natural key, if any
 * @param proposal - Vessel, trip, field, and ML blob
 * @param updatedAt - Epoch ms for `UpdatedAt` (mutation clock)
 * @returns Skip, insert, or replace decision for the proposal
 */
export const decideVesselTripPredictionUpsert = (
  existing: Doc<"vesselTripPredictions"> | null,
  proposal: VesselTripPredictionProposal,
  updatedAt: number
): VesselTripPredictionUpsertDecision => {
  if (vesselTripPredictionUnchangedForPersist(existing, proposal.prediction)) {
    return { type: "skip" };
  }

  const row = {
    VesselAbbrev: proposal.VesselAbbrev,
    TripKey: proposal.TripKey,
    PredictionType: proposal.PredictionType,
    PredTime: proposal.prediction.PredTime,
    MinTime: proposal.prediction.MinTime,
    MaxTime: proposal.prediction.MaxTime,
    MAE: proposal.prediction.MAE,
    StdDev: proposal.prediction.StdDev,
    Actual: proposal.prediction.Actual,
    DeltaTotal: proposal.prediction.DeltaTotal,
    DeltaRange: proposal.prediction.DeltaRange,
    UpdatedAt: updatedAt,
  };

  if (existing === null) {
    return { type: "insert", row };
  }

  return { type: "replace", existingId: existing._id, row };
};
