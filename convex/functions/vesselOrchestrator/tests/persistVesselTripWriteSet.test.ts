import { describe, expect, it, spyOn } from "bun:test";
import * as vesselTripMutations from "functions/vesselTrips/mutations";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import {
  buildVesselTripWrites,
  persistVesselTripWrites,
} from "../persistVesselTripWriteSet";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: vesselAbbrev,
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
  ArrivedCurrActual: ms("2026-03-13T04:33:00-07:00"),
  ArrivedNextActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  EndTime: undefined,
  StartTime: ms("2026-03-13T04:33:00-07:00"),
  AtDockActual: ms("2026-03-13T04:33:00-07:00"),
  ...overrides,
});

describe("persistVesselTripWrites", () => {
  it("returns completed facts and current messages from arrays-only rows", async () => {
    const existingChe = makeTrip("CHE", { AtDock: false });
    const existingTac = makeTrip("TAC", { AtDock: true });
    const completedChe = makeTrip("CHE", {
      TripEnd: ms("2026-03-13T06:45:00-07:00"),
      ArrivedNextActual: ms("2026-03-13T06:45:00-07:00"),
      ArriveDest: ms("2026-03-13T06:45:00-07:00"),
    });
    const replacementChe = makeTrip("CHE", {
      TripKey: generateTripKey("CHE", ms("2026-03-13T06:46:00-07:00")),
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
      ArrivedCurrActual: ms("2026-03-13T06:46:00-07:00"),
      ArrivedNextActual: undefined,
    });
    const updatedTac = makeTrip("TAC", {
      AtDock: false,
      LeftDockActual: ms("2026-03-13T06:40:00-07:00"),
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });

    const completeCalls: Array<{
      completedTrip: ConvexVesselTrip;
      newTrip: ConvexVesselTrip;
    }> = [];
    const upsertCalls: ConvexVesselTrip[][] = [];
    const leaveDockCalls: Array<{
      vesselAbbrev: string;
      actualDepartMs: number;
    }> = [];
    const tripWrites = buildVesselTripWrites(
      {
        completedTrips: [completedChe],
        activeTrips: [replacementChe, updatedTac],
      },
      [existingChe, existingTac]
    );

    const completeSpy = spyOn(
      vesselTripMutations,
      "completeAndStartNewTripInDb"
    ).mockImplementation(async (_ctx, completedTrip, newTrip) => {
      completeCalls.push({ completedTrip, newTrip });
      return;
    });
    const upsertSpy = spyOn(
      vesselTripMutations,
      "upsertVesselTripsBatchInDb"
    ).mockImplementation(async (_ctx, activeUpserts) => {
      upsertCalls.push(activeUpserts);
      return {
        perVessel: activeUpserts.map((trip) => ({
          vesselAbbrev: trip.VesselAbbrev,
          ok: true,
        })),
      };
    });
    const leaveDockSpy = spyOn(
      vesselTripMutations,
      "setDepartNextActualsForMostRecentCompletedTripInDb"
    ).mockImplementation(async (_ctx, vesselAbbrev, actualDepartMs) => {
      leaveDockCalls.push({ vesselAbbrev, actualDepartMs });
      return { updated: true };
    });

    let result: Awaited<ReturnType<typeof persistVesselTripWrites>> | null = null;
    try {
      result = await persistVesselTripWrites({} as never, tripWrites);
    } finally {
      completeSpy.mockRestore();
      upsertSpy.mockRestore();
      leaveDockSpy.mockRestore();
    }
    if (result === null) {
      throw new Error("Expected persistVesselTripWrites to return a result.");
    }

    expect(completeCalls).toHaveLength(1);
    expect(completeCalls[0]?.completedTrip.VesselAbbrev).toBe("CHE");
    expect(completeCalls[0]?.newTrip.VesselAbbrev).toBe("CHE");

    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]?.map((trip) => trip.VesselAbbrev)).toEqual(["TAC"]);

    expect(result.completedFacts).toHaveLength(1);
    expect(result.currentBranch.pendingActualMessages).toHaveLength(1);
    expect(result.currentBranch.pendingPredictedMessages).toHaveLength(1);
    expect(result.currentBranch.successfulVessels.has("TAC")).toBe(true);
    expect(leaveDockCalls).toHaveLength(1);
    expect(leaveDockCalls[0]?.vesselAbbrev).toBe("TAC");
  });

  it("skips leave-dock actualization when active upsert fails", async () => {
    const existingTac = makeTrip("TAC", { AtDock: true });
    const updatedTac = makeTrip("TAC", {
      AtDock: false,
      LeftDockActual: ms("2026-03-13T06:40:00-07:00"),
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const leaveDockCalls: Array<{
      vesselAbbrev: string;
      actualDepartMs: number;
    }> = [];

    const tripWrites = buildVesselTripWrites(
      {
        completedTrips: [],
        activeTrips: [updatedTac],
      },
      [existingTac]
    );

    const completeSpy = spyOn(
      vesselTripMutations,
      "completeAndStartNewTripInDb"
    ).mockImplementation(async () => {});
    const upsertSpy = spyOn(
      vesselTripMutations,
      "upsertVesselTripsBatchInDb"
    ).mockImplementation(async () => ({
      perVessel: [{ vesselAbbrev: "TAC", ok: false, reason: "boom" }],
    }));
    const leaveDockSpy = spyOn(
      vesselTripMutations,
      "setDepartNextActualsForMostRecentCompletedTripInDb"
    ).mockImplementation(async (_ctx, vesselAbbrev, actualDepartMs) => {
      leaveDockCalls.push({ vesselAbbrev, actualDepartMs });
      return { updated: true };
    });

    try {
      await persistVesselTripWrites({} as never, tripWrites);
    } finally {
      completeSpy.mockRestore();
      upsertSpy.mockRestore();
      leaveDockSpy.mockRestore();
    }

    expect(leaveDockCalls).toHaveLength(0);
  });
});
