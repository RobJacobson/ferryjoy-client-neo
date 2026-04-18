/**
 * Unit tests for `planVesselTripPredictionWrite` compare-then-write planning.
 */

import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import { planVesselTripPredictionWrite } from "domain/vesselOrchestration/updateVesselPredictions";
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

describe("planVesselTripPredictionWrite", () => {
  it("inserts when no existing row", () => {
    const proposal = makeProposal();
    const plan = planVesselTripPredictionWrite(null, proposal, 500);
    expect(plan.type).toBe("insert");
    if (plan.type === "insert") {
      expect(plan.row.UpdatedAt).toBe(500);
      expect(plan.row.PredTime).toBe(proposal.prediction.PredTime);
    }
  });

  it("skips when overlay projection matches", () => {
    const proposal = makeProposal();
    const existing = makeExistingDoc(proposal);
    const plan = planVesselTripPredictionWrite(existing, proposal, 500);
    expect(plan.type).toBe("skip");
  });

  it("skips when only MAE differs", () => {
    const proposal = makeProposal();
    const existing = makeExistingDoc(proposal, { MAE: 999 });
    const plan = planVesselTripPredictionWrite(existing, proposal, 500);
    expect(plan.type).toBe("skip");
  });

  it("replaces when PredTime differs", () => {
    const proposal = makeProposal();
    const existing = makeExistingDoc(proposal, { PredTime: 9_999 });
    const plan = planVesselTripPredictionWrite(existing, proposal, 500);
    expect(plan.type).toBe("replace");
    if (plan.type === "replace") {
      expect(plan.existingId).toBe(fakeId);
      expect(plan.row.PredTime).toBe(proposal.prediction.PredTime);
    }
  });
});
