/**
 * Characterization tests for direct trip-delta event projection.
 */

import { describe, expect, it } from "bun:test";
import {
  getDockTransitionEvents,
  type VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrip";
import type {
  ConvexPrediction,
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  buildLeaveDockEventPatch,
  projectEventsFromTripDelta,
} from "../projectEventsFromTripDelta";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: vesselAbbrev,
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
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

const makeTripUpdate = (
  overrides: Partial<VesselTripUpdate> & {
    activeVesselTrip: ConvexVesselTrip;
    vesselAbbrev: string;
  }
): VesselTripUpdate => {
  const base = {
    completedVesselTrip: undefined,
    existingVesselTrip: undefined,
    ...overrides,
  };

  return {
    ...base,
    dockTransitions:
      overrides.dockTransitions ??
      getDockTransitionEvents(base.existingVesselTrip, base.activeVesselTrip),
  };
};

describe("projectEventsFromTripDelta", () => {
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

    const out = projectEventsFromTripDelta({
      pingStartedAt: ms("2026-03-13T06:40:10-07:00"),
      tripUpdate: makeTripUpdate({
        vesselAbbrev: "TAC",
        activeVesselTrip: activeTrip,
      }),
      enrichedActiveVesselTrip: enrichedActiveTrip,
    });

    expect(out.predictedEvents).toHaveLength(1);
    expect(out.predictedEvents[0]?.Rows[0]).toMatchObject({
      VesselAbbrev: "TAC",
      PredictionType: "AtDockDepartCurr",
      PredictionSource: "ml",
      EventPredictedTime: ms("2026-03-13T06:48:00-07:00"),
    });
    expect(out.updateLeaveDockEventPatch).toBeUndefined();
  });

  it("projects completed rollover clears and replacement predicted rows", () => {
    const existingTrip = makeTrip("TAC", {
      ScheduleKey: "TAC--2026-03-13--05:30--ANA-ORI",
      TripKey: "TAC--2026-03-13--05:30--ANA-ORI",
    });
    const completedTrip = makeTrip("TAC", {
      ...existingTrip,
      TripEnd: ms("2026-03-13T06:42:00-07:00"),
    });
    const replacementTrip = makeTrip("TAC", {
      TripKey: "TAC--2026-03-13--06:45--ORI-ANA",
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

    const out = projectEventsFromTripDelta({
      pingStartedAt: ms("2026-03-13T06:43:10-07:00"),
      tripUpdate: makeTripUpdate({
        vesselAbbrev: "TAC",
        existingVesselTrip: existingTrip,
        completedVesselTrip: completedTrip,
        activeVesselTrip: replacementTrip,
      }),
      enrichedActiveVesselTrip: enrichedReplacementTrip,
    });

    expect(
      out.predictedEvents.filter((batch) => batch.Rows.length > 0)
    ).toHaveLength(1);
    expect(
      out.predictedEvents.filter((batch) => batch.Rows.length > 0)[0]?.Rows[0]
    ).toMatchObject({
      PredictionType: "AtDockDepartCurr",
      EventPredictedTime: ms("2026-03-13T06:49:00-07:00"),
    });
    expect(out.actualEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("emits leave-dock actual row and ML actualization patch", () => {
    const existingTrip = makeTrip("TAC", {
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const activeTrip = makeTrip("TAC", {
      AtDock: false,
      LeftDock: ms("2026-03-13T06:40:00.789-07:00"),
      LeftDockActual: ms("2026-03-13T06:40:00.789-07:00"),
    });
    const enrichedActiveTrip: ConvexVesselTripWithML = { ...activeTrip };

    const out = projectEventsFromTripDelta({
      pingStartedAt: ms("2026-03-13T06:40:10-07:00"),
      tripUpdate: makeTripUpdate({
        vesselAbbrev: "TAC",
        existingVesselTrip: existingTrip,
        activeVesselTrip: activeTrip,
      }),
      enrichedActiveVesselTrip: enrichedActiveTrip,
    });

    expect(out.actualEvents.some((row) => row.EventType === "dep-dock")).toBe(
      true
    );
    expect(out.updateLeaveDockEventPatch).toEqual({
      vesselAbbrev: "TAC",
      depBoundaryKey: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
      actualDepartMs: ms("2026-03-13T06:40:00.000-07:00"),
    });
  });

  it("clears stale predictions when schedule identity changes", () => {
    const existingTrip = makeTrip("TAC", {
      ScheduleKey: "TAC--2026-03-13--05:30--ANA-ORI",
      SailingDay: "2026-03-13",
      AtDock: true,
      LeftDockActual: undefined,
    });
    const activeTrip = makeTrip("TAC", {
      ScheduleKey: "TAC--2026-03-13--06:45--ORI-ANA",
      SailingDay: "2026-03-13",
      TripKey: "TAC--2026-03-13--06:45--ORI-ANA",
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "ANA",
      AtDock: true,
      LeftDockActual: undefined,
    });
    const enrichedActiveTrip: ConvexVesselTripWithML = {
      ...activeTrip,
      AtDockDepartCurr: makePrediction(ms("2026-03-13T06:49:00-07:00")),
    };

    const out = projectEventsFromTripDelta({
      pingStartedAt: ms("2026-03-13T06:43:10-07:00"),
      tripUpdate: makeTripUpdate({
        vesselAbbrev: "TAC",
        existingVesselTrip: existingTrip,
        activeVesselTrip: activeTrip,
      }),
      enrichedActiveVesselTrip: enrichedActiveTrip,
    });

    expect(out.predictedEvents.some((batch) => batch.Rows.length === 0)).toBe(
      true
    );
  });

  it("skips dependent rows when required trip fields are missing", () => {
    const existingTrip = makeTrip("TAC", { AtDock: true });
    const activeTrip = makeTrip("TAC", {
      AtDock: false,
      ScheduleKey: undefined,
      LeftDockActual: undefined,
    });

    const out = projectEventsFromTripDelta({
      pingStartedAt: ms("2026-03-13T06:40:10-07:00"),
      tripUpdate: makeTripUpdate({
        vesselAbbrev: "TAC",
        existingVesselTrip: existingTrip,
        activeVesselTrip: activeTrip,
        dockTransitions: {
          didJustLeaveDock: true,
          didJustArriveAtDock: false,
        },
      }),
      enrichedActiveVesselTrip: { ...activeTrip },
    });

    expect(out.actualEvents).toHaveLength(0);
    expect(out.updateLeaveDockEventPatch).toBeUndefined();
  });
});

describe("buildLeaveDockEventPatch", () => {
  it("returns undefined when transition is not didJustLeaveDock", () => {
    const result = buildLeaveDockEventPatch(
      makeTripUpdate({
        vesselAbbrev: "TAC",
        existingVesselTrip: makeTrip("TAC", { AtDock: false }),
        activeVesselTrip: makeTrip("TAC", { AtDock: false }),
      })
    );

    expect(result).toBeUndefined();
  });
});
