/**
 * Tests {@link performBulkUpsertVesselLocations}: one table read, AtDockObserved,
 * timestamp dedupe.
 */

import { describe, expect, it, mock } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { withAtDockObserved } from "domain/vesselOrchestration/updateVesselLocations";
import type { ConvexVesselLocationIncoming } from "functions/vesselLocation/schemas";
import { performBulkUpsertVesselLocations } from "../mutations";

describe("performBulkUpsertVesselLocations", () => {
  it("computes AtDockObserved consistently with withAtDockObserved on insert", async () => {
    const incoming = [makeIncomingLocation({ AtDock: true, Speed: 0.2 })];
    const insertMock = mock(async () => "jx7insert" as Id<"vesselLocations">);
    const ctx = createMutationCtx([], { insert: insertMock });

    const result = await performBulkUpsertVesselLocations(ctx, incoming);
    const expected = withAtDockObserved(incoming);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(result.changedLocations).toHaveLength(1);
    expect(result.changedLocations[0]?.AtDockObserved).toBe(
      expected[0]?.AtDockObserved
    );
    expect(result.summary.inserted).toBe(1);
    expect(result.summary.unchanged).toBe(0);
  });

  it("skips write when TimeStamp is unchanged", async () => {
    const incoming = makeIncomingLocation();
    const storedId = "jx7stored" as Id<"vesselLocations">;
    const stored: Doc<"vesselLocations"> = {
      _id: storedId,
      _creationTime: 1000,
      ...incoming,
      AtDockObserved: true,
    };

    const replaceMock = mock(async () => {});
    const insertMock = mock(async () => "jx7no" as Id<"vesselLocations">);
    const ctx = createMutationCtx([stored], {
      replace: replaceMock,
      insert: insertMock,
    });

    const result = await performBulkUpsertVesselLocations(ctx, [incoming]);

    expect(replaceMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(result.changedLocations).toHaveLength(0);
    expect(result.summary.unchanged).toBe(1);
  });

  it("replaces when TimeStamp changes", async () => {
    const incoming = makeIncomingLocation({
      TimeStamp: 1710000009999,
    });
    const storedId = "jx7stored" as Id<"vesselLocations">;
    const stored: Doc<"vesselLocations"> = {
      _id: storedId,
      _creationTime: 1000,
      ...makeIncomingLocation({ TimeStamp: 1710000005000 }),
      AtDockObserved: false,
    };

    const replaceMock = mock(async () => {});
    const ctx = createMutationCtx([stored], { replace: replaceMock });

    const result = await performBulkUpsertVesselLocations(ctx, [incoming]);

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(result.changedLocations).toHaveLength(1);
    expect(result.summary.replaced).toBe(1);
  });
});

const createMutationCtx = (
  existingDocs: Doc<"vesselLocations">[],
  mocks: {
    replace?: ReturnType<typeof mock>;
    insert?: ReturnType<typeof mock>;
  } = {}
): MutationCtx => {
  const replaceMock = mocks.replace ?? mock(async () => {});
  const insertMock =
    mocks.insert ??
    mock(async () => "jx7defaultinsert" as Id<"vesselLocations">);

  return {
    db: {
      query: (_table: "vesselLocations") => ({
        collect: async () => existingDocs,
      }),
      replace: replaceMock,
      insert: insertMock,
    },
  } as unknown as MutationCtx;
};

const makeIncomingLocation = (
  overrides: Partial<ConvexVesselLocationIncoming> = {}
): ConvexVesselLocationIncoming => ({
  VesselID: 1,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 15,
  ArrivingTerminalName: "Orcas Island",
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48.5,
  Longitude: -122.6,
  Speed: 12,
  Heading: 180,
  InService: true,
  AtDock: false,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: 1710000000000,
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: 1710000005000,
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  DepartingDistance: 0.1,
  ArrivingDistance: 10.2,
  ...overrides,
});
