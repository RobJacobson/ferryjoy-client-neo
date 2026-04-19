/**
 * Unit tests for `decideVesselTripPredictionUpsert`.
 */

import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import { decideVesselTripPredictionUpsert } from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";

const fakeId = "jd7abc123" as Id<"vesselTripPredictions">;

const makeProposal = (
  overrides: Partial<VesselTripPredictionProposal["prediction"]> = {}
): VesselTripPredictionProposal => ({
  VesselAbbrev: "CHE",
  TripKey: "trip-key-1",
  PredictionType: "AtDockDepartCurr",
  prediction: {
    PredTime: 1_000,
    MinTime: 900,
    MaxTime: 1_100,
    MAE: 2,
    StdDev: 1,
    ...overrides,
  },
});

const makeExistingDoc = (
  proposal: VesselTripPredictionProposal,
  predictionOverrides: Partial<VesselTripPredictionProposal["prediction"]> = {}
): Doc<"vesselTripPredictions"> => {
  const p = { ...proposal.prediction, ...predictionOverrides };
  return {
    _id: fakeId,
    _creationTime: 0,
    VesselAbbrev: proposal.VesselAbbrev,
    TripKey: proposal.TripKey,
    PredictionType: proposal.PredictionType,
    PredTime: p.PredTime,
    MinTime: p.MinTime,
    MaxTime: p.MaxTime,
    MAE: p.MAE,
    StdDev: p.StdDev,
    Actual: p.Actual,
    DeltaTotal: p.DeltaTotal,
    DeltaRange: p.DeltaRange,
    UpdatedAt: 100,
  };
};

describe("decideVesselTripPredictionUpsert", () => {
  it("inserts when no existing row", () => {
    const proposal = makeProposal();
    const decision = decideVesselTripPredictionUpsert(null, proposal, 500);
    expect(decision.type).toBe("insert");
    if (decision.type === "insert") {
      expect(decision.row.UpdatedAt).toBe(500);
      expect(decision.row.PredTime).toBe(proposal.prediction.PredTime);
    }
  });

  it("skips when overlay projection matches", () => {
    const proposal = makeProposal();
    const existing = makeExistingDoc(proposal);
    const decision = decideVesselTripPredictionUpsert(existing, proposal, 500);
    expect(decision.type).toBe("skip");
  });

  it("skips when only MAE differs", () => {
    const proposal = makeProposal();
    const existing = makeExistingDoc(proposal, { MAE: 999 });
    const decision = decideVesselTripPredictionUpsert(existing, proposal, 500);
    expect(decision.type).toBe("skip");
  });

  it("replaces when PredTime differs", () => {
    const proposal = makeProposal();
    const existing = makeExistingDoc(proposal, { PredTime: 9_999 });
    const decision = decideVesselTripPredictionUpsert(existing, proposal, 500);
    expect(decision.type).toBe("replace");
    if (decision.type === "replace") {
      expect(decision.existingId).toBe(fakeId);
      expect(decision.row.PredTime).toBe(proposal.prediction.PredTime);
    }
  });
});
