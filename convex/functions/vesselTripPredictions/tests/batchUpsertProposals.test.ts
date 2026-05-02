/**
 * Exercises batch upsert stats by delegating to the same upsert decision the
 * mutation uses (no Convex runtime).
 */

import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import { decideVesselTripPredictionUpsert } from "functions/vesselTripPredictions";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";

const proposal = (): VesselTripPredictionProposal => ({
  VesselAbbrev: "CHE",
  TripKey: "tk-1",
  PredictionType: "AtSeaArriveNext",
  prediction: {
    PredTime: 100,
    MinTime: 90,
    MaxTime: 110,
    MAE: 1,
    StdDev: 1,
  },
});

/**
 * Simulates `batchUpsertProposals` counting logic for assertions.
 *
 * @param existingByKey - Preloaded row per natural key, or null
 * @param proposals - Batch input
 * @param now - Clock for UpdatedAt
 */
const simulateBatchStats = (
  existingByKey: Map<string, Doc<"vesselTripPredictions"> | null>,
  proposals: VesselTripPredictionProposal[],
  now: number
): { skipped: number; inserted: number; replaced: number } => {
  let skipped = 0;
  let inserted = 0;
  let replaced = 0;

  for (const p of proposals) {
    const key = `${p.VesselAbbrev}|${p.TripKey}|${p.PredictionType}`;
    const existing = existingByKey.get(key) ?? null;
    const decision = decideVesselTripPredictionUpsert(existing, p, now);
    if (decision.type === "skip") {
      skipped++;
    } else if (decision.type === "insert") {
      inserted++;
    } else {
      replaced++;
    }
  }

  return { skipped, inserted, replaced };
};

describe("batch upsert stats (simulated)", () => {
  it("counts one insert for a new key", () => {
    const p = proposal();
    const stats = simulateBatchStats(new Map(), [p], 1);
    expect(stats).toEqual({ skipped: 0, inserted: 1, replaced: 0 });
  });

  it("counts skip on identical repeat", () => {
    const p = proposal();
    const key = `${p.VesselAbbrev}|${p.TripKey}|${p.PredictionType}`;
    const existing: Doc<"vesselTripPredictions"> = {
      _id: "abc123" as Id<"vesselTripPredictions">,
      _creationTime: 0,
      VesselAbbrev: p.VesselAbbrev,
      TripKey: p.TripKey,
      PredictionType: p.PredictionType,
      ...p.prediction,
      UpdatedAt: 0,
    };
    const map = new Map<string, Doc<"vesselTripPredictions"> | null>([
      [key, existing],
    ]);
    const stats = simulateBatchStats(map, [p], 2);
    expect(stats).toEqual({ skipped: 1, inserted: 0, replaced: 0 });
  });

  it("counts all skips when many identical proposals repeat (recompute + diff)", () => {
    const p = proposal();
    const key = `${p.VesselAbbrev}|${p.TripKey}|${p.PredictionType}`;
    const existing: Doc<"vesselTripPredictions"> = {
      _id: "abc123" as Id<"vesselTripPredictions">,
      _creationTime: 0,
      VesselAbbrev: p.VesselAbbrev,
      TripKey: p.TripKey,
      PredictionType: p.PredictionType,
      ...p.prediction,
      UpdatedAt: 0,
    };
    const map = new Map<string, Doc<"vesselTripPredictions"> | null>([
      [key, existing],
    ]);
    const proposals = Array.from({ length: 12 }, () => ({ ...p }));
    const stats = simulateBatchStats(map, proposals, 2);
    expect(stats).toEqual({ skipped: 12, inserted: 0, replaced: 0 });
  });

  it("counts replace when overlay PredTime changes", () => {
    const p = proposal();
    const key = `${p.VesselAbbrev}|${p.TripKey}|${p.PredictionType}`;
    const existing: Doc<"vesselTripPredictions"> = {
      _id: "abc123" as Id<"vesselTripPredictions">,
      _creationTime: 0,
      VesselAbbrev: p.VesselAbbrev,
      TripKey: p.TripKey,
      PredictionType: p.PredictionType,
      ...p.prediction,
      PredTime: 1,
      UpdatedAt: 0,
    };
    const map = new Map<string, Doc<"vesselTripPredictions"> | null>([
      [key, existing],
    ]);
    const stats = simulateBatchStats(map, [p], 2);
    expect(stats).toEqual({ skipped: 0, inserted: 0, replaced: 1 });
  });
});
