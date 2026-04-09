/**
 * Sequencing tests for the top-level vessel trip processor.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { TripEvents } from "../eventDetection";
import { processVesselTripsWithDeps } from "../processVesselTrips/processVesselTrips";

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  keyChanged: false,
};

describe("processVesselTripsWithDeps", () => {
  it("skips writes and side effects when the current trip is unchanged", async () => {
    const existingTrip = makeTrip();
    const currLocation = makeLocation();
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
    });

    await processVesselTripsWithDeps(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", existingTrip]]),
      })
    );

    expect(ctx.mutationCalls).toHaveLength(0);
  });

  it("skips writes and side effects when only TimeStamp differs on the trip", async () => {
    const existingTrip = makeTrip();
    const currLocation = makeLocation();
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
    });
    const newerStamp = makeTrip({
      TimeStamp: ms("2026-03-13T06:00:00-07:00"),
    });

    await processVesselTripsWithDeps(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", newerStamp]]),
      })
    );

    expect(ctx.mutationCalls).toHaveLength(0);
  });

  it("upserts a changed current trip and projects predicted effects", async () => {
    const existingTrip = makeTrip();
    const currLocation = makeLocation();
    const changedTrip = makeTrip({
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
      TripDelay: 42,
    });
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    await processVesselTripsWithDeps(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      })
    );

    expect(getUpsertMutationArgs(ctx)?.activeUpserts).toHaveLength(1);
    expect(getPredictedProjectionArgs(ctx)?.Effects).toHaveLength(1);
    expect(getActualProjectionArgs(ctx)).toBeUndefined();
  });

  it("projects predicted effects without an active upsert when only predictions change", async () => {
    const existingTrip = makeTrip();
    const currLocation = makeLocation();
    const changedTrip = makeTrip({
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
    });
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
    });

    await processVesselTripsWithDeps(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      })
    );

    expect(getUpsertMutationArgs(ctx)).toBeUndefined();
    expect(getPredictedProjectionArgs(ctx)?.Effects).toHaveLength(1);
    expect(getActualProjectionArgs(ctx)).toBeUndefined();
  });

  it("clears previous predicted scope when trip identity changes", async () => {
    const existingTrip = makeTrip({
      Key: "CHE--2026-03-13--05:30--ANA-ORI",
      NextKey: "CHE--2026-03-13--07:00--ORI-LOP",
    });
    const currLocation = makeLocation();
    const changedTrip = makeTrip({
      Key: "CHE--2026-03-13--05:40--ANA-ORI",
      NextKey: "CHE--2026-03-13--07:10--ORI-LOP",
      AtDockDepartCurr: makePrediction("2026-03-13T05:41:00-07:00"),
    });
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    await processVesselTripsWithDeps(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      })
    );

    const predictedArgs = getPredictedProjectionArgs(ctx);

    expect(predictedArgs?.Effects).toHaveLength(2);
    expect(
      predictedArgs?.Effects.some((effect) => effect.Rows.length === 0)
    ).toBe(true);
    expect(
      predictedArgs?.Effects.some((effect) => effect.Rows.length > 0)
    ).toBe(true);
  });

  it("projects an arrival actual effect when the vessel just arrived at dock", async () => {
    const existingTrip = makeTrip({
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      AtDock: false,
      ArriveDest: undefined,
    });
    const currLocation = makeLocation({
      AtDock: true,
    });
    const arrivedTrip = makeTrip({
      ArriveDest: ms("2026-03-13T06:29:56-07:00"),
      LeftDock: existingTrip.LeftDock,
    });
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    await processVesselTripsWithDeps(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([
          [
            "CHE",
            makeEvents({
              didJustArriveAtDock: true,
            }),
          ],
        ]),
        builtTripsByVessel: new Map([["CHE", arrivedTrip]]),
      })
    );

    expect(getActualProjectionArgs(ctx)?.Patches[0]?.EventType).toBe(
      "arv-dock"
    );
  });

  it("runs leave-dock post-persist work only after a successful upsert", async () => {
    const existingTrip = makeTrip({
      LeftDock: undefined,
    });
    const currLocation = makeLocation({
      AtDock: false,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
    });
    const departedTrip = makeTrip({
      LeftDock: currLocation.LeftDock,
      AtDock: false,
      AtSeaArriveNext: makePrediction("2026-03-13T06:25:00-07:00"),
    });
    const callSequence: string[] = [];
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
      callSequence,
    });

    await processVesselTripsWithDeps(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([
          [
            "CHE",
            makeEvents({
              didJustLeaveDock: true,
            }),
          ],
        ]),
        builtTripsByVessel: new Map([["CHE", departedTrip]]),
        callSequence,
      })
    );

    expect(
      callSequence.indexOf("mutation:upsert") <
        callSequence.indexOf("mutation:departNextBackfill:CHE")
    ).toBe(true);
  });

  it("filters projections and leave-dock side effects to successful vessels only", async () => {
    const cheLocation = makeLocation({
      VesselAbbrev: "CHE",
    });
    const tacLocation = makeLocation({
      VesselAbbrev: "TAC",
      VesselName: "Tacoma",
    });
    const cheExisting = makeTrip({
      VesselAbbrev: "CHE",
    });
    const tacExisting = makeTrip({
      VesselAbbrev: "TAC",
    });
    const cheTrip = makeTrip({
      VesselAbbrev: "CHE",
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
      TripDelay: 7,
    });
    const tacTrip = makeTrip({
      VesselAbbrev: "TAC",
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      AtDock: false,
      AtSeaArriveNext: makePrediction("2026-03-13T06:25:00-07:00"),
    });
    const ctx = createTestActionCtx({
      activeTrips: [cheExisting, tacExisting],
      upsertResult: {
        perVessel: [
          { vesselAbbrev: "CHE", ok: true },
          { vesselAbbrev: "TAC", ok: false, reason: "db fail" },
        ],
      },
    });

    await processVesselTripsWithDeps(
      ctx,
      [cheLocation, tacLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([
          ["CHE", defaultEvents],
          [
            "TAC",
            makeEvents({
              didJustLeaveDock: true,
            }),
          ],
        ]),
        builtTripsByVessel: new Map([
          ["CHE", cheTrip],
          ["TAC", tacTrip],
        ]),
      })
    );

    expect(getPredictedProjectionArgs(ctx)?.Effects).toHaveLength(1);
    expect(getPredictedProjectionArgs(ctx)?.Effects[0]?.VesselAbbrev).toBe(
      "CHE"
    );
    expect(getDepartNextBackfillCalls(ctx)).toHaveLength(0);
  });

  it("logs build failures and continues processing other vessels", async () => {
    const cheLocation = makeLocation({
      VesselAbbrev: "CHE",
    });
    const tacLocation = makeLocation({
      VesselAbbrev: "TAC",
      VesselName: "Tacoma",
    });
    const cheTrip = makeTrip({
      VesselAbbrev: "CHE",
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
      TripDelay: 3,
    });
    const ctx = createTestActionCtx({
      activeTrips: [
        makeTrip({ VesselAbbrev: "CHE" }),
        makeTrip({ VesselAbbrev: "TAC" }),
      ],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });
    const consoleErrors: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };

    try {
      await processVesselTripsWithDeps(
        ctx,
        [cheLocation, tacLocation],
        tickMs(),
        createDeps({
          eventsByVessel: new Map([
            ["CHE", defaultEvents],
            ["TAC", defaultEvents],
          ]),
          builtTripsByVessel: new Map([["CHE", cheTrip]]),
          buildFailuresByVessel: new Map([["TAC", new Error("boom")]]),
        })
      );
    } finally {
      console.error = originalConsoleError;
    }

    expect(getUpsertMutationArgs(ctx)?.activeUpserts).toHaveLength(1);
    expect(consoleErrors.length).toBeGreaterThan(0);
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
  eventsByVessel: Map<string, TripEvents>;
  builtTripsByVessel: Map<string, ConvexVesselTrip>;
  buildFailuresByVessel?: Map<string, Error>;
  callSequence?: string[];
};

/**
 * Build a fake action context for updater sequencing tests.
 *
 * @param options - Query and mutation fixtures for the test
 * @returns Minimal action context plus recorded calls
 */
const createTestActionCtx = (options: {
  activeTrips: ConvexVesselTrip[];
  upsertResult?: Record<string, unknown>;
  callSequence?: string[];
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
      options.callSequence?.push("query:activeTrips");
      return options.activeTrips;
    },
    runMutation: async (ref, args) => {
      mutationCalls.push({ ref, args });

      if (args && "activeUpserts" in args) {
        options.callSequence?.push("mutation:upsert");
        return (
          options.upsertResult ?? {
            perVessel: (args.activeUpserts as ConvexVesselTrip[]).map(
              (trip) => ({
                vesselAbbrev: trip.VesselAbbrev,
                ok: true,
              })
            ),
          }
        );
      }

      if (
        args &&
        typeof args === "object" &&
        "vesselAbbrev" in args &&
        "actualDepartMs" in args &&
        !("activeUpserts" in args)
      ) {
        options.callSequence?.push(
          `mutation:departNextBackfill:${String(args.vesselAbbrev)}`
        );
        return { updated: false as const };
      }

      if (
        args &&
        "Effects" in args &&
        Array.isArray(args.Effects) &&
        args.Effects.some(
          (effect) => "Rows" in (effect as Record<string, unknown>)
        )
      ) {
        options.callSequence?.push("mutation:projectPredicted");
        return null;
      }

      if (args && "Patches" in args) {
        options.callSequence?.push("mutation:projectActual");
        return null;
      }

      return null;
    },
  };
};

/**
 * Build injectable updater dependencies for sequencing tests.
 *
 * @param input - Per-test dependency configuration
 * @returns Dependency bag for `processVesselTripsWithDeps`
 */
const createDeps = (input: TestDepsInput) => ({
  buildCompletedTrip: (existingTrip: ConvexVesselTrip) => existingTrip,
  buildTrip: async (
    _ctx: unknown,
    currLocation: ConvexVesselLocation
  ): Promise<ConvexVesselTrip> => {
    input.callSequence?.push(`build:${currLocation.VesselAbbrev}`);
    const failure = input.buildFailuresByVessel?.get(currLocation.VesselAbbrev);
    if (failure) {
      throw failure;
    }

    const builtTrip = input.builtTripsByVessel.get(currLocation.VesselAbbrev);
    if (!builtTrip) {
      throw new Error(`Missing built trip for ${currLocation.VesselAbbrev}`);
    }

    return builtTrip;
  },
  detectTripEvents: (
    _existingTrip: ConvexVesselTrip | undefined,
    currLocation: ConvexVesselLocation
  ) => input.eventsByVessel.get(currLocation.VesselAbbrev) ?? defaultEvents,
});

/**
 * Build an updater tick timestamp.
 *
 * @returns Stable epoch milliseconds used for tests
 */
const tickMs = () => ms("2026-03-13T05:00:00-07:00");

/**
 * Convert an ISO timestamp into epoch milliseconds.
 *
 * @param iso - ISO-8601 timestamp string
 * @returns Epoch milliseconds for the provided timestamp
 */
const ms = (iso: string) => new Date(iso).getTime();

/**
 * Build a TripEvents object with sensible defaults.
 *
 * @param overrides - Scenario-specific event overrides
 * @returns Trip events for the mocked event detector
 */
const makeEvents = (overrides: Partial<TripEvents> = {}): TripEvents => ({
  ...defaultEvents,
  ...overrides,
});

/**
 * Build a test prediction payload.
 *
 * @param iso - Predicted timestamp
 * @returns Prediction object with derived bounds
 */
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

/**
 * Build a test vessel location with sensible defaults.
 *
 * @param overrides - Scenario-specific field overrides
 * @returns Concrete location payload for tests
 */
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

/**
 * Build a test vessel trip with sensible defaults.
 *
 * @param overrides - Scenario-specific field overrides
 * @returns Concrete trip payload for tests
 */
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

/**
 * Mutation calls matching `setDepartNextActualsForMostRecentCompletedTrip` args.
 *
 * @param ctx - Fake action context
 * @returns Recorded depart-next backfill calls
 */
const getDepartNextBackfillCalls = (ctx: TestActionCtx) =>
  ctx.mutationCalls.filter(
    (call) =>
      call.args &&
      typeof call.args === "object" &&
      "vesselAbbrev" in call.args &&
      "actualDepartMs" in call.args &&
      !("activeUpserts" in call.args)
  );

/**
 * Read the active-upsert mutation arguments from the fake context.
 *
 * @param ctx - Fake action context
 * @returns Upsert mutation arguments, if present
 */
const getUpsertMutationArgs = (ctx: TestActionCtx) =>
  ctx.mutationCalls.find((call) => call.args && "activeUpserts" in call.args)
    ?.args as
    | {
        activeUpserts: ConvexVesselTrip[];
      }
    | undefined;

/**
 * Read the actual projection mutation arguments from the fake context.
 *
 * @param ctx - Fake action context
 * @returns Actual projection mutation arguments, if present
 */
const getActualProjectionArgs = (ctx: TestActionCtx) =>
  ctx.mutationCalls.find(
    (call) =>
      call.args && "Patches" in call.args && Array.isArray(call.args.Patches)
  )?.args as
    | {
        Patches: Array<{
          EventType: string;
        }>;
      }
    | undefined;

/**
 * Read the predicted projection mutation arguments from the fake context.
 *
 * @param ctx - Fake action context
 * @returns Predicted projection mutation arguments, if present
 */
const getPredictedProjectionArgs = (ctx: TestActionCtx) =>
  ctx.mutationCalls.find(
    (call) =>
      call.args &&
      "Effects" in call.args &&
      Array.isArray(call.args.Effects) &&
      call.args.Effects.some(
        (effect) => "Rows" in (effect as Record<string, unknown>)
      )
  )?.args as
    | {
        Effects: Array<{
          VesselAbbrev: string;
          Rows: unknown[];
        }>;
      }
    | undefined;
