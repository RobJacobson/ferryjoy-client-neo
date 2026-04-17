/**
 * Focused behavioral tests for completed-trip processing.
 */

import { describe, expect, it } from "bun:test";
import { buildTickEventWritesFromCompletedFacts } from "domain/vesselOrchestration/updateTimeline/timelineEventAssembler";
import {
  type ProcessCompletedTripsDeps,
  processCompletedTrips,
} from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: true,
  shouldStartTrip: true,
  isCompletedTrip: true,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
};

describe("processCompletedTrips", () => {
  it("completes the current trip, starts a replacement trip, and emits boundary effects", async () => {
    const existingTrip = makeTrip({
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
    });
    const completedTrip = makeTrip({
      LeftDock: existingTrip.LeftDock,
      LeftDockActual: existingTrip.LeftDock,
      ArriveDest: ms("2026-03-13T06:29:56-07:00"),
      ArrivedNextActual: ms("2026-03-13T06:29:56-07:00"),
      TripEnd: ms("2026-03-13T06:29:56-07:00"),
    });
    const newTrip = makeTrip({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
      SailingDay: "2026-03-13",
      ScheduledDeparture: ms("2026-03-13T06:50:00-07:00"),
      AtDockDepartCurr: makePrediction("2026-03-13T06:52:00-07:00"),
    });
    const loggedErrors: Array<{ vesselAbbrev: string; phase: string }> = [];
    const ctx = createTestActionCtx();

    const facts = await processCompletedTrips(
      ctx as never,
      [
        {
          currLocation: makeLocation({
            DepartingTerminalAbbrev: "ORI",
            ArrivingTerminalAbbrev: "LOP",
            ScheduledDeparture: ms("2026-03-13T06:50:00-07:00"),
          }),
          existingTrip,
          events: defaultEvents,
        },
      ],
      false,
      (vesselAbbrev, phase) => {
        loggedErrors.push({ vesselAbbrev, phase });
      },
      createDeps({
        completedTripsByVessel: new Map([["CHE", completedTrip]]),
        newTripsByVessel: new Map([["CHE", newTrip]]),
      })
    );

    const result = buildTickEventWritesFromCompletedFacts(facts, 0);

    expect(loggedErrors).toHaveLength(0);
    expect(getBoundaryMutationArgs(ctx)?.completedTrip.VesselAbbrev).toBe(
      "CHE"
    );
    expect(getBoundaryMutationArgs(ctx)?.newTrip.ScheduleKey).toBe(
      newTrip.ScheduleKey
    );
    expect(result.actualDockWrites).toHaveLength(2);
    expect(result.actualDockWrites[0]?.EventType).toBe("dep-dock");
    expect(result.actualDockWrites[0]?.EventActualTime).toBe(
      existingTrip.LeftDock
    );
    expect(result.actualDockWrites[1]?.EventType).toBe("arv-dock");
    expect(result.predictedDockWriteBatches).toHaveLength(2);
  });

  it("logs failures and continues processing other completed trips", async () => {
    const cheExistingTrip = makeTrip({
      VesselAbbrev: "CHE",
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
    });
    const tacExistingTrip = makeTrip({
      VesselAbbrev: "TAC",
      LeftDock: ms("2026-03-13T05:39:38-07:00"),
    });
    const ctx = createTestActionCtx();
    const loggedErrors: Array<{ vesselAbbrev: string; phase: string }> = [];

    const facts = await processCompletedTrips(
      ctx as never,
      [
        {
          currLocation: makeLocation({
            VesselAbbrev: "CHE",
            DepartingTerminalAbbrev: "ORI",
            ArrivingTerminalAbbrev: "LOP",
          }),
          existingTrip: cheExistingTrip,
          events: defaultEvents,
        },
        {
          currLocation: makeLocation({
            VesselAbbrev: "TAC",
            VesselName: "Tacoma",
            DepartingTerminalAbbrev: "BBI",
            ArrivingTerminalAbbrev: "P52",
          }),
          existingTrip: tacExistingTrip,
          events: defaultEvents,
        },
      ],
      false,
      (vesselAbbrev, phase) => {
        loggedErrors.push({ vesselAbbrev, phase });
      },
      createDeps({
        completedTripsByVessel: new Map([
          [
            "CHE",
            makeTrip({
              VesselAbbrev: "CHE",
              LeftDock: cheExistingTrip.LeftDock,
              ArriveDest: ms("2026-03-13T06:29:56-07:00"),
              TripEnd: ms("2026-03-13T06:29:56-07:00"),
            }),
          ],
          [
            "TAC",
            makeTrip({
              VesselAbbrev: "TAC",
            }),
          ],
        ]),
        newTripsByVessel: new Map([
          [
            "CHE",
            makeTrip({
              VesselAbbrev: "CHE",
              DepartingTerminalAbbrev: "ORI",
              ArrivingTerminalAbbrev: "LOP",
              ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
            }),
          ],
        ]),
        buildFailuresByVessel: new Map([["TAC", new Error("boom")]]),
      })
    );

    const result = buildTickEventWritesFromCompletedFacts(facts, 0);

    expect(getBoundaryMutationArgs(ctx)?.completedTrip.VesselAbbrev).toBe(
      "CHE"
    );
    expect(result.predictedDockWriteBatches).toHaveLength(2);
    expect(loggedErrors).toEqual([
      {
        vesselAbbrev: "TAC",
        phase: "completed-trip processing",
      },
    ]);
  });
});

type TestActionCtx = {
  runQuery: (ref: unknown, args?: Record<string, unknown>) => Promise<unknown>;
  runMutation: (
    ref: unknown,
    args?: Record<string, unknown>
  ) => Promise<unknown>;
  mutationCalls: Array<{ ref: unknown; args?: Record<string, unknown> }>;
};

type TestDepsInput = {
  completedTripsByVessel: Map<string, ConvexVesselTripWithPredictions>;
  newTripsByVessel: Map<string, ConvexVesselTripWithPredictions>;
  buildFailuresByVessel?: Map<string, Error>;
};

/**
 * Build a fake action context for completed-trip processing tests.
 *
 * @returns Minimal action context plus recorded mutations
 */
const createTestActionCtx = (): TestActionCtx => {
  const mutationCalls: Array<{ ref: unknown; args?: Record<string, unknown> }> =
    [];

  return {
    mutationCalls,
    runQuery: async () => null,
    runMutation: async (ref, args) => {
      mutationCalls.push({ ref, args });
      return null;
    },
  };
};

/**
 * Build injectable dependencies for completed-trip processing tests.
 *
 * @param input - Per-test dependency configuration
 * @returns Dependency bag for `processCompletedTrips`
 */
const createDeps = (input: TestDepsInput): ProcessCompletedTripsDeps => ({
  buildCompletedTrip: (existingTrip) => {
    const completedTrip = input.completedTripsByVessel.get(
      existingTrip.VesselAbbrev
    );
    if (!completedTrip) {
      throw new Error(
        `Missing completed trip for ${existingTrip.VesselAbbrev}`
      );
    }

    return completedTrip;
  },
  buildTrip: async (
    _ctx,
    currLocation,
    _existingTrip,
    _tripStart,
    _events,
    _shouldRunPredictionFallback,
    _adapters
  ): Promise<ConvexVesselTripWithPredictions> => {
    const failure = input.buildFailuresByVessel?.get(currLocation.VesselAbbrev);
    if (failure) {
      throw failure;
    }

    const newTrip = input.newTripsByVessel.get(currLocation.VesselAbbrev);
    if (!newTrip) {
      throw new Error(`Missing new trip for ${currLocation.VesselAbbrev}`);
    }

    return newTrip;
  },
  buildTripAdapters: {
    resolveEffectiveLocation: async (_ctx, location) => location,
    appendFinalSchedule: async (_ctx, baseTrip) => baseTrip,
  },
});

/**
 * Convert an ISO timestamp into epoch milliseconds.
 *
 * @param iso - ISO-8601 timestamp string
 * @returns Epoch milliseconds for the provided timestamp
 */
const ms = (iso: string) => new Date(iso).getTime();

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
  TimeStamp: ms("2026-03-13T06:29:56-07:00"),
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
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
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
 * Read the complete-and-start mutation arguments from the fake context.
 *
 * @param ctx - Fake action context
 * @returns Boundary mutation arguments, if present
 */
const getBoundaryMutationArgs = (ctx: TestActionCtx) =>
  ctx.mutationCalls.find(
    (call) =>
      call.args && "completedTrip" in call.args && "newTrip" in call.args
  )?.args as
    | {
        completedTrip: ConvexVesselTripWithPredictions;
        newTrip: ConvexVesselTripWithPredictions;
      }
    | undefined;
