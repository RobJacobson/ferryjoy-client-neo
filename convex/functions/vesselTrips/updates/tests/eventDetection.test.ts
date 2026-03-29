import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { detectTripEvents, getDockDepartureState } from "../eventDetection";

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

    const departureState = getDockDepartureState(existingTrip, currLocation);
    const events = detectTripEvents(existingTrip, currLocation);

    expect(departureState.leftDockTime).toBeUndefined();
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
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      TimeStamp: ms("2026-03-13T05:29:40-07:00"),
    });

    const departureState = getDockDepartureState(existingTrip, currLocation);
    const events = detectTripEvents(existingTrip, currLocation);

    expect(departureState.leftDockTime).toBe(ms("2026-03-13T05:29:38-07:00"));
    expect(events.didJustLeaveDock).toBe(true);
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
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: undefined,
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: undefined,
  LeftDock: undefined,
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
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
