import { describe, expect, it } from "bun:test";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { appendFinalSchedule } from "../appendSchedule";

describe("appendFinalSchedule", () => {
  it("infers the next trip from schedule when a docked trip has no key", async () => {
    const scheduledTrip = makeScheduledTrip({
      Key: "CHE--2026-03-13--07:00--ORI-LOP",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      DepartingTime: ms("2026-03-13T07:00:00-07:00"),
      NextKey: "CHE--2026-03-13--08:30--LOP-ORI",
      NextDepartingTime: ms("2026-03-13T08:30:00-07:00"),
    });
    const ctx = createTestActionCtx({
      inferredScheduledTrip: scheduledTrip,
    });
    const baseTrip = makeTrip({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      Key: undefined,
      SailingDay: undefined,
      ScheduledDeparture: undefined,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const enriched = await appendFinalSchedule(
      ctx as never,
      baseTrip,
      undefined
    );

    expect(enriched.Key).toBe(scheduledTrip.Key);
    expect(enriched.SailingDay).toBe(scheduledTrip.SailingDay);
    expect(enriched.ScheduledDeparture).toBe(scheduledTrip.DepartingTime);
    expect(enriched.ArrivingTerminalAbbrev).toBe(
      scheduledTrip.ArrivingTerminalAbbrev
    );
    expect(enriched.NextKey).toBe(scheduledTrip.NextKey);
    expect(enriched.NextScheduledDeparture).toBe(
      scheduledTrip.NextDepartingTime
    );
  });

  it("keeps a first-seen docked trip without TripStart when no schedule match exists", async () => {
    const ctx = createTestActionCtx({});
    const baseTrip = makeTrip({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      Key: undefined,
      SailingDay: undefined,
      ScheduledDeparture: undefined,
      TripStart: undefined,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const enriched = await appendFinalSchedule(
      ctx as never,
      baseTrip,
      undefined
    );

    expect(enriched.Key).toBeUndefined();
    expect(enriched.TripStart).toBeUndefined();
    expect(enriched.ScheduledDeparture).toBeUndefined();
    expect(enriched.ArrivingTerminalAbbrev).toBeUndefined();
  });
});

type TestActionCtx = {
  runQuery: (ref: unknown, args?: Record<string, unknown>) => Promise<unknown>;
};

const createTestActionCtx = (options: {
  inferredScheduledTrip?: ConvexScheduledTrip | null;
  scheduledTripByKey?: ConvexScheduledTrip | null;
}): TestActionCtx => ({
  runQuery: async (_ref, args) => {
    if (args && "arrivalTime" in args) {
      return options.inferredScheduledTrip ?? null;
    }

    return options.scheduledTripByKey ?? null;
  },
});

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T04:33:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextKey: undefined,
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

const makeScheduledTrip = (
  overrides: Partial<ConvexScheduledTrip> = {}
): ConvexScheduledTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  DepartingTime: ms("2026-03-13T05:30:00-07:00"),
  ArrivingTime: ms("2026-03-13T06:30:00-07:00"),
  SailingNotes: "",
  Annotations: [],
  RouteID: 1,
  RouteAbbrev: "ana-sj",
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  TripType: "direct",
  DirectKey: undefined,
  PrevKey: undefined,
  NextKey: undefined,
  NextDepartingTime: undefined,
  EstArriveNext: undefined,
  EstArriveCurr: undefined,
  SchedArriveNext: undefined,
  SchedArriveCurr: undefined,
  ...overrides,
});
