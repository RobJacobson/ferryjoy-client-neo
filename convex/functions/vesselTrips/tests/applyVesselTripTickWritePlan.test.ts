/**
 * Unit tests for `applyVesselTripTickWritePlan`.
 */

import { describe, expect, it } from "bun:test";
import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/updateTimeline";
import type {
  CurrentTripTickWriteFragment,
  TripEvents,
} from "domain/vesselOrchestration/updateVesselTrips";
import { applyVesselTripTickWritePlan } from "functions/vesselTrips/applyVesselTripTickWritePlan";
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

/**
 * Builds a fake action context that records mutations and returns configurable
 * upsert results.
 *
 * @param options - Optional upsert result and complete-handoff failure flag
 * @returns Context compatible with {@link applyVesselTripTickWritePlan}
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

const emptyCurrent = (): CurrentTripTickWriteFragment => ({
  activeUpserts: [],
  pendingActualMessages: [],
  pendingPredictedMessages: [],
  pendingLeaveDockEffects: [],
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

describe("applyVesselTripTickWritePlan", () => {
  it("returns completed fact when handoff mutation succeeds", async () => {
    const existing = makeTrip();
    const tripToComplete = makeTrip({
      TripEnd: ms("2026-03-13T06:29:56-07:00"),
    });
    const newTrip = makeTrip({
      ScheduleKey: "CHE--next",
      DepartingTerminalAbbrev: "ORI",
    });
    const fact: CompletedTripBoundaryFact = {
      existingTrip: existing,
      tripToComplete,
      newTrip,
    };
    const ctx = createCtx();
    const { completedFacts } = await applyVesselTripTickWritePlan(
      ctx as never,
      {
        completedHandoffs: [fact],
        current: emptyCurrent(),
      }
    );
    expect(completedFacts).toHaveLength(1);
    expect(completedFacts[0]?.newTrip.ScheduleKey).toBe("CHE--next");
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
    const fact: CompletedTripBoundaryFact = {
      existingTrip: makeTrip(),
      tripToComplete: makeTrip(),
      newTrip: makeTrip(),
    };
    const ctx = createCtx({ failCompleteHandoff: true });
    const { completedFacts } = await applyVesselTripTickWritePlan(
      ctx as never,
      {
        completedHandoffs: [fact],
        current: emptyCurrent(),
      }
    );
    expect(completedFacts).toHaveLength(0);
  });

  it("does not call upsertVesselTripsBatch when activeUpserts is empty", async () => {
    const ctx = createCtx();
    await applyVesselTripTickWritePlan(ctx as never, {
      completedHandoffs: [],
      current: emptyCurrent(),
    });
    expect(
      ctx.mutationCalls.some((c) => c.args && "activeUpserts" in c.args)
    ).toBe(false);
  });

  it("overlay-only: skips batch, empty successfulVessels, keeps pending messages", async () => {
    const trip = makeTrip();
    const pendingActualMessages = [
      {
        events: minimalTripEvents,
        finalProposed: trip,
        vesselAbbrev: "CHE",
        requiresSuccessfulUpsert: false,
      },
    ];
    const ctx = createCtx();
    const { currentBranch } = await applyVesselTripTickWritePlan(ctx as never, {
      completedHandoffs: [],
      current: {
        activeUpserts: [],
        pendingActualMessages,
        pendingPredictedMessages: [],
        pendingLeaveDockEffects: [],
      },
    });
    expect(
      ctx.mutationCalls.some((c) => c.args && "activeUpserts" in c.args)
    ).toBe(false);
    expect(currentBranch.successfulVessels.size).toBe(0);
    expect(currentBranch.pendingActualMessages).toEqual(pendingActualMessages);
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
    await applyVesselTripTickWritePlan(ctx as never, {
      completedHandoffs: [],
      current: {
        activeUpserts: [trip],
        pendingActualMessages: [],
        pendingPredictedMessages: [],
        pendingLeaveDockEffects: [{ vesselAbbrev: "CHE", trip }],
      },
    });
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
    await applyVesselTripTickWritePlan(ctxOk as never, {
      completedHandoffs: [],
      current: {
        activeUpserts: [trip],
        pendingActualMessages: [],
        pendingPredictedMessages: [],
        pendingLeaveDockEffects: [{ vesselAbbrev: "CHE", trip }],
      },
    });
    expect(
      ctxOk.mutationCalls.some(
        (c) =>
          c.args && "actualDepartMs" in c.args && c.args.vesselAbbrev === "CHE"
      )
    ).toBe(true);
  });
});
