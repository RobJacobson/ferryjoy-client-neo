/// <reference path="../../../src/bun-test.d.ts" />

import { describe, expect, it } from "bun:test";
import type { Doc } from "_generated/dataModel";
import type { Vessel } from "../vessels/schemas";
import { buildBackendVesselUpsertOperations } from "./mutations";

describe("buildBackendVesselUpsertOperations", () => {
  it("replaces an existing vessel when the abbreviation matches", () => {
    const result = buildBackendVesselUpsertOperations(
      [makeStoredVessel({ VesselAbbrev: "CHE", VesselID: 1 })],
      [makeIncomingVessel({ VesselAbbrev: "CHE", VesselID: 2 })]
    );

    expect(result.toInsert).toHaveLength(0);
    expect(result.toReplace).toHaveLength(1);
    expect(result.toReplace[0]?.existing.VesselID).toBe(1);
    expect(result.toReplace[0]?.incoming.VesselID).toBe(2);
  });

  it("inserts a new vessel when the abbreviation is new", () => {
    const result = buildBackendVesselUpsertOperations(
      [makeStoredVessel({ VesselAbbrev: "CHE" })],
      [makeIncomingVessel({ VesselAbbrev: "TAC" })]
    );

    expect(result.toInsert).toHaveLength(1);
    expect(result.toInsert[0]?.VesselAbbrev).toBe("TAC");
    expect(result.toReplace).toHaveLength(0);
  });

  it("does not delete existing vessels missing from the latest snapshot", () => {
    const existing = [
      makeStoredVessel({ VesselAbbrev: "CHE" }),
      makeStoredVessel({ VesselAbbrev: "TAC" }),
    ];
    const result = buildBackendVesselUpsertOperations(existing, [
      makeIncomingVessel({ VesselAbbrev: "CHE" }),
    ]);

    expect(result.toInsert).toHaveLength(0);
    expect(result.toReplace).toHaveLength(1);
    expect(existing).toHaveLength(2);
  });
});

const makeStoredVessel = (
  overrides: Partial<Vessel> = {}
): Doc<"vessels"> =>
  ({
    _id: "vessels:test" as Doc<"vessels">["_id"],
    _creationTime: 0,
    VesselID: 1,
    VesselName: "Chelan",
    VesselAbbrev: "CHE",
    UpdatedAt: 1,
    ...overrides,
  }) as Doc<"vessels">;

const makeIncomingVessel = (overrides: Partial<Vessel> = {}): Vessel => ({
  VesselID: 1,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  UpdatedAt: 1,
  ...overrides,
});
