/**
 * Domain-owned `buildTrip` tests using the same adapter contracts as production
 * (`VesselTripsBuildTripAdapters`) without importing functions-layer modules.
 *
 * **O2:** `buildTrip O2 parity` asserts `buildTrip` matches
 * `buildTripCore` → `applyVesselPredictions` for fixed stubs (full-trip
 * `toEqual` unless a field proves non-deterministic—then document normalization).
 */

import { describe, expect, it } from "bun:test";
import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled/schemas";
import type {
  ProductionModelParameters,
  VesselTripPredictionModelAccess,
} from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/shared";
import { applyVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions";
import {
  buildTrip,
  buildTripCore,
} from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { resolveEffectiveDockedLocation } from "../continuity/resolveEffectiveDockedLocation";
import type { VesselTripsBuildTripAdapters } from "../vesselTripsBuildTripAdapters";

type TestActionCtx = {
  runQuery: (ref: unknown, args?: Record<string, unknown>) => Promise<unknown>;
};

const makeModelDoc = () => ({
  featureKeys: [] as string[],
  coefficients: [] as number[],
  intercept: 0,
  testMetrics: {
    mae: 1,
    stdDev: 1,
  },
});

const createTestActionCtx = (options: {
  scheduledEventByKey?: Map<string, ConvexScheduledDockEvent>;
  scheduledEventsByScope?: Map<string, ConvexScheduledDockEvent[]>;
}): TestActionCtx => ({
  runQuery: async (_ref, args) => {
    if (args && "segmentKey" in args) {
      return args.segmentKey && options.scheduledEventByKey
        ? (options.scheduledEventByKey.get(String(args.segmentKey)) ?? null)
        : null;
    }

    if (args && "vesselAbbrev" in args && "sailingDay" in args) {
      return (
        options.scheduledEventsByScope?.get(
          `${String(args.vesselAbbrev)}|${String(args.sailingDay)}`
        ) ?? []
      );
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

type TestScheduleStubOptions = {
  scheduledEventByKey?: Map<string, ConvexScheduledDockEvent>;
  scheduledEventsByScope?: Map<string, ConvexScheduledDockEvent[]>;
};

const createTestScheduleLookup = (
  options: TestScheduleStubOptions
): ScheduledSegmentLookup => ({
  getScheduledDepartureEventBySegmentKey: (segmentKey: string) =>
    options.scheduledEventByKey?.get(segmentKey) ?? null,
  getScheduledDockEventsForSailingDay: (args) =>
    options.scheduledEventsByScope?.get(
      `${args.vesselAbbrev}|${args.sailingDay}`
    ) ?? [],
});

/**
 * Mirrors production {@link createVesselTripPredictionModelAccess} using the
 * same stub `runQuery` as schedule tests.
 *
 * @param ctx - Test action context
 * @returns Model access for `buildTrip` / `applyVesselPredictions`
 */
const createTestPredictionAccess = (
  ctx: TestActionCtx
): VesselTripPredictionModelAccess => ({
  loadModelForProductionPair: async (pairKey, modelType) =>
    (await ctx.runQuery({} as never, {
      pairKey,
      modelType,
    })) as ProductionModelParameters | null,
  loadModelsForProductionPairBatch: async (pairKey, modelTypes) =>
    (await ctx.runQuery({} as never, {
      pairKey,
      modelTypes,
    })) as Record<ModelType, ProductionModelParameters | null>,
});

/**
 * Shared stub context for schedule lookups and model `runQuery` calls; tests assign per case.
 */
let scheduleTestScheduleOptions: TestScheduleStubOptions = {};
let scheduleTestCtx: TestActionCtx = createTestActionCtx(
  scheduleTestScheduleOptions
);

/**
 * Test adapters: docked identity via {@link resolveEffectiveDockedLocation};
 * schedule enrichment mirrors `appendFinalSchedule` query merge semantics.
 */
const testBuildTripAdapters: VesselTripsBuildTripAdapters = {
  resolveEffectiveLocation: async (
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTripWithPredictions | undefined
  ): Promise<ConvexVesselLocation> => {
    if (!location.AtDock || location.LeftDock !== undefined) {
      return location;
    }
    const { effectiveLocation } = await resolveEffectiveDockedLocation(
      createTestScheduleLookup(scheduleTestScheduleOptions),
      location,
      existingTrip
    );
    return effectiveLocation;
  },
  appendFinalSchedule: async (
    baseTrip: ConvexVesselTripWithPredictions,
    existingTrip: ConvexVesselTripWithPredictions | undefined
  ): Promise<ConvexVesselTripWithPredictions> => {
    const segmentKey = baseTrip.ScheduleKey ?? null;
    if (!segmentKey) {
      return baseTrip;
    }
    if (existingTrip?.ScheduleKey === segmentKey) {
      return {
        ...baseTrip,
        ScheduleKey: baseTrip.ScheduleKey ?? existingTrip.ScheduleKey,
        NextScheduleKey:
          baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
        NextScheduledDeparture:
          baseTrip.NextScheduledDeparture ??
          existingTrip.NextScheduledDeparture,
      };
    }
    const lookup = createTestScheduleLookup(scheduleTestScheduleOptions);
    const scheduledEvent =
      lookup.getScheduledDepartureEventBySegmentKey(segmentKey);
    if (!scheduledEvent) {
      return baseTrip;
    }
    const sameDayEvents = lookup.getScheduledDockEventsForSailingDay({
      vesselAbbrev: scheduledEvent.VesselAbbrev,
      sailingDay: scheduledEvent.SailingDay,
    });
    const scheduledSegment = inferScheduledSegmentFromDepartureEvent(
      scheduledEvent,
      sameDayEvents
    );
    return {
      ...baseTrip,
      ScheduleKey: scheduledSegment.Key ?? baseTrip.ScheduleKey,
      NextScheduleKey: scheduledSegment.NextKey ?? baseTrip.NextScheduleKey,
      NextScheduledDeparture:
        scheduledSegment.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
    };
  },
};

/**
 * Asserts {@link buildTrip} equals one {@link buildTripCore} call plus
 * {@link applyVesselPredictions} with the same adapters and model access (O2
 * parity). Uses a single core result to avoid duplicate async work.
 *
 * @remarks Uses module-scope {@link testBuildTripAdapters} for both paths (same
 * as the surrounding `buildTrip` tests).
 *
 * @param currLocation - Same as `buildTrip`
 * @param existingTrip - Same as `buildTrip`
 * @param tripStart - Same as `buildTrip`
 * @param events - Same as `buildTrip`
 * @param shouldRunPredictionFallback - Same as `buildTrip`
 * @param predictionModelAccess - Same as `buildTrip`
 */
const expectBuildTripParity = async (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTripWithPredictions | undefined,
  tripStart: boolean,
  events: TripEvents,
  shouldRunPredictionFallback: boolean,
  predictionModelAccess: VesselTripPredictionModelAccess
) => {
  const core = await buildTripCore(
    currLocation,
    existingTrip,
    tripStart,
    events,
    shouldRunPredictionFallback,
    testBuildTripAdapters
  );
  const manual = await applyVesselPredictions(
    predictionModelAccess,
    core.withFinalSchedule,
    core.gates
  );
  const composed = await buildTrip(
    currLocation,
    existingTrip,
    tripStart,
    events,
    shouldRunPredictionFallback,
    testBuildTripAdapters,
    predictionModelAccess
  );
  expect(manual).toEqual(composed);
};

describe("buildTrip", () => {
  it("preserves carried prediction state when schedule segment changes but TripKey is stable", async () => {
    const tripStartMs = ms("2026-03-13T09:00:00-07:00");
    const stableTripKey = generateTripKey("CHE", tripStartMs);
    const existingTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
      TripKey: stableTripKey,
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
      TripStart: tripStartMs,
      NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
      NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
      LeftDock: ms("2026-03-13T09:34:00-07:00"),
      AtDock: false,
      AtDockDepartCurr: makePrediction(ms("2026-03-13T09:36:00-07:00")),
      AtDockArriveNext: makePrediction(ms("2026-03-13T10:05:00-07:00")),
      AtDockDepartNext: makePrediction(ms("2026-03-13T10:22:00-07:00")),
      AtSeaArriveNext: makePrediction(ms("2026-03-13T10:04:00-07:00")),
      AtSeaDepartNext: makePrediction(ms("2026-03-13T10:20:00-07:00")),
    });
    const segmentKey = "CHE--2026-03-13--09:45--ORI-ANA";
    const segmentScheduledDeparture = ms("2026-03-13T09:45:00-07:00");
    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "ANA",
      ScheduledDeparture: segmentScheduledDeparture,
      LeftDock: existingTrip.LeftDock,
      ScheduleKey: segmentKey,
      TimeStamp: ms("2026-03-13T09:40:00-07:00"),
    });
    const scheduledEvent: ConvexScheduledDockEvent = {
      Key: segmentKey,
      SailingDay: "2026-03-13",
      VesselAbbrev: "CHE",
      UpdatedAt: ms("2026-03-13T09:40:00-07:00"),
      ScheduledDeparture: segmentScheduledDeparture,
      TerminalAbbrev: "ORI",
      NextTerminalAbbrev: "ANA",
      EventType: "dep-dock" as const,
      EventScheduledTime: segmentScheduledDeparture,
      IsLastArrivalOfSailingDay: false,
    };
    const nextScheduledSegment: ConvexScheduledDockEvent = {
      Key: "CHE--2026-03-13--11:00--ANA-SHI",
      SailingDay: "2026-03-13",
      VesselAbbrev: "CHE",
      UpdatedAt: ms("2026-03-13T09:40:00-07:00"),
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      TerminalAbbrev: "ANA",
      NextTerminalAbbrev: "SHI",
      EventType: "dep-dock",
      EventScheduledTime: ms("2026-03-13T11:00:00-07:00"),
      IsLastArrivalOfSailingDay: false,
    };
    const scheduledSegment: ConvexInferredScheduledSegment =
      inferScheduledSegmentFromDepartureEvent(scheduledEvent, [
        scheduledEvent,
        nextScheduledSegment,
      ]);

    scheduleTestScheduleOptions = {
      scheduledEventByKey: new Map([[scheduledEvent.Key, scheduledEvent]]),
      scheduledEventsByScope: new Map([
        ["CHE|2026-03-13", [scheduledEvent, nextScheduledSegment]],
      ]),
    };
    scheduleTestCtx = createTestActionCtx(scheduleTestScheduleOptions);
    const built = await buildTrip(
      currLocation,
      existingTrip,
      false,
      makeEvents({ scheduleKeyChanged: true }),
      false,
      testBuildTripAdapters,
      createTestPredictionAccess(scheduleTestCtx)
    );

    expect(built.TripKey).toBe(stableTripKey);
    expect(built.ScheduleKey).toBe(scheduledSegment.Key);
    expect(built.NextScheduleKey).toBe(scheduledSegment.NextKey);
    expect(built.NextScheduledDeparture).toBe(
      scheduledSegment.NextDepartingTime
    );
    expect(built.AtDockDepartCurr).toEqual(existingTrip.AtDockDepartCurr);
    expect(built.AtDockArriveNext).toEqual(existingTrip.AtDockArriveNext);
    expect(built.AtDockDepartNext).toEqual(existingTrip.AtDockDepartNext);
    expect(built.AtSeaArriveNext).toBeDefined();
    expect(built.AtSeaDepartNext).toBeDefined();
  });

  it("CAT continuity preserves the dock-owned identity through the leave-dock tick", async () => {
    const dockStart = ms("2026-04-12T16:32:00-07:00");
    const catTripKey = generateTripKey("CAT", dockStart);
    const existingTrip = makeTrip({
      VesselAbbrev: "CAT",
      ScheduleKey: "CAT--2026-04-12--16:50--SOU-VAI",
      TripKey: catTripKey,
      TripStart: dockStart,
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduledDeparture: ms("2026-04-12T16:50:00-07:00"),
      LeftDock: undefined,
      LeftDockActual: undefined,
      AtDockActual: dockStart,
      AtDock: true,
      TimeStamp: ms("2026-04-12T16:47:08-07:00"),
    });
    const currLocation = makeLocation({
      VesselAbbrev: "CAT",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduledDeparture: ms("2026-04-12T18:45:00-07:00"),
      LeftDock: ms("2026-04-12T16:53:14-07:00"),
      AtDock: false,
      ScheduleKey: "CAT--2026-04-12--18:45--SOU-VAI",
      TimeStamp: ms("2026-04-12T16:53:15-07:00"),
    });

    scheduleTestScheduleOptions = {};
    scheduleTestCtx = createTestActionCtx(scheduleTestScheduleOptions);
    const built = await buildTrip(
      currLocation,
      existingTrip,
      false,
      makeEvents({ didJustLeaveDock: true, scheduleKeyChanged: false }),
      false,
      testBuildTripAdapters,
      createTestPredictionAccess(scheduleTestCtx)
    );

    expect(built.ScheduleKey).toBe(existingTrip.ScheduleKey);
    expect(built.TripKey).toBe(catTripKey);
    expect(built.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
    expect(built.ScheduledDeparture).toBe(existingTrip.ScheduledDeparture);
    expect(built.LeftDock).toBe(currLocation.LeftDock);
  });

  it("clears stale schedule-derived fields when the same physical trip loses schedule attachment", async () => {
    const tripStartMs = ms("2026-04-12T17:21:00-07:00");
    const stableTripKey = generateTripKey("SAL", tripStartMs);
    const departureMs = ms("2026-04-12T17:24:00-07:00");
    const existingTrip = makeTrip({
      VesselAbbrev: "SAL",
      TripKey: stableTripKey,
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduleKey: "SAL--2026-04-12--17:45--SOU-VAI",
      SailingDay: "2026-04-12",
      ScheduledDeparture: undefined,
      AtDock: false,
      LeftDock: departureMs,
      LeftDockActual: departureMs,
      TripStart: tripStartMs,
      AtDockActual: tripStartMs,
      NextScheduleKey: "SAL--2026-04-12--18:20--VAI-FAU",
      NextScheduledDeparture: ms("2026-04-12T18:20:00-07:00"),
      AtDockArriveNext: makePrediction(ms("2026-04-12T18:05:00-07:00")),
      AtDockDepartNext: makePrediction(ms("2026-04-12T18:22:00-07:00")),
      AtSeaArriveNext: makePrediction(ms("2026-04-12T18:04:00-07:00")),
      AtSeaDepartNext: makePrediction(ms("2026-04-12T18:20:00-07:00")),
    });

    const currLocation = makeLocation({
      VesselAbbrev: "SAL",
      VesselName: "Salish",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDock: false,
      // This stays on the same physical trip after departure, but without any
      // trusted schedule attachment. The stale next-leg context should clear.
      LeftDock: departureMs,
      TimeStamp: ms("2026-04-12T17:31:30-07:00"),
    });

    scheduleTestScheduleOptions = {};
    scheduleTestCtx = createTestActionCtx(scheduleTestScheduleOptions);
    const built = await buildTrip(
      currLocation,
      existingTrip,
      false,
      makeEvents({ scheduleKeyChanged: true }),
      false,
      testBuildTripAdapters,
      createTestPredictionAccess(scheduleTestCtx)
    );

    expect(built.TripKey).toBe(stableTripKey);
    expect(built.ScheduleKey).toBeUndefined();
    expect(built.NextScheduleKey).toBeUndefined();
    expect(built.NextScheduledDeparture).toBeUndefined();
    expect(built.AtDockArriveNext).toBeUndefined();
    expect(built.AtDockDepartNext).toBeUndefined();
    expect(built.AtSeaArriveNext).toBeUndefined();
    expect(built.AtSeaDepartNext).toBeUndefined();
  });
});

describe("buildTrip O2 parity (core + predictions)", () => {
  it("O2 parity — preserves carried prediction state when schedule segment changes but TripKey is stable", async () => {
    const tripStartMs = ms("2026-03-13T09:00:00-07:00");
    const stableTripKey = generateTripKey("CHE", tripStartMs);
    const existingTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
      TripKey: stableTripKey,
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
      TripStart: tripStartMs,
      NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
      NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
      LeftDock: ms("2026-03-13T09:34:00-07:00"),
      AtDock: false,
      AtDockDepartCurr: makePrediction(ms("2026-03-13T09:36:00-07:00")),
      AtDockArriveNext: makePrediction(ms("2026-03-13T10:05:00-07:00")),
      AtDockDepartNext: makePrediction(ms("2026-03-13T10:22:00-07:00")),
      AtSeaArriveNext: makePrediction(ms("2026-03-13T10:04:00-07:00")),
      AtSeaDepartNext: makePrediction(ms("2026-03-13T10:20:00-07:00")),
    });
    const segmentKey = "CHE--2026-03-13--09:45--ORI-ANA";
    const segmentScheduledDeparture = ms("2026-03-13T09:45:00-07:00");
    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "ANA",
      ScheduledDeparture: segmentScheduledDeparture,
      LeftDock: existingTrip.LeftDock,
      ScheduleKey: segmentKey,
      TimeStamp: ms("2026-03-13T09:40:00-07:00"),
    });
    const scheduledEvent: ConvexScheduledDockEvent = {
      Key: segmentKey,
      SailingDay: "2026-03-13",
      VesselAbbrev: "CHE",
      UpdatedAt: ms("2026-03-13T09:40:00-07:00"),
      ScheduledDeparture: segmentScheduledDeparture,
      TerminalAbbrev: "ORI",
      NextTerminalAbbrev: "ANA",
      EventType: "dep-dock" as const,
      EventScheduledTime: segmentScheduledDeparture,
      IsLastArrivalOfSailingDay: false,
    };
    const nextScheduledSegment: ConvexScheduledDockEvent = {
      Key: "CHE--2026-03-13--11:00--ANA-SHI",
      SailingDay: "2026-03-13",
      VesselAbbrev: "CHE",
      UpdatedAt: ms("2026-03-13T09:40:00-07:00"),
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      TerminalAbbrev: "ANA",
      NextTerminalAbbrev: "SHI",
      EventType: "dep-dock",
      EventScheduledTime: ms("2026-03-13T11:00:00-07:00"),
      IsLastArrivalOfSailingDay: false,
    };

    scheduleTestScheduleOptions = {
      scheduledEventByKey: new Map([[scheduledEvent.Key, scheduledEvent]]),
      scheduledEventsByScope: new Map([
        ["CHE|2026-03-13", [scheduledEvent, nextScheduledSegment]],
      ]),
    };
    scheduleTestCtx = createTestActionCtx(scheduleTestScheduleOptions);
    const predictionAccess = createTestPredictionAccess(scheduleTestCtx);
    await expectBuildTripParity(
      currLocation,
      existingTrip,
      false,
      makeEvents({ scheduleKeyChanged: true }),
      false,
      predictionAccess
    );
  });

  it("O2 parity — CAT continuity preserves the dock-owned identity through the leave-dock tick", async () => {
    const dockStart = ms("2026-04-12T16:32:00-07:00");
    const catTripKey = generateTripKey("CAT", dockStart);
    const existingTrip = makeTrip({
      VesselAbbrev: "CAT",
      ScheduleKey: "CAT--2026-04-12--16:50--SOU-VAI",
      TripKey: catTripKey,
      TripStart: dockStart,
      SailingDay: "2026-03-13",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduledDeparture: ms("2026-04-12T16:50:00-07:00"),
      LeftDock: undefined,
      LeftDockActual: undefined,
      AtDockActual: dockStart,
      AtDock: true,
      TimeStamp: ms("2026-04-12T16:47:08-07:00"),
    });
    const currLocation = makeLocation({
      VesselAbbrev: "CAT",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduledDeparture: ms("2026-04-12T18:45:00-07:00"),
      LeftDock: ms("2026-04-12T16:53:14-07:00"),
      AtDock: false,
      ScheduleKey: "CAT--2026-04-12--18:45--SOU-VAI",
      TimeStamp: ms("2026-04-12T16:53:15-07:00"),
    });

    scheduleTestScheduleOptions = {};
    scheduleTestCtx = createTestActionCtx(scheduleTestScheduleOptions);
    const predictionAccess = createTestPredictionAccess(scheduleTestCtx);
    await expectBuildTripParity(
      currLocation,
      existingTrip,
      false,
      makeEvents({ didJustLeaveDock: true, scheduleKeyChanged: false }),
      false,
      predictionAccess
    );
  });
});

const makeEvents = (overrides: Partial<TripEvents> = {}): TripEvents => ({
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
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

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
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
  ScheduleKey: "CHE--2026-03-13--09:45--ORI-ANA",
  DepartingDistance: 0.5,
  ArrivingDistance: 5,
  ...overrides,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTripWithPredictions> = {}
): ConvexVesselTripWithPredictions => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalAbbrev: "LOP",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T09:00:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "SHI",
  ArriveDest: undefined,
  AtDockActual: ms("2026-03-13T09:00:00-07:00"),
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  AtDock: false,
  AtDockDuration: 10,
  ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  LeftDock: ms("2026-03-13T09:34:00-07:00"),
  LeftDockActual: ms("2026-03-13T09:34:00-07:00"),
  TripDelay: 4,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:39:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:10:00-07:00"),
  PrevLeftDock: ms("2026-03-13T08:12:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
  NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
