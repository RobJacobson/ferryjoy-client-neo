import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { appendFinalSchedule } from "../appendSchedule";

describe("appendFinalSchedule", () => {
  it("prefers the exact next scheduled trip from the prior trip context during rollover", async () => {
    const previousScheduledSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--09:30--MUK-CLI",
      NextKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextDepartingTime: ms("2026-03-13T11:00:00-07:00"),
    });
    const delayedNextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: "MUK",
      DepartingTime: ms("2026-03-13T11:00:00-07:00"),
      NextKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const laterSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: "MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const ctx = createTestActionCtx({
      scheduledSegmentByKey: new Map([
        [previousScheduledSegment.Key, previousScheduledSegment],
        [delayedNextSegment.Key, delayedNextSegment],
      ]),
      inferredScheduledSegment: laterSegment,
    });
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      Key: previousScheduledSegment.Key,
      ScheduledDeparture: previousScheduledSegment.DepartingTime,
      NextKey: delayedNextSegment.Key,
      NextScheduledDeparture: delayedNextSegment.DepartingTime,
    });
    const baseTrip = makeTrip({
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: undefined,
      Key: undefined,
      SailingDay: undefined,
      ScheduledDeparture: undefined,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T11:08:00-07:00"),
    });

    const enriched = await appendFinalSchedule(
      ctx as never,
      baseTrip,
      existingTrip
    );

    expect(enriched.Key).toBe(delayedNextSegment.Key);
    expect(enriched.ScheduledDeparture).toBe(delayedNextSegment.DepartingTime);
    expect(enriched.ArrivingTerminalAbbrev).toBe(
      delayedNextSegment.ArrivingTerminalAbbrev
    );
    expect(enriched.NextKey).toBe(delayedNextSegment.NextKey);
    expect(enriched.NextScheduledDeparture).toBe(
      delayedNextSegment.NextDepartingTime
    );
  });

  it("falls back to the first surviving trip after the previous scheduled departure when NextKey is unavailable", async () => {
    const rolloverSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: "MUK",
      DepartingTime: ms("2026-03-13T11:00:00-07:00"),
      NextKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const laterSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--13:00--CLI-MUK",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: "MUK",
      DepartingTime: ms("2026-03-13T13:00:00-07:00"),
    });
    const ctx = createTestActionCtx({
      rolloverScheduledSegment: rolloverSegment,
      inferredScheduledSegment: laterSegment,
    });
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      Key: "CHE--2026-03-13--09:30--MUK-CLI",
      ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
      NextKey: undefined,
      NextScheduledDeparture: undefined,
    });
    const baseTrip = makeTrip({
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: undefined,
      Key: undefined,
      SailingDay: undefined,
      ScheduledDeparture: undefined,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T11:08:00-07:00"),
    });

    const enriched = await appendFinalSchedule(
      ctx as never,
      baseTrip,
      existingTrip
    );

    expect(enriched.Key).toBe(rolloverSegment.Key);
    expect(enriched.ScheduledDeparture).toBe(rolloverSegment.DepartingTime);
    expect(enriched.ArrivingTerminalAbbrev).toBe(
      rolloverSegment.ArrivingTerminalAbbrev
    );
  });

  it("infers the next trip from schedule when a docked trip has no key", async () => {
    const scheduledSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--07:00--ORI-LOP",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      DepartingTime: ms("2026-03-13T07:00:00-07:00"),
      NextKey: "CHE--2026-03-13--08:30--LOP-ORI",
      NextDepartingTime: ms("2026-03-13T08:30:00-07:00"),
    });
    const ctx = createTestActionCtx({
      inferredScheduledSegment: scheduledSegment,
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

    expect(enriched.Key).toBe(scheduledSegment.Key);
    expect(enriched.SailingDay).toBe(scheduledSegment.SailingDay);
    expect(enriched.ScheduledDeparture).toBe(scheduledSegment.DepartingTime);
    expect(enriched.ArrivingTerminalAbbrev).toBe(
      scheduledSegment.ArrivingTerminalAbbrev
    );
    expect(enriched.NextKey).toBe(scheduledSegment.NextKey);
    expect(enriched.NextScheduledDeparture).toBe(
      scheduledSegment.NextDepartingTime
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
  inferredScheduledSegment?: InferredScheduledSegment | null;
  rolloverScheduledSegment?: InferredScheduledSegment | null;
  scheduledSegmentByKey?: Map<string, InferredScheduledSegment>;
}): TestActionCtx => ({
  runQuery: async (_ref, args) => {
    if (args && "segmentKey" in args) {
      return args.segmentKey && options.scheduledSegmentByKey
        ? (options.scheduledSegmentByKey.get(String(args.segmentKey)) ?? null)
        : null;
    }

    if (args && "previousScheduledDeparture" in args) {
      return options.rolloverScheduledSegment ?? null;
    }

    if (args && "arrivalTime" in args) {
      return options.inferredScheduledSegment ?? null;
    }

    return null;
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

type InferredScheduledSegment = {
  Key: string;
  SailingDay: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  NextKey?: string;
  NextDepartingTime?: number;
};

const makeScheduledSegment = (
  overrides: Partial<InferredScheduledSegment> = {}
): InferredScheduledSegment => ({
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  DepartingTime: ms("2026-03-13T05:30:00-07:00"),
  NextKey: undefined,
  NextDepartingTime: undefined,
  ...overrides,
});
