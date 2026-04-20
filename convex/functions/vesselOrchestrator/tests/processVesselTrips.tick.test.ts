/**
 * Sequencing tests for the same step order as `updateVesselOrchestrator` in `actions.ts`
 * (`updateVesselTrips` → `updateVesselPredictions` → `updateVesselTimeline`).
 */

import { describe, expect, it } from "bun:test";
import type { ActionCtx } from "_generated/server";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/updateVesselPredictions";
import {
  computeVesselTripsBundle,
  type RunUpdateVesselTripsOutput,
  type TripEvents,
  type TripScheduleCoreResult,
  type VesselTripsComputeBundle,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  updateVesselPredictions,
  updateVesselTimeline,
} from "functions/vesselOrchestrator/actions";
import { buildTimelineTripComputationsForRun } from "functions/vesselOrchestrator/buildTimelineTripComputationsForRun";
import { persistVesselTripWriteSet } from "functions/vesselOrchestrator/persistVesselTripWriteSet";
import { createVesselTripTableMutations } from "functions/vesselOrchestrator/utils";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

/**
 * Runs lifecycle tick then applies timeline writes (matches orchestrator ordering).
 *
 * @param ctx - Test fake action context
 * @param locations - Locations for this tick
 * @param tickStartedAt - Tick time (ms)
 * @param deps - Injected builder/detector deps
 * @param activeTrips - Preloaded active trips for the tick
 */
const runVesselTripsTick = async (
  ctx: TestActionCtx,
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  deps: ReturnType<typeof createDeps>,
  activeTrips?: ReadonlyArray<ConvexVesselTrip>
): Promise<void> => {
  const trips = activeTrips ?? ctx.preloadedActiveTrips ?? [];
  const actionCtx = ctx as unknown as ActionCtx;

  const { bundle: tripsCompute } = await computeVesselTripsBundle(
    locations,
    deps,
    trips
  );
  const tripsOutput = buildTripsOutputFromTripsCompute({ tripsCompute });
  const tripApplyResult = await persistVesselTripWriteSet(
    tripsOutput,
    createVesselTripTableMutations(actionCtx)
  );

  const { predictedTripComputations } = await updateVesselPredictions(
    actionCtx,
    tickStartedAt,
    tripsOutput.tripComputations
  );

  await updateVesselTimeline(actionCtx, {
    tickStartedAt,
    tripComputations: buildTimelineTripComputationsForRun(
      tripsOutput,
      tripApplyResult
    ),
    predictedTripComputations,
  });
};

const buildTripsOutputFromTripsCompute = (input: {
  tripsCompute: VesselTripsComputeBundle;
}): RunUpdateVesselTripsOutput => ({
  activeTrips: [
    ...input.tripsCompute.completedHandoffs.map((handoff) =>
      stripTripPredictionsForStorage(handoff.newTripCore.withFinalSchedule)
    ),
    ...input.tripsCompute.current.activeUpserts.map(
      stripTripPredictionsForStorage
    ),
  ],
  completedTrips: input.tripsCompute.completedHandoffs.map((handoff) =>
    stripTripPredictionsForStorage(handoff.tripToComplete)
  ),
  tripComputations: [
    ...input.tripsCompute.completedHandoffs.map((handoff) => ({
      vesselAbbrev: handoff.tripToComplete.VesselAbbrev,
      branch: "completed" as const,
      events: handoff.events,
      existingTrip: handoff.existingTrip,
      completedTrip: handoff.tripToComplete,
      activeTrip: handoff.newTripCore.withFinalSchedule,
      tripCore: handoff.newTripCore,
    })),
    ...input.tripsCompute.current.pendingPredictedMessages.map((message) => ({
      vesselAbbrev: message.vesselAbbrev,
      branch: "current" as const,
      events:
        input.tripsCompute.current.pendingActualMessages.find(
          (actualMessage) => actualMessage.vesselAbbrev === message.vesselAbbrev
        )?.events ?? defaultEvents,
      existingTrip: message.existingTrip,
      activeTrip: message.tripCore.withFinalSchedule,
      tripCore: message.tripCore,
    })),
  ],
});

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
};

describe("vessel orchestrator trip tick sequencing", () => {
  it("uses preloaded active trips without extra reads", async () => {
    const existingTrip = makeTrip();
    const currLocation = makeLocation();
    const ctx = createTestActionCtx({});

    await runVesselTripsTick(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", existingTrip]]),
      }),
      [existingTrip]
    );

    expect(ctx.queryCalls).toHaveLength(0);
  });

  it("treats omitted active trips as an empty snapshot", async () => {
    const builtTrip = makeTrip();
    const currLocation = makeLocation();
    const ctx = createTestActionCtx({});

    await runVesselTripsTick(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", builtTrip]]),
      }),
      undefined
    );

    expect(ctx.queryCalls).toHaveLength(0);
  });

  it("matches prediction-only projection for storage-native vs prediction-enriched preloaded existing trips", async () => {
    const storageExisting = makeStorageTrip();
    const enrichedExisting = makeTrip();
    const currLocation = makeLocation();
    const changedTrip = makeTrip({
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
    });

    const ctxStorage = createTestActionCtx({});
    const ctxEnriched = createTestActionCtx({});

    await runVesselTripsTick(
      ctxStorage,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      }),
      [storageExisting]
    );

    await runVesselTripsTick(
      ctxEnriched,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      }),
      [enrichedExisting]
    );

    const effectsStorage = getPredictedProjectionArgs(ctxStorage)?.Batches;
    const effectsEnriched = getPredictedProjectionArgs(ctxEnriched)?.Batches;
    expect(effectsStorage?.length).toBe(effectsEnriched?.length);
    expect(getUpsertMutationArgs(ctxStorage)).toBeUndefined();
    expect(getUpsertMutationArgs(ctxEnriched)).toBeUndefined();

    const firstS = effectsStorage?.[0];
    const firstE = effectsEnriched?.[0];
    expect(firstS?.VesselAbbrev).toBe(firstE?.VesselAbbrev);
    expect(firstS?.Rows?.length).toBe(firstE?.Rows?.length);
  });

  it("treats an empty preloaded activeTrips array as a snapshot", async () => {
    const currLocation = makeLocation();
    const ctx = createTestActionCtx({});

    await runVesselTripsTick(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([
          [
            "CHE",
            {
              ...defaultEvents,
              isFirstTrip: true,
              shouldStartTrip: true,
              isTripStartReady: true,
            },
          ],
        ]),
        builtTripsByVessel: new Map([["CHE", makeTrip()]]),
      }),
      []
    );

    expect(ctx.queryCalls).toHaveLength(0);
  });

  it("skips writes and side effects when the current trip is unchanged", async () => {
    const existingTrip = makeTrip();
    const currLocation = makeLocation();
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
    });

    await runVesselTripsTick(
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

    await runVesselTripsTick(
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

    await runVesselTripsTick(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      })
    );

    expect(getUpsertMutationArgs(ctx)?.activeUpserts).toHaveLength(1);
    expect(getPredictedProjectionArgs(ctx)?.Batches).toHaveLength(1);
    expect(getActualProjectionArgs(ctx)).toBeUndefined();
  });

  it("skips trip overlay and timeline predicted writes when only ML blobs differ (storage-equal)", async () => {
    const existingTrip = makeTrip();
    const currLocation = makeLocation();
    const changedTrip = makeTrip({
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
    });
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
    });

    await runVesselTripsTick(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      })
    );

    expect(getUpsertMutationArgs(ctx)).toBeUndefined();
    expect(getPredictedProjectionArgs(ctx)).toBeUndefined();
    expect(getActualProjectionArgs(ctx)).toBeUndefined();
  });

  it("clears previous predicted scope when trip identity changes", async () => {
    const existingTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
      NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
    });
    const currLocation = makeLocation();
    const changedTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--05:40--ANA-ORI",
      NextScheduleKey: "CHE--2026-03-13--07:10--ORI-LOP",
      AtDockDepartCurr: makePrediction("2026-03-13T05:41:00-07:00"),
    });
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    await runVesselTripsTick(
      ctx,
      [currLocation],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", changedTrip]]),
      })
    );

    const predictedArgs = getPredictedProjectionArgs(ctx);

    expect(predictedArgs?.Batches).toHaveLength(2);
    expect(
      predictedArgs?.Batches.some((effect) => effect.Rows.length === 0)
    ).toBe(true);
    expect(
      predictedArgs?.Batches.some((effect) => effect.Rows.length > 0)
    ).toBe(true);
  });

  it("projects an arrival actual effect when the vessel just arrived at dock", async () => {
    const existingTrip = makeTrip({
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      AtDock: false,
      ArriveDest: undefined,
      LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
    });
    const currLocation = makeLocation({
      AtDock: true,
    });
    const arrivedTrip = makeTrip({
      ArriveDest: ms("2026-03-13T06:29:56-07:00"),
      LeftDock: existingTrip.LeftDock,
      ArrivedNextActual: ms("2026-03-13T06:29:56-07:00"),
    });
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });

    await runVesselTripsTick(
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

    expect(getActualProjectionArgs(ctx)?.Writes[0]?.EventType).toBe("arv-dock");
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
      LeftDockActual: currLocation.LeftDock,
    });
    const callSequence: string[] = [];
    const ctx = createTestActionCtx({
      activeTrips: [existingTrip],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
      callSequence,
    });

    await runVesselTripsTick(
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
      LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
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

    await runVesselTripsTick(
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

    expect(getPredictedProjectionArgs(ctx)?.Batches).toHaveLength(1);
    expect(getPredictedProjectionArgs(ctx)?.Batches[0]?.VesselAbbrev).toBe(
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
      await runVesselTripsTick(
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
  preloadedActiveTrips?: ReadonlyArray<ConvexVesselTrip>;
};

type TestDepsInput = {
  eventsByVessel: Map<string, TripEvents>;
  builtTripsByVessel: Map<string, ConvexVesselTripWithPredictions>;
  /** When set with {@link newTripsByVessel}, enables Path 3 completion fakes. */
  completedTripsByVessel?: Map<string, ConvexVesselTripWithPredictions>;
  /** When set with {@link completedTripsByVessel}, `buildTripCore` uses this row when `tripStart` is true. */
  newTripsByVessel?: Map<string, ConvexVesselTripWithPredictions>;
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
  /** Generic query payload for tests that still invoke `runQuery` */
  tripsReturnedByQuery?: ConvexVesselTripWithPredictions[];
  /** Fallback query payload when `tripsReturnedByQuery` is unset */
  activeTrips?: ConvexVesselTripWithPredictions[];
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
    preloadedActiveTrips: options.activeTrips,
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      if (args && typeof args === "object" && "requests" in args) {
        options.callSequence?.push("query:predictionModels");
        return {};
      }
      options.callSequence?.push("query:activeTrips");
      return options.tripsReturnedByQuery ?? options.activeTrips ?? [];
    },
    runMutation: async (ref, args) => {
      mutationCalls.push({ ref, args });

      if (args && "activeUpserts" in args) {
        options.callSequence?.push("mutation:upsert");
        return (
          options.upsertResult ?? {
            perVessel: (
              args.activeUpserts as ConvexVesselTripWithPredictions[]
            ).map((trip) => ({
              vesselAbbrev: trip.VesselAbbrev,
              ok: true,
            })),
          }
        );
      }

      if (args && typeof args === "object" && "proposals" in args) {
        options.callSequence?.push("mutation:batchUpsertProposals");
        return { skipped: 0, inserted: 0, replaced: 0 };
      }

      if (
        args &&
        typeof args === "object" &&
        "completedTrip" in args &&
        "newTrip" in args &&
        !("activeUpserts" in args)
      ) {
        options.callSequence?.push("mutation:completeAndStart");
        return null;
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
        "Batches" in args &&
        Array.isArray(args.Batches) &&
        args.Batches.some(
          (batch) => "Rows" in (batch as Record<string, unknown>)
        )
      ) {
        options.callSequence?.push("mutation:projectPredicted");
        return null;
      }

      if (args && "Writes" in args) {
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
 * @returns Dependency bag for `computeVesselTripsBundle` in sequencing tests
 */
const createDeps = (input: TestDepsInput) => {
  const useCompletionMaps =
    input.completedTripsByVessel !== undefined &&
    input.newTripsByVessel !== undefined;

  return {
    buildCompletedTrip: (
      existingTrip: ConvexVesselTripWithPredictions,
      _currLocation: ConvexVesselLocation,
      _hasTrustedArrival: boolean
    ): ConvexVesselTripWithPredictions => {
      if (useCompletionMaps) {
        const completed = input.completedTripsByVessel?.get(
          existingTrip.VesselAbbrev
        );
        if (!completed) {
          throw new Error(
            `Missing completed trip for ${existingTrip.VesselAbbrev}`
          );
        }

        return completed;
      }

      return existingTrip;
    },
    buildTripCore: async (
      currLocation: ConvexVesselLocation,
      _existingTrip: ConvexVesselTripWithPredictions | undefined,
      tripStart: boolean,
      _events: TripEvents,
      _adapters: unknown
    ): Promise<TripScheduleCoreResult> => {
      input.callSequence?.push(`build:${currLocation.VesselAbbrev}`);
      const failure = input.buildFailuresByVessel?.get(
        currLocation.VesselAbbrev
      );
      if (failure) {
        throw failure;
      }

      // Path 3: `processCompletedTrips` calls `buildTripCore` with `tripStart: true` for
      // the replacement active row — resolve from `newTripsByVessel`, not `builtTripsByVessel`.
      let withFinalSchedule: ConvexVesselTripWithPredictions;
      if (useCompletionMaps && tripStart) {
        const replacement = input.newTripsByVessel?.get(
          currLocation.VesselAbbrev
        );
        if (!replacement) {
          throw new Error(
            `Missing new trip for ${currLocation.VesselAbbrev} (tripStart)`
          );
        }

        withFinalSchedule = replacement;
      } else {
        const builtTrip = input.builtTripsByVessel.get(
          currLocation.VesselAbbrev
        );
        if (!builtTrip) {
          throw new Error(
            `Missing built trip for ${currLocation.VesselAbbrev}`
          );
        }
        withFinalSchedule = builtTrip;
      }

      return {
        withFinalSchedule,
      };
    },
    buildTripAdapters: {
      resolveEffectiveLocation: async (location: ConvexVesselLocation) =>
        location,
      appendFinalSchedule: async (
        baseTrip: ConvexVesselTripWithPredictions,
        _existingTrip: ConvexVesselTripWithPredictions | undefined
      ) => baseTrip,
    },
    detectTripEvents: (
      _existingTrip: ConvexVesselTripWithPredictions | undefined,
      currLocation: ConvexVesselLocation
    ) => input.eventsByVessel.get(currLocation.VesselAbbrev) ?? defaultEvents,
  };
};

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
 * Storage-native active trip (no joined ML fields) for tick contract tests.
 *
 * @param overrides - Stored-column overrides only
 * @returns {@link ConvexVesselTrip} row shape
 */
const makeStorageTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip =>
  ({
    ...makeTrip({
      AtDockDepartCurr: undefined,
      AtDockArriveNext: undefined,
      AtDockDepartNext: undefined,
      AtSeaArriveNext: undefined,
      AtSeaDepartNext: undefined,
      ...overrides,
    }),
  }) as ConvexVesselTrip;

/**
 * Build a test vessel trip with sensible defaults.
 *
 * @param overrides - Scenario-specific field overrides
 * @returns Concrete trip payload for tests
 */
const makeTrip = (
  overrides: Partial<ConvexVesselTripWithPredictions> = {}
): ConvexVesselTripWithPredictions => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
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
  NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
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
        activeUpserts: ConvexVesselTripWithPredictions[];
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
      call.args && "Writes" in call.args && Array.isArray(call.args.Writes)
  )?.args as
    | {
        Writes: Array<{
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
      "Batches" in call.args &&
      Array.isArray(call.args.Batches) &&
      call.args.Batches.some(
        (batch) => "Rows" in (batch as Record<string, unknown>)
      )
  )?.args as
    | {
        Batches: Array<{
          VesselAbbrev: string;
          Rows: unknown[];
        }>;
      }
    | undefined;

/**
 * Read `completeAndStartNewTrip` mutation arguments from the fake context.
 *
 * @param ctx - Fake action context
 * @returns Boundary mutation arguments, if present
 */
const getCompleteAndStartArgs = (ctx: TestActionCtx) =>
  ctx.mutationCalls.find(
    (call) =>
      call.args &&
      typeof call.args === "object" &&
      "completedTrip" in call.args &&
      "newTrip" in call.args
  )?.args as
    | {
        completedTrip: ConvexVesselTripWithPredictions;
        newTrip: ConvexVesselTripWithPredictions;
      }
    | undefined;

/**
 * Covers architecture §9 “golden flow” (continuing → leave dock → arrive/complete)
 * via Paths 1–3 in `architecture.md` §4.
 */
describe("golden path: docked → at sea → completed rollover", () => {
  it("runs Path 1, then Path 2, then Path 3 with orchestrator-like ordering (architecture.md §4)", async () => {
    // Path 1 — continuing active trip (architecture.md §4 Path 1): unchanged proposed trip → no writes.
    const path1Existing = makeTrip();
    const path1Location = makeLocation();
    const ctx1 = createTestActionCtx({ activeTrips: [path1Existing] });

    await runVesselTripsTick(
      ctx1,
      [path1Location],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", defaultEvents]]),
        builtTripsByVessel: new Map([["CHE", path1Existing]]),
      })
    );

    expect(ctx1.mutationCalls).toHaveLength(0);

    // Path 2 — leave-dock boundary (§4 Path 2): upsert before depart-next backfill.
    const path2Existing = makeTrip({
      LeftDock: undefined,
    });
    const path2Location = makeLocation({
      AtDock: false,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
    });
    const path2Departed = makeTrip({
      LeftDock: path2Location.LeftDock,
      AtDock: false,
      AtSeaArriveNext: makePrediction("2026-03-13T06:25:00-07:00"),
      LeftDockActual: path2Location.LeftDock,
    });
    const path2Sequence: string[] = [];
    const ctx2 = createTestActionCtx({
      activeTrips: [path2Existing],
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
      callSequence: path2Sequence,
    });

    await runVesselTripsTick(
      ctx2,
      [path2Location],
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
        builtTripsByVessel: new Map([["CHE", path2Departed]]),
        callSequence: path2Sequence,
      })
    );

    expect(
      path2Sequence.indexOf("mutation:upsert") <
        path2Sequence.indexOf("mutation:departNextBackfill:CHE")
    ).toBe(true);

    // Path 3 — completion / rollover (§4 Path 3): boundary mutation, then timeline apply (fake `callSequence`).
    const path3CompletionEvents: TripEvents = {
      isFirstTrip: false,
      isTripStartReady: true,
      shouldStartTrip: true,
      isCompletedTrip: true,
      didJustArriveAtDock: false,
      didJustLeaveDock: false,
      scheduleKeyChanged: false,
    };
    const path3Completed = makeTrip({
      LeftDock: path2Departed.LeftDock,
      LeftDockActual: path2Departed.LeftDock,
      ArriveDest: ms("2026-03-13T06:29:56-07:00"),
      ArrivedNextActual: ms("2026-03-13T06:29:56-07:00"),
      TripEnd: ms("2026-03-13T06:29:56-07:00"),
    });
    const path3NewLeg = makeTrip({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
      SailingDay: "2026-03-13",
      ScheduledDeparture: ms("2026-03-13T06:50:00-07:00"),
      AtDockDepartCurr: makePrediction("2026-03-13T06:52:00-07:00"),
    });
    const path3Location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduledDeparture: ms("2026-03-13T06:50:00-07:00"),
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });
    const path3Sequence: string[] = [];
    const ctx3 = createTestActionCtx({
      activeTrips: [path2Departed],
      callSequence: path3Sequence,
    });

    await runVesselTripsTick(
      ctx3,
      [path3Location],
      tickMs(),
      createDeps({
        eventsByVessel: new Map([["CHE", path3CompletionEvents]]),
        builtTripsByVessel: new Map([["CHE", path3NewLeg]]),
        completedTripsByVessel: new Map([["CHE", path3Completed]]),
        newTripsByVessel: new Map([["CHE", path3NewLeg]]),
        callSequence: path3Sequence,
      })
    );

    const boundary = getCompleteAndStartArgs(ctx3);
    expect(boundary?.newTrip.ScheduleKey).toBe(path3NewLeg.ScheduleKey);

    const idxComplete = path3Sequence.indexOf("mutation:completeAndStart");
    const firstProjectionIdx = path3Sequence.findIndex(
      (step) =>
        step === "mutation:projectActual" ||
        step === "mutation:projectPredicted"
    );
    expect(idxComplete).toBeGreaterThan(-1);
    expect(firstProjectionIdx).toBeGreaterThan(-1);
    expect(idxComplete).toBeLessThan(firstProjectionIdx);
  });
});
