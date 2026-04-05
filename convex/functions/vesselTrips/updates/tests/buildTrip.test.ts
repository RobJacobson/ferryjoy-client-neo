import { describe, expect, it } from "bun:test";
import type { ResolvedVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildTrip } from "../buildTrip";
import type { TripEvents } from "../eventDetection";

describe("buildTrip", () => {
  it("clears carried prediction state when the trip key changes", async () => {
    const existingTrip = makeTrip({
      Key: "CHE--2026-03-13--09:30--ORI-LOP",
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
      NextKey: "CHE--2026-03-13--10:15--LOP-ANA",
      NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
      LeftDock: ms("2026-03-13T09:34:00-07:00"),
      AtDock: false,
      AtDockDepartCurr: makePrediction(ms("2026-03-13T09:36:00-07:00")),
      AtDockArriveNext: makePrediction(ms("2026-03-13T10:05:00-07:00")),
      AtDockDepartNext: makePrediction(ms("2026-03-13T10:22:00-07:00")),
      AtSeaArriveNext: makePrediction(ms("2026-03-13T10:04:00-07:00")),
      AtSeaDepartNext: makePrediction(ms("2026-03-13T10:20:00-07:00")),
    });
    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "ANA",
      ScheduledDeparture: ms("2026-03-13T09:45:00-07:00"),
      LeftDock: existingTrip.LeftDock,
      Key: "CHE--2026-03-13--09:45--ORI-ANA",
      TimeStamp: ms("2026-03-13T09:40:00-07:00"),
    });
    const scheduledSegment = {
      Key: currLocation.Key!,
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "ANA",
      DepartingTime: currLocation.ScheduledDeparture!,
      NextKey: "CHE--2026-03-13--11:00--ANA-SHI",
      NextDepartingTime: ms("2026-03-13T11:00:00-07:00"),
    };

    const built = await buildTrip(
      createTestActionCtx({
        scheduledSegmentByKey: new Map([
          [scheduledSegment.Key, scheduledSegment],
        ]),
      }) as never,
      currLocation,
      existingTrip,
      false,
      makeEvents({ keyChanged: true }),
      false
    );

    expect(built.Key).toBe(currLocation.Key);
    expect(built.NextKey).toBe(scheduledSegment.NextKey);
    expect(built.NextScheduledDeparture).toBe(
      scheduledSegment.NextDepartingTime
    );
    expect(built.AtDockDepartCurr).toBeUndefined();
    expect(built.AtDockArriveNext).toBeUndefined();
    expect(built.AtDockDepartNext).toBeUndefined();
    expect(built.AtSeaArriveNext?.PredTime).toBe(existingTrip.LeftDock);
    expect(built.AtSeaDepartNext?.PredTime).toBe(
      scheduledSegment.NextDepartingTime
    );
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

    if (args && "pairKey" in args && "modelTypes" in args) {
      return Object.fromEntries(
        (Array.isArray(args.modelTypes) ? args.modelTypes : []).map(
          (modelType) => [String(modelType), makeModelDoc()]
        )
      );
    }

    if (args && "pairKey" in args && "modelType" in args) {
      return makeModelDoc();
    }

    return null;
  },
});

const makeEvents = (overrides: Partial<TripEvents> = {}): TripEvents => ({
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  keyChanged: false,
  ...overrides,
});

const ms = (iso: string) => new Date(iso).getTime();

const makePrediction = (PredTime: number) => ({
  PredTime,
  MinTime: PredTime - 60_000,
  MaxTime: PredTime + 60_000,
  MAE: 1,
  StdDev: 1,
  Actual: undefined,
  DeltaTotal: undefined,
  DeltaRange: undefined,
});

const makeModelDoc = () => ({
  featureKeys: [] as string[],
  coefficients: [] as number[],
  intercept: 0,
  testMetrics: {
    mae: 1,
    stdDev: 1,
  },
});

const makeLocation = (
  overrides: Partial<ResolvedVesselLocation> = {}
): ResolvedVesselLocation => ({
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 15,
  DepartingTerminalName: "Orcas Island",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalID: 1,
  ArrivingTerminalName: "Anacortes",
  ArrivingTerminalAbbrev: "ANA",
  Latitude: 48.0,
  Longitude: -122.0,
  Speed: 12,
  Heading: 90,
  InService: true,
  AtDock: false,
  LeftDock: ms("2026-03-13T09:34:00-07:00"),
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T09:45:00-07:00"),
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T09:40:00-07:00"),
  Key: "CHE--2026-03-13--09:45--ORI-ANA",
  DepartingDistance: 0.5,
  ArrivingDistance: 5,
  ...overrides,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalAbbrev: "LOP",
  RouteAbbrev: "ana-sj",
  Key: "CHE--2026-03-13--09:30--ORI-LOP",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "SHI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  AtDock: false,
  AtDockDuration: 10,
  ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  LeftDock: ms("2026-03-13T09:34:00-07:00"),
  TripDelay: 4,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:39:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:10:00-07:00"),
  PrevLeftDock: ms("2026-03-13T08:12:00-07:00"),
  NextKey: "CHE--2026-03-13--10:15--LOP-ANA",
  NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
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
