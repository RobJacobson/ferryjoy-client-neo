/** Unit tests for {@link persistVesselTripWriteSet}. */

import { describe, expect, it } from "bun:test";
import { api } from "_generated/api";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/updateVesselPredictions";
import type {
  RunUpdateVesselTripsOutput,
  TripEvents,
  TripScheduleCoreResult,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/updateVesselTrips";
import {
  persistVesselTripWriteSet,
  type VesselTripTableMutations,
  type VesselTripUpsertBatchResult,
} from "functions/vesselOrchestrator/persistVesselTripWriteSet";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

type TestCtx = {
  runMutation: (
    ref: unknown,
    args?: Record<string, unknown>
  ) => Promise<unknown>;
  mutationCalls: Array<{ ref: unknown; args?: Record<string, unknown> }>;
};

const ms = (iso: string) => new Date(iso).getTime();

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
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
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

const coreFromTrip = (
  trip: ConvexVesselTripWithPredictions
): TripScheduleCoreResult => ({
  withFinalSchedule: trip,
});

/**
 * Builds a fake action context that records mutations and returns configurable
 * upsert results.
 *
 * @param options - Optional upsert result and complete-handoff failure flag
 * @returns Context compatible with {@link persistVesselTripWriteSet} mutations
 */
const createCtx = (options?: {
  upsertResult?: {
    perVessel: Array<{ vesselAbbrev: string; ok: boolean; reason?: string }>;
  };
  failCompleteHandoff?: boolean;
}): TestCtx => {
  const mutationCalls: TestCtx["mutationCalls"] = [];
  return {
    mutationCalls,
    runMutation: async (_ref, args) => {
      mutationCalls.push({ ref: _ref, args });
      if (args && "activeUpserts" in args) {
        return (
          options?.upsertResult ?? {
            perVessel: (
              args as { activeUpserts: ConvexVesselTripWithPredictions[] }
            ).activeUpserts.map((t) => ({
              vesselAbbrev: t.VesselAbbrev,
              ok: true,
            })),
          }
        );
      }
      if (
        args &&
        typeof args === "object" &&
        "completedTrip" in args &&
        "newTrip" in args &&
        options?.failCompleteHandoff
      ) {
        throw new Error("completeAndStart failed");
      }
      if (
        args &&
        typeof args === "object" &&
        "vesselAbbrev" in args &&
        "actualDepartMs" in args
      ) {
        return { updated: false as const };
      }
      return null;
    },
  };
};

const vesselTripTableMutationsFromCtx = (
  ctx: TestCtx
): VesselTripTableMutations => ({
  completeAndStartNewTrip: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations.completeAndStartNewTrip,
      args
    ),
  upsertVesselTripsBatch: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      args
    ) as Promise<VesselTripUpsertBatchResult>,
  setDepartNextActualsForMostRecentCompletedTrip: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations
        .setDepartNextActualsForMostRecentCompletedTrip,
      args
    ),
});

const minimalTripEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
};

const buildTripsFixture = (input: {
  completedFacts?: Array<{
    existingTrip: ConvexVesselTripWithPredictions;
    tripToComplete: ConvexVesselTripWithPredictions;
    newTrip: ConvexVesselTripWithPredictions;
    events?: TripEvents;
  }>;
  currentTrips?: Array<{
    trip: ConvexVesselTripWithPredictions;
    existingTrip?: ConvexVesselTripWithPredictions;
    events?: TripEvents;
    persisted?: boolean;
  }>;
}): {
  trips: RunUpdateVesselTripsOutput;
  tripsCompute: VesselTripsComputeBundle;
} => ({
  trips: {
    activeTrips: [
      ...(input.completedFacts ?? []).map((fact) =>
        stripTripPredictionsForStorage(fact.newTrip)
      ),
      ...(input.currentTrips ?? []).flatMap((currentTrip) =>
        currentTrip.persisted === false
          ? []
          : [stripTripPredictionsForStorage(currentTrip.trip)]
      ),
    ],
    completedTrips: (input.completedFacts ?? []).map((fact) =>
      stripTripPredictionsForStorage(fact.tripToComplete)
    ),
  },
  tripsCompute: {
    completedHandoffs: (input.completedFacts ?? []).map((fact) => ({
      existingTrip: fact.existingTrip,
      tripToComplete: fact.tripToComplete,
      events: fact.events ?? minimalTripEvents,
      newTripCore: coreFromTrip(fact.newTrip),
    })),
    current: {
      activeUpserts: (input.currentTrips ?? []).flatMap((currentTrip) =>
        currentTrip.persisted === false ? [] : [currentTrip.trip]
      ),
      pendingActualMessages: (input.currentTrips ?? []).flatMap((currentTrip) =>
        currentTrip.events === undefined
          ? []
          : [
              {
                events: currentTrip.events,
                tripCore: coreFromTrip(currentTrip.trip),
                vesselAbbrev: currentTrip.trip.VesselAbbrev,
                requiresSuccessfulUpsert: currentTrip.persisted !== false,
              },
            ]
      ),
      pendingPredictedMessages: (input.currentTrips ?? []).map((currentTrip) => ({
        existingTrip: currentTrip.existingTrip,
        tripCore: coreFromTrip(currentTrip.trip),
        vesselAbbrev: currentTrip.trip.VesselAbbrev,
        requiresSuccessfulUpsert: currentTrip.persisted !== false,
      })),
      pendingLeaveDockEffects: (input.currentTrips ?? []).flatMap((currentTrip) =>
        currentTrip.events?.didJustLeaveDock === true &&
        currentTrip.trip.LeftDockActual !== undefined &&
        currentTrip.persisted !== false
          ? [
              {
                vesselAbbrev: currentTrip.trip.VesselAbbrev,
                trip: currentTrip.trip,
              },
            ]
          : []
      ),
    },
  },
});

describe("persistVesselTripWriteSet", () => {
  it("returns completed fact when handoff mutation succeeds", async () => {
    const existing = makeTrip();
    const tripToComplete = makeTrip({
      TripEnd: ms("2026-03-13T06:29:56-07:00"),
    });
    const newTrip = makeTrip({
      ScheduleKey: "CHE--next",
      DepartingTerminalAbbrev: "ORI",
    });
    const ctx = createCtx();
    const fixture = buildTripsFixture({
      completedFacts: [{ existingTrip: existing, tripToComplete, newTrip }],
    });
    const { completedFacts } = await persistVesselTripWriteSet(
      fixture.trips,
      fixture.tripsCompute,
      vesselTripTableMutationsFromCtx(ctx)
    );
    expect(completedFacts).toHaveLength(1);
    expect(completedFacts[0]?.newTripCore.withFinalSchedule.ScheduleKey).toBe(
      "CHE--next"
    );
    expect(
      ctx.mutationCalls.some(
        (c) =>
          c.args &&
          "completedTrip" in c.args &&
          "newTrip" in c.args &&
          !("activeUpserts" in c.args)
      )
    ).toBe(true);
  });

  it("drops completed fact when handoff mutation throws", async () => {
    const ctx = createCtx({ failCompleteHandoff: true });
    const fixture = buildTripsFixture({
      completedFacts: [
        {
          existingTrip: makeTrip(),
          tripToComplete: makeTrip(),
          newTrip: makeTrip(),
        },
      ],
    });
    const { completedFacts } = await persistVesselTripWriteSet(
      fixture.trips,
      fixture.tripsCompute,
      vesselTripTableMutationsFromCtx(ctx)
    );
    expect(completedFacts).toHaveLength(0);
  });

  it("does not call upsertVesselTripsBatch when activeUpserts is empty", async () => {
    const ctx = createCtx();
    const fixture = buildTripsFixture({});
    await persistVesselTripWriteSet(
      fixture.trips,
      fixture.tripsCompute,
      vesselTripTableMutationsFromCtx(ctx)
    );
    expect(
      ctx.mutationCalls.some((c) => c.args && "activeUpserts" in c.args)
    ).toBe(false);
  });

  it("overlay-only: skips batch, empty successfulVessels, keeps pending messages", async () => {
    const trip = makeTrip();
    const pendingActualMessages = [
      {
        events: minimalTripEvents,
        tripCore: coreFromTrip(trip),
        vesselAbbrev: "CHE",
        requiresSuccessfulUpsert: false,
      },
    ];
    const ctx = createCtx();
    const fixture = buildTripsFixture({
      currentTrips: [
        {
          trip,
          events: minimalTripEvents,
          persisted: false,
        },
      ],
    });
    const { currentBranch } = await persistVesselTripWriteSet(
      fixture.trips,
      fixture.tripsCompute,
      vesselTripTableMutationsFromCtx(ctx)
    );
    expect(
      ctx.mutationCalls.some((c) => c.args && "activeUpserts" in c.args)
    ).toBe(false);
    expect(currentBranch.successfulVessels.size).toBe(0);
    expect(currentBranch.pendingActualMessages).toEqual(pendingActualMessages);
  });

  it("persists quiet current active upserts even when no timeline messages are emitted", async () => {
    const trip = makeTrip({
      VesselAbbrev: "TAC",
      TripKey: generateTripKey("TAC", ms("2026-03-13T05:00:00-07:00")),
      ScheduleKey: "TAC--2026-03-13--05:15--P52-BBI",
    });
    const ctx = createCtx();

    const { currentBranch } = await persistVesselTripWriteSet(
      {
        activeTrips: [stripTripPredictionsForStorage(trip)],
        completedTrips: [],
      },
      {
        completedHandoffs: [],
        current: {
          activeUpserts: [trip],
          pendingActualMessages: [],
          pendingPredictedMessages: [],
          pendingLeaveDockEffects: [],
        },
      },
      vesselTripTableMutationsFromCtx(ctx)
    );

    expect(
      ctx.mutationCalls.some((c) => {
        if (
          c.args === undefined ||
          typeof c.args !== "object" ||
          !("activeUpserts" in c.args)
        ) {
          return false;
        }

        const { activeUpserts } = c.args as {
          activeUpserts: Array<{ VesselAbbrev: string }>;
        };
        return activeUpserts[0]?.VesselAbbrev === "TAC";
      })
    ).toBe(true);
    expect(currentBranch.successfulVessels.has("TAC")).toBe(true);
    expect(currentBranch.pendingActualMessages).toEqual([]);
    expect(currentBranch.pendingPredictedMessages).toEqual([]);
  });

  it("runs leave-dock only for vessels that upserted successfully", async () => {
    const trip = makeTrip({
      LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
    });
    const ctx = createCtx({
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: false, reason: "db" }],
      },
    });
    const failedFixture = buildTripsFixture({
      currentTrips: [
        {
          trip,
          events: {
            ...minimalTripEvents,
            didJustLeaveDock: true,
          },
        },
      ],
    });
    await persistVesselTripWriteSet(
      failedFixture.trips,
      failedFixture.tripsCompute,
      vesselTripTableMutationsFromCtx(ctx)
    );
    expect(
      ctx.mutationCalls.some(
        (c) =>
          c.args && "actualDepartMs" in c.args && c.args.vesselAbbrev === "CHE"
      )
    ).toBe(false);

    const ctxOk = createCtx({
      upsertResult: {
        perVessel: [{ vesselAbbrev: "CHE", ok: true }],
      },
    });
    const okFixture = buildTripsFixture({
      currentTrips: [
        {
          trip,
          events: {
            ...minimalTripEvents,
            didJustLeaveDock: true,
          },
        },
      ],
    });
    await persistVesselTripWriteSet(
      okFixture.trips,
      okFixture.tripsCompute,
      vesselTripTableMutationsFromCtx(ctxOk)
    );
    const leaveDockCall = ctxOk.mutationCalls.find(
      (c) =>
        c.args && "actualDepartMs" in c.args && c.args.vesselAbbrev === "CHE"
    );
    expect(leaveDockCall).toBeDefined();
    expect(
      (leaveDockCall?.args as { actualDepartMs: number }).actualDepartMs
    ).toBe(ms("2026-03-13T05:29:38-07:00"));
  });
});
