import { describe, expect, it, mock } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import {
  type PerVesselTripPersistInput,
  persistVesselTripWrites,
} from "../mutation/persistence/tripWrites";

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
  it("upserts active-only updates with no leave-dock follow-up", async () => {
    const existingTac = makeTrip("TAC", { AtDock: false });
    const updatedTac = makeTrip("TAC", {
      AtDock: true,
      LeftDockActual: undefined,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const input: PerVesselTripPersistInput = {
      vesselAbbrev: "TAC",
      existingActiveTrip: existingTac,
      activeVesselTrip: updatedTac,
      completedVesselTrip: undefined,
    };
    const deps = {
      completeAndStartNewTripInDb: mock(async () => {}),
      upsertActiveVesselTripInDb: mock(async () => {}),
      setDepartNextActualsForMostRecentCompletedTripInDb: mock(async () => ({
        updated: true as const,
      })),
    };
    await persistVesselTripWrites({} as never, input, deps);

    expect(deps.completeAndStartNewTripInDb).toHaveBeenCalledTimes(0);
    expect(deps.upsertActiveVesselTripInDb).toHaveBeenCalledTimes(1);
    expect(
      deps.setDepartNextActualsForMostRecentCompletedTripInDb
    ).toHaveBeenCalledTimes(0);
  });

  it("upserts active-only updates and runs leave-dock follow-up", async () => {
    const existingTac = makeTrip("TAC", { AtDock: true });
    const updatedTac = makeTrip("TAC", {
      AtDock: false,
      LeftDockActual: ms("2026-03-13T06:40:00-07:00"),
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const input: PerVesselTripPersistInput = {
      vesselAbbrev: "TAC",
      existingActiveTrip: existingTac,
      activeVesselTrip: updatedTac,
      completedVesselTrip: undefined,
    };

    const completeAndStartNewTripInDb = mock(async () => {});
    const upsertActiveVesselTripInDb = mock(async () => {});
    const leaveDockCalls: Array<{
      vesselAbbrev: string;
      actualDepartMs: number;
    }> = [];
    const setDepartNextActualsForMostRecentCompletedTripInDb = mock(
      async (_ctx: unknown, vesselAbbrev: string, actualDepartMs: number) => {
        leaveDockCalls.push({ vesselAbbrev, actualDepartMs });
        return { updated: true as const };
      }
    );
    await persistVesselTripWrites({} as never, input, {
      completeAndStartNewTripInDb,
      upsertActiveVesselTripInDb,
      setDepartNextActualsForMostRecentCompletedTripInDb,
    });

    expect(completeAndStartNewTripInDb).toHaveBeenCalledTimes(0);
    expect(upsertActiveVesselTripInDb).toHaveBeenCalledTimes(1);
    expect(leaveDockCalls).toHaveLength(1);
    expect(leaveDockCalls[0]?.vesselAbbrev).toBe("TAC");
  });

  it("completes and starts a replacement trip without active upsert", async () => {
    const existingChe = makeTrip("CHE", { AtDock: false });
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
    const input: PerVesselTripPersistInput = {
      vesselAbbrev: "CHE",
      existingActiveTrip: existingChe,
      activeVesselTrip: replacementChe,
      completedVesselTrip: completedChe,
    };

    const completeAndStartNewTripInDb = mock(
      async (
        _ctx: unknown,
        completedTrip: ConvexVesselTrip,
        newTrip: ConvexVesselTrip
      ) => {
        expect(completedTrip.VesselAbbrev).toBe("CHE");
        expect(newTrip.VesselAbbrev).toBe("CHE");
      }
    );
    const upsertActiveVesselTripInDb = mock(async () => {});
    const setDepartNextActualsForMostRecentCompletedTripInDb = mock(
      async () => ({
        updated: true as const,
      })
    );
    await persistVesselTripWrites({} as never, input, {
      completeAndStartNewTripInDb,
      upsertActiveVesselTripInDb,
      setDepartNextActualsForMostRecentCompletedTripInDb,
    });

    expect(completeAndStartNewTripInDb).toHaveBeenCalledTimes(1);
    expect(upsertActiveVesselTripInDb).toHaveBeenCalledTimes(0);
    expect(
      setDepartNextActualsForMostRecentCompletedTripInDb
    ).toHaveBeenCalledTimes(0);
  });
});
