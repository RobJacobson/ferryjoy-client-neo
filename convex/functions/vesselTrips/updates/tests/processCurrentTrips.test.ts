/**
 * Focused behavioral tests for current-trip processing.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { TripEvents } from "../eventDetection";
import {
  type ProcessCurrentTripsDeps,
  processCurrentTrips,
} from "../processVesselTrips/processCurrentTrips";

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  keyChanged: false,
};

describe("processCurrentTrips", () => {
  it("skips writes when only TimeStamp differs", async () => {
    const existingTrip = makeTrip({
      TimeStamp: ms("2026-03-13T04:33:00-07:00"),
    });
    const finalProposed = makeTrip({
      TimeStamp: ms("2026-03-13T04:33:05-07:00"),
    });
    const ctx = createTestActionCtx();

    const result = await processCurrentTrips(
      ctx as never,
      [
        {
          currLocation: makeLocation(),
          existingTrip,
          events: defaultEvents,
        },
      ],
      false,
      createCallbacks(),
      createDeps({
        builtTripsByVessel: new Map([["CHE", finalProposed]]),
      })
    );

    expect(ctx.mutationCalls).toHaveLength(0);
    expect(result.actualPatches).toHaveLength(0);
    expect(result.predictedEffects).toHaveLength(0);
  });

  it("includes both clear and project effects when trip identity changes", async () => {
    const existingTrip = makeTrip({
      Key: "CHE--2026-03-13--05:30--ANA-ORI",
      NextKey: "CHE--2026-03-13--07:00--ORI-LOP",
    });
    const finalProposed = makeTrip({
      Key: "CHE--2026-03-13--05:40--ANA-ORI",
      NextKey: "CHE--2026-03-13--07:10--ORI-LOP",
      AtDockDepartCurr: makePrediction("2026-03-13T05:41:00-07:00"),
    });
    const ctx = createTestActionCtx({
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    const result = await processCurrentTrips(
      ctx as never,
      [
        {
          currLocation: makeLocation(),
          existingTrip,
          events: defaultEvents,
        },
      ],
      false,
      createCallbacks(),
      createDeps({
        builtTripsByVessel: new Map([["CHE", finalProposed]]),
      })
    );

    expect(getUpsertMutationArgs(ctx)?.activeUpserts).toHaveLength(1);
    expect(result.predictedEffects).toHaveLength(2);
    expect(
      result.predictedEffects.some((effect) => effect.Rows.length === 0)
    ).toBe(true);
    expect(
      result.predictedEffects.some((effect) => effect.Rows.length > 0)
    ).toBe(true);
  });

  it("returns an arrival actual effect when arrival is confirmed", async () => {
    const existingTrip = makeTrip({
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      AtDock: false,
      ArriveDest: undefined,
    });
    const finalProposed = makeTrip({
      LeftDock: existingTrip.LeftDock,
      ArriveDest: ms("2026-03-13T06:29:56-07:00"),
    });
    const ctx = createTestActionCtx({
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    const result = await processCurrentTrips(
      ctx as never,
      [
        {
          currLocation: makeLocation({
            AtDock: true,
          }),
          existingTrip,
          events: makeEvents({
            didJustArriveAtDock: true,
          }),
        },
      ],
      false,
      createCallbacks(),
      createDeps({
        builtTripsByVessel: new Map([["CHE", finalProposed]]),
      })
    );

    expect(result.actualPatches).toHaveLength(1);
    expect(result.actualPatches[0]?.EventType).toBe("arv-dock");
  });

  it("runs leave-dock post-persist work only when LeftDock is present", async () => {
    const predictionCalls: Array<Record<string, unknown>> = [];
    const ctxWithDeparture = createTestActionCtx({
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
      previousTrips: new Map([["CHE", makeCompletedTrip()]]),
    });

    await processCurrentTrips(
      ctxWithDeparture as never,
      [
        {
          currLocation: makeLocation({
            AtDock: false,
            LeftDock: ms("2026-03-13T05:29:38-07:00"),
          }),
          existingTrip: makeTrip({
            LeftDock: undefined,
          }),
          events: makeEvents({
            didJustLeaveDock: true,
          }),
        },
      ],
      false,
      createCallbacks(),
      createDeps({
        builtTripsByVessel: new Map([
          [
            "CHE",
            makeTrip({
              LeftDock: ms("2026-03-13T05:29:38-07:00"),
              AtDock: false,
            }),
          ],
        ]),
        predictionCalls,
      })
    );

    expect(predictionCalls).toHaveLength(1);
    expect(ctxWithDeparture.queryCalls).toHaveLength(1);

    const predictionCallsWithoutDeparture: Array<Record<string, unknown>> = [];
    const ctxWithoutDeparture = createTestActionCtx({
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    await processCurrentTrips(
      ctxWithoutDeparture as never,
      [
        {
          currLocation: makeLocation({
            AtDock: false,
            LeftDock: undefined,
          }),
          existingTrip: makeTrip({
            LeftDock: undefined,
          }),
          events: makeEvents({
            didJustLeaveDock: true,
          }),
        },
      ],
      false,
      createCallbacks(),
      createDeps({
        builtTripsByVessel: new Map([
          [
            "CHE",
            makeTrip({
              LeftDock: undefined,
              AtDock: false,
            }),
          ],
        ]),
        predictionCalls: predictionCallsWithoutDeparture,
      })
    );

    expect(predictionCallsWithoutDeparture).toHaveLength(0);
    expect(ctxWithoutDeparture.queryCalls).toHaveLength(0);
  });
});

type TestActionCtx = {
  runQuery: (ref: unknown, args?: Record<string, unknown>) => Promise<unknown>;
  runMutation: (
    ref: unknown,
    args?: Record<string, unknown>
  ) => Promise<unknown>;
  queryCalls: Array<{ ref: unknown; args?: Record<string, unknown> }>;
  mutationCalls: Array<{ ref: unknown; args?: Record<string, unknown> }>;
};

type TestDepsInput = {
  builtTripsByVessel: Map<string, ConvexVesselTrip>;
  predictionCalls?: Array<Record<string, unknown>>;
};

const createTestActionCtx = (options?: {
  upsertResult?: Record<string, unknown>;
  previousTrips?: Map<string, ConvexVesselTrip>;
}): TestActionCtx => {
  const queryCalls: Array<{ ref: unknown; args?: Record<string, unknown> }> =
    [];
  const mutationCalls: Array<{ ref: unknown; args?: Record<string, unknown> }> =
    [];

  return {
    queryCalls,
    mutationCalls,
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      if (args?.vesselAbbrev) {
        return options?.previousTrips?.get(String(args.vesselAbbrev)) ?? null;
      }

      return null;
    },
    runMutation: async (ref, args) => {
      mutationCalls.push({ ref, args });
      return (
        options?.upsertResult ?? {
          perVessel:
            (args?.activeUpserts as ConvexVesselTrip[] | undefined)?.map(
              (trip) => ({
                vesselAbbrev: trip.VesselAbbrev,
                ok: true,
              })
            ) ?? [],
        }
      );
    },
  };
};

const createCallbacks = () => ({
  logDockSignalDisagreement: () => undefined,
  logVesselProcessingError: () => undefined,
});

const createDeps = (input: TestDepsInput): ProcessCurrentTripsDeps => ({
  buildTrip: async (_ctx, currLocation): Promise<ConvexVesselTrip> => {
    const builtTrip = input.builtTripsByVessel.get(currLocation.VesselAbbrev);
    if (!builtTrip) {
      throw new Error(`Missing built trip for ${currLocation.VesselAbbrev}`);
    }

    return builtTrip;
  },
  handlePredictionEvent: async (_ctx, payload) => {
    input.predictionCalls?.push(payload as Record<string, unknown>);
  },
});

const ms = (iso: string) => new Date(iso).getTime();

const makeEvents = (overrides: Partial<TripEvents> = {}): TripEvents => ({
  ...defaultEvents,
  ...overrides,
});

const makePrediction = (iso: string) => {
  const predTime = ms(iso);

  return {
    PredTime: predTime,
    MinTime: predTime - 60_000,
    MaxTime: predTime + 60_000,
    MAE: 2,
    StdDev: 1,
  };
};

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: undefined,
  ArrivingTerminalName: undefined,
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T04:33:00-07:00"),
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

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
  NextKey: "CHE--2026-03-13--07:00--ORI-LOP",
  NextScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

const makeCompletedTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  ...makeTrip({
    LeftDock: ms("2026-03-12T19:34:26-07:00"),
    TripEnd: ms("2026-03-12T20:45:00-07:00"),
    ArriveDest: ms("2026-03-12T20:40:00-07:00"),
  }),
  ...overrides,
});

const getUpsertMutationArgs = (ctx: TestActionCtx) =>
  ctx.mutationCalls.find((call) => call.args && "activeUpserts" in call.args)
    ?.args as
    | {
        activeUpserts: ConvexVesselTrip[];
      }
    | undefined;
