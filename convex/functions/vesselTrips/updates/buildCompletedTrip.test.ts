import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildCompletedTrip } from "./buildCompletedTrip";

describe("buildCompletedTrip", () => {
  it("preserves a valid ArriveDest when it occurs after departure", () => {
    const existingTrip = makeTrip({
      TripStart: ms("2026-03-13T04:33:00-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      ArriveDest: ms("2026-03-13T06:29:45-07:00"),
    });

    const completed = buildCompletedTrip(
      existingTrip,
      makeLocation({
        TimeStamp: ms("2026-03-13T06:29:56-07:00"),
      })
    );

    expect(completed.ArriveDest).toBe(ms("2026-03-13T06:29:45-07:00"));
    expect(completed.TripEnd).toBe(ms("2026-03-13T06:29:56-07:00"));
    expect(completed.AtSeaDuration).toBe(60.1);
  });

  it("falls back to TripEnd when ArriveDest predates LeftDock", () => {
    const existingTrip = makeTrip({
      TripStart: ms("2026-03-12T20:32:59-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      ArriveDest: ms("2026-03-13T03:08:47-07:00"),
    });

    const completed = buildCompletedTrip(
      existingTrip,
      makeLocation({
        TimeStamp: ms("2026-03-13T06:29:56-07:00"),
      })
    );

    expect(completed.ArriveDest).toBe(ms("2026-03-13T06:29:56-07:00"));
    expect(completed.TripEnd).toBe(ms("2026-03-13T06:29:56-07:00"));
    expect(completed.AtSeaDuration).toBe(60.3);
    expect(completed.TotalDuration).toBe(597);
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
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalID: undefined,
  ArrivingTerminalName: undefined,
  ArrivingTerminalAbbrev: "LOP",
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T06:50:00-07:00"),
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T06:29:56-07:00"),
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
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
