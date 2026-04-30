import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { predictionInputsFromTripUpdate } from "../predictionInputsFromTripUpdate";

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

describe("predictionInputsFromTripUpdate", () => {
  it("returns only activeTrip for active-only updates", () => {
    const activeTrip = makeTrip("CHE");
    const result = predictionInputsFromTripUpdate({
      vesselAbbrev: "CHE",
      existingActiveTrip: undefined,
      activeVesselTripUpdate: activeTrip,
      completedVesselTripUpdate: undefined,
    });
    expect(result.activeTrip).toEqual(activeTrip);
    expect(result.completedHandoff).toBeUndefined();
  });

  it("returns completion handoff for completion + replacement updates", () => {
    const existingTrip = makeTrip("CHE", { ArrivedNextActual: undefined });
    const completedTrip = makeTrip("CHE", {
      ArrivedNextActual: ms("2026-03-13T06:45:00-07:00"),
      TripEnd: ms("2026-03-13T06:45:00-07:00"),
    });
    const replacementTrip = makeTrip("CHE", {
      TripKey: generateTripKey("CHE", ms("2026-03-13T06:46:00-07:00")),
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
    });
    const result = predictionInputsFromTripUpdate({
      vesselAbbrev: "CHE",
      existingActiveTrip: existingTrip,
      activeVesselTripUpdate: replacementTrip,
      completedVesselTripUpdate: completedTrip,
    });
    expect(result.activeTrip).toEqual(replacementTrip);
    expect(result.completedHandoff?.existingTrip).toEqual(existingTrip);
    expect(result.completedHandoff?.tripToComplete).toEqual(completedTrip);
    expect(result.completedHandoff?.scheduleTrip).toEqual(replacementTrip);
    expect(result.completedHandoff?.events.didJustArriveAtDock).toBe(true);
    expect(result.completedHandoff?.events.isCompletedTrip).toBe(true);
    expect(result.completedHandoff?.tripToComplete.ArrivedNextActual).toBe(
      ms("2026-03-13T06:45:00-07:00")
    );
  });
});
