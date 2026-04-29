import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { timelineHandoffFromTripUpdate } from "../timelineHandoffFromTripUpdate";

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
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
  ArrivedCurrActual: ms("2026-03-13T04:33:00-07:00"),
  ArrivedNextActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  EndTime: undefined,
  StartTime: ms("2026-03-13T04:33:00-07:00"),
  AtDockActual: ms("2026-03-13T04:33:00-07:00"),
  ...overrides,
});

describe("timelineHandoffFromTripUpdate", () => {
  it("builds completion plus replacement active handoff", () => {
    const existing = makeTrip("CHE", { ArrivedNextActual: undefined });
    const completed = makeTrip("CHE", {
      ArrivedNextActual: ms("2026-03-13T06:45:00-07:00"),
      TripEnd: ms("2026-03-13T06:45:00-07:00"),
    });
    const replacement = makeTrip("CHE", {
      TripKey: generateTripKey("CHE", ms("2026-03-13T06:46:00-07:00")),
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
      AtDock: true,
      LeftDockActual: undefined,
    });
    const result = timelineHandoffFromTripUpdate({
      vesselAbbrev: "CHE",
      existingActiveTrip: existing,
      activeVesselTripUpdate: replacement,
      completedVesselTripUpdate: completed,
    });
    expect(result.completedTripFacts).toHaveLength(1);
    expect(result.completedTripFacts[0]?.tripToComplete).toEqual(completed);
    expect(result.completedTripFacts[0]?.scheduleTrip).toEqual(replacement);
    expect(result.currentBranch.pendingActualWrite).toBeUndefined();
    expect(result.currentBranch.pendingPredictedWrite?.scheduleTrip).toEqual(
      replacement
    );
  });

  it("builds active-only current branch handoff", () => {
    const existing = makeTrip("TAC", { AtDock: true });
    const active = makeTrip("TAC", {
      AtDock: false,
      LeftDockActual: ms("2026-03-13T06:40:00-07:00"),
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const result = timelineHandoffFromTripUpdate({
      vesselAbbrev: "TAC",
      existingActiveTrip: existing,
      activeVesselTripUpdate: active,
      completedVesselTripUpdate: undefined,
    });
    expect(result.completedTripFacts).toEqual([]);
    expect(
      result.currentBranch.pendingActualWrite?.events.didJustLeaveDock
    ).toBe(true);
    expect(result.currentBranch.pendingPredictedWrite?.scheduleTrip).toEqual(
      active
    );
  });
});
