import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { resolveEffectiveLocation } from "../tripLifecycle/resolveEffectiveLocation";

describe("resolveEffectiveLocation", () => {
  it("reuses the active trip identity without schedule lookups on steady-state docked ticks", async () => {
    let queryCount = 0;
    const location = makeLocation({
      Key: undefined,
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
    });
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
    });

    const effectiveLocation = await resolveEffectiveLocation(
      {
        runQuery: async () => {
          queryCount += 1;
          return null;
        },
      } as never,
      location,
      existingTrip
    );

    expect(queryCount).toBe(0);
    expect(effectiveLocation.Key).toBe(existingTrip.Key);
    expect(effectiveLocation.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
    expect(effectiveLocation.ScheduledDeparture).toBe(
      existingTrip.ScheduledDeparture
    );
  });

  it("prefers the carried NextKey when it matches the current departing terminal", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
      ArrivingTerminalAbbrev: "MUK",
      DepartingTime: ms("2026-03-13T11:00:00-07:00"),
    });
    const queryArgs: Array<Record<string, unknown> | undefined> = [];
    const effectiveLocation = await resolveEffectiveLocation(
      {
        runQuery: async (_ref: unknown, args?: Record<string, unknown>) => {
          queryArgs.push(args);
          if (args && "segmentKey" in args) {
            return nextSegment;
          }
          return null;
        },
      } as never,
      makeLocation({
        Key: undefined,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      makeTrip({
        DepartingTerminalAbbrev: "MUK",
        NextKey: nextSegment.Key,
      })
    );

    expect(queryArgs).toHaveLength(1);
    expect(queryArgs[0]).toEqual({ segmentKey: nextSegment.Key });
    expect(effectiveLocation.Key).toBe(nextSegment.Key);
    expect(effectiveLocation.ArrivingTerminalAbbrev).toBe(
      nextSegment.ArrivingTerminalAbbrev
    );
    expect(effectiveLocation.ScheduledDeparture).toBe(
      nextSegment.DepartingTime
    );
  });

  it("skips schedule lookups for a first-seen keyless docked trip without continuity hints", async () => {
    let queryCount = 0;
    const effectiveLocation = await resolveEffectiveLocation(
      {
        runQuery: async () => {
          queryCount += 1;
          return null;
        },
      } as never,
      makeLocation({
        Key: undefined,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      undefined
    );

    expect(queryCount).toBe(0);
    expect(effectiveLocation.Key).toBeUndefined();
    expect(effectiveLocation.ArrivingTerminalAbbrev).toBeUndefined();
    expect(effectiveLocation.ScheduledDeparture).toBeUndefined();
  });
});

const ms = (iso: string) => new Date(iso).getTime();

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Clinton",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Mukilteo",
  ArrivingTerminalAbbrev: "MUK",
  Latitude: 47.98,
  Longitude: -122.35,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  RouteAbbrev: "muk-cl",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  Key: "CHE--2026-03-13--11:00--CLI-MUK",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  RouteAbbrev: "muk-cl",
  Key: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "MUK",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T10:30:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  NextKey: undefined,
  NextScheduledDeparture: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  PrevLeftDock: ms("2026-03-13T09:34:00-07:00"),
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
  Key: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  DepartingTime: ms("2026-03-13T11:00:00-07:00"),
  NextKey: undefined,
  NextDepartingTime: undefined,
  ...overrides,
});
