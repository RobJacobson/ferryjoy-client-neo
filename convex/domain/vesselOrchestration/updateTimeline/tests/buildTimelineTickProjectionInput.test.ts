/**
 * Pure **updateTimeline** assembly: lifecycle outcomes → `TimelineTickProjectionInput`.
 */

import { describe, expect, it } from "bun:test";
import { mergeTickEventWrites } from "domain/vesselOrchestration/updateTimeline/tickEventWrites";
import {
  buildTickEventWritesFromCompletedFacts,
  buildTickEventWritesFromCurrentMessages,
} from "domain/vesselOrchestration/updateTimeline/timelineEventAssembler";
import type {
  CompletedTripBoundaryFact,
  CurrentTripLifecycleBranchResult,
} from "domain/vesselOrchestration/updateTimeline/types";
import type { TripScheduleCoreResult } from "domain/vesselOrchestration/updateVesselTrips";
import type {
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { buildTimelineTickProjectionInput } from "../buildTimelineTickProjectionInput";

/**
 * Convert an ISO timestamp into epoch milliseconds.
 *
 * @param iso - ISO-8601 timestamp string
 * @returns Epoch milliseconds for the provided timestamp
 */
const ms = (iso: string) => new Date(iso).getTime();

/**
 * Minimal stored trip row for projection fixtures (aligned with
 * `processCompletedTrips` tests).
 *
 * @param overrides - Scenario-specific field overrides
 * @returns Trip payload suitable for `CompletedTripBoundaryFact`
 */
const stubTrip = (
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

const emptyCurrentBranch = (): CurrentTripLifecycleBranchResult => ({
  successfulVessels: new Set<string>(),
  pendingActualMessages: [],
  pendingPredictedMessages: [],
});

/**
 * One synthetic boundary fact that yields non-empty assembler output (dep + arv
 * actuals and predicted batches), matching the shape produced by
 * `processCompletedTrips` on success.
 */
const oneCompletedBoundaryFact = (): CompletedTripBoundaryFact => {
  const existingTrip = stubTrip({
    LeftDock: ms("2026-03-13T05:29:38-07:00"),
  });
  const tripToComplete = stubTrip({
    LeftDock: existingTrip.LeftDock,
    LeftDockActual: existingTrip.LeftDock,
    ArriveDest: ms("2026-03-13T06:29:56-07:00"),
    ArrivedNextActual: ms("2026-03-13T06:29:56-07:00"),
    TripEnd: ms("2026-03-13T06:29:56-07:00"),
  });
  const newTrip = stubTrip({
    DepartingTerminalAbbrev: "ORI",
    ArrivingTerminalAbbrev: "LOP",
    ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
    SailingDay: "2026-03-13",
    ScheduledDeparture: ms("2026-03-13T06:50:00-07:00"),
  });

  const newTripCore: TripScheduleCoreResult = {
    withFinalSchedule: newTrip,
  };

  return {
    existingTrip,
    tripToComplete,
    events: {
      isFirstTrip: false,
      isTripStartReady: false,
      shouldStartTrip: false,
      isCompletedTrip: false,
      didJustArriveAtDock: false,
      didJustLeaveDock: false,
      scheduleKeyChanged: false,
    },
    newTripCore,
    newTrip: newTrip as ConvexVesselTripWithML,
  };
};

describe("buildTimelineTickProjectionInput", () => {
  it("returns empty writes for empty lifecycle outcomes", () => {
    const tickStartedAt = 1_700_000_000_000;
    expect(
      buildTimelineTickProjectionInput({
        completedFacts: [],
        currentBranch: emptyCurrentBranch(),
        tickStartedAt,
      })
    ).toEqual({
      actualDockWrites: [],
      predictedDockWriteBatches: [],
    });
  });

  it("matches explicit merge of assembler outputs (completed then current)", () => {
    const tickStartedAt = 1_701_000_000_000;
    const completedFacts: CompletedTripBoundaryFact[] = [];
    const currentBranch = emptyCurrentBranch();
    expect(
      buildTimelineTickProjectionInput({
        completedFacts,
        currentBranch,
        tickStartedAt,
      })
    ).toEqual(
      mergeTickEventWrites(
        buildTickEventWritesFromCompletedFacts(completedFacts, tickStartedAt),
        buildTickEventWritesFromCurrentMessages(
          currentBranch.successfulVessels,
          currentBranch.pendingActualMessages,
          currentBranch.pendingPredictedMessages,
          tickStartedAt
        )
      )
    );
  });

  it("throws when a completed boundary fact lacks newTrip before timeline merge", () => {
    const tickStartedAt = 1_703_000_000_000;
    const completedFacts = [
      { ...oneCompletedBoundaryFact(), newTrip: undefined },
    ];
    expect(() =>
      buildTimelineTickProjectionInput({
        completedFacts,
        currentBranch: emptyCurrentBranch(),
        tickStartedAt,
      })
    ).toThrow("updateVesselPredictions merge");
  });

  it("matches explicit merge when completed facts produce non-empty writes", () => {
    const tickStartedAt = 1_702_000_000_000;
    const completedFacts = [oneCompletedBoundaryFact()];
    const currentBranch = emptyCurrentBranch();
    const merged = buildTimelineTickProjectionInput({
      completedFacts,
      currentBranch,
      tickStartedAt,
    });

    expect(merged.actualDockWrites.length).toBeGreaterThan(0);
    expect(merged.predictedDockWriteBatches.length).toBeGreaterThan(0);
    expect(merged).toEqual(
      mergeTickEventWrites(
        buildTickEventWritesFromCompletedFacts(completedFacts, tickStartedAt),
        buildTickEventWritesFromCurrentMessages(
          currentBranch.successfulVessels,
          currentBranch.pendingActualMessages,
          currentBranch.pendingPredictedMessages,
          tickStartedAt
        )
      )
    );
  });
});
