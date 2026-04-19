/**
 * Unit tests for {@link buildVesselTripTickWriteSetFromBundle}.
 */

import { describe, expect, it } from "bun:test";
import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/tickLifecycle";
import type {
  ActiveTripsBranch,
  BuildTripCoreResult,
  PendingLeaveDockEffect,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { actualDepartMsForLeaveDockEffect } from "../leaveDockActualization";
import {
  buildVesselTripsExecutionPayloads,
  type VesselTripsExecutionPayload,
} from "../vesselTripsExecutionPayloads";
import {
  buildVesselTripTickWriteSetFromBundle,
  type VesselTripTickWriteSet,
} from "../vesselTripTickWriteSet";

const ms = (iso: string) => new Date(iso).getTime();

const JOINED_PREDICTION_KEYS = new Set([
  "AtDockDepartCurr",
  "AtDockArriveNext",
  "AtDockDepartNext",
  "AtSeaArriveNext",
  "AtSeaDepartNext",
]);

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
): BuildTripCoreResult => ({
  withFinalSchedule: trip,
  gates: {
    shouldAttemptAtDockPredictions: false,
    shouldAttemptAtSeaPredictions: false,
    didJustLeaveDock: false,
  },
});

const emptyCurrent = (): ActiveTripsBranch => ({
  activeUpserts: [],
  pendingActualMessages: [],
  pendingPredictedMessages: [],
  pendingLeaveDockEffects: [],
});

/**
 * Deterministic projection of {@link VesselTripTickWriteSet} from execution
 * payloads — must stay aligned with {@link buildVesselTripTickWriteSetFromBundle}.
 */
const projectWriteSetFromExecutionPayload = (
  p: VesselTripsExecutionPayload
): VesselTripTickWriteSet => {
  const leaveDockIntents: Array<{
    vesselAbbrev: string;
    actualDepartMs: number;
  }> = [];
  for (const effect of p.leaveDockEffects) {
    const actualDepartMs = actualDepartMsForLeaveDockEffect(effect);
    if (actualDepartMs === undefined) {
      continue;
    }
    leaveDockIntents.push({
      vesselAbbrev: effect.vesselAbbrev,
      actualDepartMs,
    });
  }
  return {
    attemptedHandoffs: p.handoffMutations,
    activeTripRows: p.activeUpsertBatch ?? [],
    leaveDockIntents,
  };
};

const assertNoJoinedPredictionKeysOnStoredTrips = (
  writeSet: VesselTripTickWriteSet
) => {
  const trips: object[] = [];
  for (const h of writeSet.attemptedHandoffs) {
    trips.push(h.completedTrip, h.newTrip);
  }
  for (const t of writeSet.activeTripRows) {
    trips.push(t);
  }
  for (const row of trips) {
    for (const key of Object.keys(row)) {
      expect(JOINED_PREDICTION_KEYS.has(key)).toBe(false);
    }
  }
};

describe("buildVesselTripTickWriteSetFromBundle", () => {
  it("matches execution payload projection for an empty bundle", () => {
    const bundle: VesselTripsComputeBundle = {
      completedHandoffs: [],
      current: emptyCurrent(),
    };
    const payload = buildVesselTripsExecutionPayloads(bundle);
    expect(buildVesselTripTickWriteSetFromBundle(bundle)).toEqual(
      projectWriteSetFromExecutionPayload(payload)
    );
  });

  it("structural parity for every fixture bundle", () => {
    const completed: CompletedTripBoundaryFact = {
      existingTrip: makeTrip(),
      tripToComplete: makeTrip({
        TripEnd: ms("2026-03-13T06:29:56-07:00"),
        EndTime: ms("2026-03-13T06:29:56-07:00"),
        AtDockDepartCurr: {
          PredTime: 1,
          Actual: 2,
          DeltaTotal: 0,
        },
      }),
      newTripCore: coreFromTrip(
        makeTrip({
          DepartingTerminalAbbrev: "ORI",
          ScheduleKey: "CHE--next",
        })
      ),
    };

    const activeTrip = makeTrip({ VesselAbbrev: "KWA" });

    const leaveEffect: PendingLeaveDockEffect = {
      vesselAbbrev: "CHE",
      trip: makeTrip({
        LeftDock: ms("2026-03-13T05:29:00-07:00"),
        LeftDockActual: ms("2026-03-13T05:29:01-07:00"),
      }),
    };

    const skipLeaveMs: PendingLeaveDockEffect = {
      vesselAbbrev: "XXX",
      trip: makeTrip({ LeftDock: undefined, LeftDockActual: undefined }),
    };

    const fixtures: VesselTripsComputeBundle[] = [
      { completedHandoffs: [], current: emptyCurrent() },
      {
        completedHandoffs: [completed],
        current: {
          ...emptyCurrent(),
          activeUpserts: [activeTrip],
        },
      },
      {
        completedHandoffs: [],
        current: {
          ...emptyCurrent(),
          pendingLeaveDockEffects: [leaveEffect, skipLeaveMs],
        },
      },
      {
        completedHandoffs: [completed],
        current: {
          ...emptyCurrent(),
          activeUpserts: [activeTrip],
          pendingLeaveDockEffects: [leaveEffect],
        },
      },
    ];

    for (const bundle of fixtures) {
      const payload = buildVesselTripsExecutionPayloads(bundle);
      const writeSet = buildVesselTripTickWriteSetFromBundle(bundle);
      expect(writeSet.attemptedHandoffs.length).toBe(
        bundle.completedHandoffs.length
      );
      expect(writeSet).toEqual(projectWriteSetFromExecutionPayload(payload));
      assertNoJoinedPredictionKeysOnStoredTrips(writeSet);
    }
  });

  it("omits leave-dock intents when LeftDock and LeftDockActual are undefined", () => {
    const bundle: VesselTripsComputeBundle = {
      completedHandoffs: [],
      current: {
        ...emptyCurrent(),
        pendingLeaveDockEffects: [
          {
            vesselAbbrev: "Z",
            trip: makeTrip({ LeftDock: undefined, LeftDockActual: undefined }),
          },
        ],
      },
    };
    expect(
      buildVesselTripTickWriteSetFromBundle(bundle).leaveDockIntents
    ).toEqual([]);
  });

  it("uses LeftDockActual over LeftDock for leave-dock intents", () => {
    const ld = ms("2026-03-13T05:00:00-07:00");
    const lda = ms("2026-03-13T05:00:01-07:00");
    const bundle: VesselTripsComputeBundle = {
      completedHandoffs: [],
      current: {
        ...emptyCurrent(),
        pendingLeaveDockEffects: [
          {
            vesselAbbrev: "CHE",
            trip: makeTrip({ LeftDock: ld, LeftDockActual: lda }),
          },
        ],
      },
    };
    expect(
      buildVesselTripTickWriteSetFromBundle(bundle).leaveDockIntents
    ).toEqual([{ vesselAbbrev: "CHE", actualDepartMs: lda }]);
  });
});
