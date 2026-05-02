import { describe, expect, it } from "bun:test";
import type {
  ConvexPrediction,
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { projectTimelineFromHandoff } from "../projectTimelineFromHandoff";
import { updateTimeline } from "../updateTimeline";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: vesselAbbrev,
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  TripEnd: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
  TripDelay: undefined,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  ...overrides,
});

describe("projectTimelineFromHandoff", () => {
  it("applies successful-upsert gating for current-branch messages", () => {
    const currentTrip = makeTrip("TAC", {
      AtDock: false,
      LeftDockActual: ms("2026-03-13T06:40:00-07:00"),
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const handoff = {
      completedTripFacts: [],
      currentBranch: {
        pendingActualWrite: {
          didJustLeaveDock: true,
          didJustArriveAtDock: false,
          scheduleTrip: currentTrip,
          vesselAbbrev: "TAC",
        },
      },
    };

    const out = projectTimelineFromHandoff(
      handoff,
      [],
      ms("2026-03-13T06:40:10-07:00")
    );
    expect(out.actualEvents).toHaveLength(0);
    expect(out.predictedEvents).toHaveLength(0);
  });
});

describe("updateTimeline", () => {
  it("projects predicted rows from the enriched active trip", () => {
    const activeTrip = makeTrip("TAC", {
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const enrichedActiveTrip: ConvexVesselTripWithML = {
      ...activeTrip,
      AtDockDepartCurr: makePrediction(ms("2026-03-13T06:48:00-07:00")),
    };

    const out = updateTimeline({
      pingStartedAt: ms("2026-03-13T06:40:10-07:00"),
      tripUpdate: {
        vesselAbbrev: "TAC",
        activeVesselTrip: activeTrip,
      },
      enrichedActiveVesselTrip: enrichedActiveTrip,
    });

    expect(out.predictedEvents).toHaveLength(1);
    expect(out.predictedEvents[0]?.Rows[0]).toMatchObject({
      VesselAbbrev: "TAC",
      PredictionType: "AtDockDepartCurr",
      PredictionSource: "ml",
      EventPredictedTime: ms("2026-03-13T06:48:00-07:00"),
    });
  });

  it("projects completed rollover clears and replacement predicted rows", () => {
    const existingTrip = makeTrip("TAC", {
      ScheduleKey: "TAC--2026-03-13--05:30--ANA-ORI",
      TripKey: generateTripKey("TAC", ms("2026-03-13T04:33:00-07:00")),
    });
    const completedTrip = makeTrip("TAC", {
      ...existingTrip,
      TripEnd: ms("2026-03-13T06:42:00-07:00"),
    });
    const replacementTrip = makeTrip("TAC", {
      TripKey: generateTripKey("TAC", ms("2026-03-13T06:43:00-07:00")),
      ScheduleKey: "TAC--2026-03-13--06:45--ORI-ANA",
      ScheduledDeparture: ms("2026-03-13T06:45:00-07:00"),
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "ANA",
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const enrichedReplacementTrip: ConvexVesselTripWithML = {
      ...replacementTrip,
      AtDockDepartCurr: makePrediction(ms("2026-03-13T06:49:00-07:00")),
    };

    const out = updateTimeline({
      pingStartedAt: ms("2026-03-13T06:43:10-07:00"),
      tripUpdate: {
        vesselAbbrev: "TAC",
        existingVesselTrip: existingTrip,
        completedVesselTrip: completedTrip,
        activeVesselTrip: replacementTrip,
      },
      enrichedActiveVesselTrip: enrichedReplacementTrip,
    });

    expect(out.predictedEvents.some((batch) => batch.Rows.length === 0)).toBe(
      true
    );
    expect(
      out.predictedEvents.some((batch) =>
        batch.Rows.some(
          (row) =>
            row.PredictionType === "AtDockDepartCurr" &&
            row.EventPredictedTime === ms("2026-03-13T06:49:00-07:00")
        )
      )
    ).toBe(true);
  });
});

const makePrediction = (predTime: number): ConvexPrediction => ({
  PredTime: predTime,
  MinTime: predTime - 60_000,
  MaxTime: predTime + 60_000,
  MAE: 1,
  StdDev: 1,
  Actual: undefined,
  DeltaTotal: undefined,
  DeltaRange: undefined,
});
