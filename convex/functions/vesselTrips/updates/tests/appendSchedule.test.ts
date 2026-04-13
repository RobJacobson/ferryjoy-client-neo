import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { appendFinalSchedule } from "../tripLifecycle/appendSchedule";

describe("appendFinalSchedule", () => {
  it("reuses existing next-trip schedule fields when the trip key is unchanged", async () => {
    const existingTrip = makeTrip({
      Key: "CHE--2026-03-13--09:30--MUK-CLI",
      NextKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
    });
    const baseTrip = makeTrip({
      Key: existingTrip.Key,
      NextKey: undefined,
      NextScheduledDeparture: undefined,
    });

    const enriched = await appendFinalSchedule(
      createTestActionCtx({}) as never,
      baseTrip,
      existingTrip
    );

    expect(enriched.NextKey).toBe(existingTrip.NextKey);
    expect(enriched.NextScheduledDeparture).toBe(
      existingTrip.NextScheduledDeparture
    );
  });

  it("loads the next-trip schedule fields when the trip key changed", async () => {
    const scheduledSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
      NextKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const baseTrip = makeTrip({
      Key: scheduledSegment.Key,
      NextKey: undefined,
      NextScheduledDeparture: undefined,
    });

    const enriched = await appendFinalSchedule(
      createTestActionCtx({
        scheduledSegmentByKey: new Map([
          [scheduledSegment.Key, scheduledSegment],
        ]),
      }) as never,
      baseTrip,
      makeTrip({ Key: "CHE--2026-03-13--09:30--MUK-CLI" })
    );

    expect(enriched.ScheduleKey).toBe(scheduledSegment.Key);
    expect(enriched.NextKey).toBe(scheduledSegment.NextKey);
    expect(enriched.NextScheduledDeparture).toBe(
      scheduledSegment.NextDepartingTime
    );
  });

  it("keeps keyless docked trips unchanged when no key is available", async () => {
    const baseTrip = makeTrip({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      Key: undefined,
      SailingDay: undefined,
      ScheduledDeparture: undefined,
      TripStart: undefined,
      LeftDock: undefined,
    });

    const enriched = await appendFinalSchedule(
      createTestActionCtx({}) as never,
      baseTrip,
      undefined
    );

    expect(enriched.Key).toBeUndefined();
    expect(enriched.ScheduledDeparture).toBeUndefined();
    expect(enriched.ArrivingTerminalAbbrev).toBeUndefined();
    expect(enriched.NextKey).toBeUndefined();
    expect(enriched.NextScheduledDeparture).toBeUndefined();
  });
});

type TestActionCtx = {
  runQuery: (ref: unknown, args?: Record<string, unknown>) => Promise<unknown>;
};

const createTestActionCtx = (options: {
  scheduledSegmentByKey?: Map<string, InferredScheduledSegment>;
}): TestActionCtx => ({
  runQuery: async (_ref, args) => {
    if (args && "segmentKey" in args) {
      return args.segmentKey && options.scheduledSegmentByKey
        ? (options.scheduledSegmentByKey.get(String(args.segmentKey)) ?? null)
        : null;
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
