import { describe, expect, it } from "bun:test";
import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrip/lifecycle";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

describe("detectTripEvents", () => {
  it("does not treat an overnight destination-field change as arrival at dock", () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      TripStart: ms("2026-03-12T20:32:59-07:00"),
      LeftDock: undefined,
      ArriveDest: undefined,
      AtDock: true,
      TimeStamp: ms("2026-03-13T03:08:47-07:00"),
    });

    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "ORI",
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      AtDock: true,
      TimeStamp: ms("2026-03-13T03:08:47-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.didJustArriveAtDock).toBe(false);
  });

  it("detects arrival only after the vessel has left dock and is docked at a new terminal", () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "ORI",
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      TripStart: ms("2026-03-13T04:33:00-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      ArriveDest: undefined,
      AtDock: false,
      TimeStamp: ms("2026-03-13T06:28:45-07:00"),
    });

    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduledDeparture: ms("2026-03-13T06:50:00-07:00"),
      AtDock: true,
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.didJustArriveAtDock).toBe(true);
    expect(events.isCompletedTrip).toBe(true);
  });

  it("detects arrival even when the stored expected destination is stale", () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "FAU",
      ArrivingTerminalAbbrev: "PPD",
      ScheduledDeparture: ms("2026-03-13T19:35:00-07:00"),
      TripStart: ms("2026-03-13T19:23:56-07:00"),
      LeftDock: ms("2026-03-13T19:36:10-07:00"),
      ArriveDest: undefined,
      AtDock: false,
      TimeStamp: ms("2026-03-13T19:48:45-07:00"),
    });

    const currLocation = makeLocation({
      VesselAbbrev: "CAT",
      DepartingTerminalAbbrev: "VAI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      AtDock: true,
      TimeStamp: ms("2026-03-13T19:49:06-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.didJustArriveAtDock).toBe(true);
    expect(events.isCompletedTrip).toBe(true);
  });

  it("completes the trip on arrival even when the next-trip feed fields are missing", () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "ORI",
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      TripStart: ms("2026-03-13T04:33:00-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      ArriveDest: undefined,
      AtDock: false,
      TimeStamp: ms("2026-03-13T06:28:45-07:00"),
    });

    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      AtDock: true,
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.isTripStartReady).toBe(false);
    expect(events.didJustArriveAtDock).toBe(true);
    expect(events.isCompletedTrip).toBe(true);
  });

  it("does not infer departure from AtDock false without LeftDock", () => {
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T05:29:30-07:00"),
    });

    const currLocation = makeLocation({
      AtDock: false,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T05:29:35-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.leftDockTime).toBeUndefined();
    expect(events.didJustLeaveDock).toBe(false);
  });

  it("does not become trip-start-ready from persisted inferred trip fields", () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "ORI",
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      AtDock: true,
      LeftDock: undefined,
    });

    const currLocation = makeLocation({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDock: true,
      LeftDock: undefined,
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.isTripStartReady).toBe(false);
    expect(events.scheduleKeyChanged).toBe(false);
  });

  it("suppresses departure when LeftDock appears but the ping still looks physically docked", () => {
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
      TimeStamp: ms("2026-03-13T05:29:30-07:00"),
    });

    const currLocation = makeLocation({
      AtDock: true,
      Speed: 0,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      TimeStamp: ms("2026-03-13T05:29:40-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.didJustLeaveDock).toBe(false);
  });

  it("detects departure only when LeftDock is provided by the feed", () => {
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T05:29:30-07:00"),
    });

    const currLocation = makeLocation({
      AtDock: false,
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      TimeStamp: ms("2026-03-13T05:29:40-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.leftDockTime).toBe(ms("2026-03-13T05:29:38-07:00"));
    expect(events.didJustLeaveDock).toBe(true);
  });

  it("does not treat a leave-dock future identity jump as a key change", () => {
    const existingTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
      ArrivingTerminalAbbrev: "ORI",
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      AtDock: true,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T05:29:30-07:00"),
    });

    const currLocation = makeLocation({
      AtDock: false,
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      ArrivingTerminalAbbrev: "SHI",
      ScheduledDeparture: ms("2026-03-13T06:05:00-07:00"),
      TimeStamp: ms("2026-03-13T05:29:40-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.didJustLeaveDock).toBe(true);
    expect(events.scheduleKeyChanged).toBe(false);
  });

  it("SAL dock window with missing schedule identity stays representable without false departure or completion", () => {
    const existingTrip = makeTrip({
      VesselAbbrev: "SAL",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: undefined,
      TripKey: "SAL 2026-04-12 00:21:00Z",
      ScheduleKey: undefined,
      AtDockActual: ms("2026-04-12T17:21:00-07:00"),
      LeftDockActual: undefined,
      ScheduledDeparture: undefined,
      AtDock: true,
      LeftDock: undefined,
      TimeStamp: ms("2026-04-12T17:31:00-07:00"),
    });

    const currLocation = makeLocation({
      VesselAbbrev: "SAL",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDock: true,
      LeftDock: undefined,
      TimeStamp: ms("2026-04-12T17:31:30-07:00"),
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.didJustLeaveDock).toBe(false);
    expect(events.didJustArriveAtDock).toBe(false);
    expect(events.isCompletedTrip).toBe(false);
    expect(events.scheduleKeyChanged).toBe(false);
  });

  it("treats losing schedule attachment as a schedule change", () => {
    const existingTrip = makeTrip({
      ScheduleKey: "SAL--2026-04-12--17:45--SOU-VAI",
      NextScheduleKey: "SAL--2026-04-12--18:20--VAI-FAU",
      AtDock: false,
      LeftDock: ms("2026-04-12T17:46:30-07:00"),
      LeftDockActual: ms("2026-04-12T17:46:30-07:00"),
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduledDeparture: undefined,
    });

    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDock: false,
      // Keep the same in-flight physical trip while dropping schedule
      // alignment, which should count as a meaningful schedule transition.
      LeftDock: existingTrip.LeftDock,
    });

    const events = detectTripEvents(existingTrip, currLocation);

    expect(events.didJustLeaveDock).toBe(false);
    expect(events.didJustArriveAtDock).toBe(false);
    expect(events.scheduleKeyChanged).toBe(true);
  });
});

const ms = (iso: string) => new Date(iso).getTime();

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
  ArrivingTerminalAbbrev: undefined,
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T03:08:47-07:00"),
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
  AtDockObserved: overrides.AtDockObserved ?? true,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T03:08:47-07:00")),
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  AtDockActual: undefined,
  TripStart: undefined,
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: undefined,
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T03:08:47-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduledDeparture: undefined,
  ...overrides,
});
