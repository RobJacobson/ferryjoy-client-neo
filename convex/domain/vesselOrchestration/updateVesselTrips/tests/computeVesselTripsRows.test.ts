/**
 * Tests for the canonical public trips runner.
 */

import { describe, expect, it, spyOn } from "bun:test";
import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

const emptyScheduleSnapshot: ScheduleSnapshot = {
  SailingDay: "2026-03-13",
  scheduledDepartureBySegmentKey: {},
  scheduledDeparturesByVesselAbbrev: {},
};

const testSailingDay = "2026-03-13";

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
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
  ...overrides,
});

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
};

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselAbbrev: "CHE",
  VesselName: "Chelan",
  DepartingTerminalID: 10,
  Speed: 15,
  Heading: 90,
  Latitude: 47.0,
  Longitude: -122.0,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 20,
  ArrivingTerminalName: "Orcas",
  ArrivingTerminalAbbrev: "ORI",
  AtDock: false,
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  VesselPositionNum: 1,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  RouteAbbrev: "ana-sj",
  ...overrides,
});

describe("computeVesselTripsRows", () => {
  it("returns empty arrays when the ping has no realtime inputs or active trips", async () => {
    const { computeVesselTripsRows } = await import(
      "../computeVesselTripsRows"
    );

    const result = computeVesselTripsRows({
      vesselLocations: [],
      existingActiveTrips: [],
      scheduleSnapshot: emptyScheduleSnapshot,
      sailingDay: testSailingDay,
    });

    expect(result).toEqual({
      completedTrips: [],
      activeTrips: [],
    });
  });

  it("keeps untouched active trips and returns the authoritative active set", async () => {
    const updatedTrip = makeTrip({
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const untouchedTrip = makeTrip({
      VesselAbbrev: "TAC",
      TripKey: generateTripKey("TAC", ms("2026-03-13T05:00:00-07:00")),
      ScheduleKey: "TAC--2026-03-13--05:15--P52-BBI",
    });
    const detectTripEventsMod = await import(
      "../tripLifecycle/detectTripEvents"
    );
    const buildTripMod = await import("../tripLifecycle/buildTrip");
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const buildTripSpy = spyOn(buildTripMod, "buildTripCore");

    detectSpy.mockImplementation(() => defaultEvents);
    buildTripSpy.mockImplementation(() => updatedTrip);

    try {
      const { computeVesselTripsRows } = await import(
        "../computeVesselTripsRows"
      );
      const result = computeVesselTripsRows({
        vesselLocations: [makeLocation()],
        existingActiveTrips: [makeTrip(), untouchedTrip],
        scheduleSnapshot: emptyScheduleSnapshot,
        sailingDay: testSailingDay,
      });

      expect(result.completedTrips).toEqual([]);
      expect(result.activeTrips.map((trip) => trip.VesselAbbrev)).toEqual([
        "CHE",
        "TAC",
      ]);
      expect(result.activeTrips[0]?.TimeStamp).toBe(updatedTrip.TimeStamp);
    } finally {
      detectSpy.mockRestore();
      buildTripSpy.mockRestore();
    }
  });

  it("moves ended trips to completedTrips and starts replacement active trips", async () => {
    const completedExisting = makeTrip();
    const completedTrip = makeTrip({
      TripEnd: ms("2026-03-13T06:29:56-07:00"),
      ArriveDest: ms("2026-03-13T06:29:56-07:00"),
    });
    const replacementTrip = makeTrip({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
      TripKey: generateTripKey("CHE", ms("2026-03-13T06:31:00-07:00")),
    });
    const completedEvents: TripEvents = {
      ...defaultEvents,
      isCompletedTrip: true,
      didJustArriveAtDock: true,
    };
    const detectTripEventsMod = await import(
      "../tripLifecycle/detectTripEvents"
    );
    const buildTripMod = await import("../tripLifecycle/buildTrip");
    const buildCompletedTripMod = await import(
      "../tripLifecycle/buildCompletedTrip"
    );
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const buildTripSpy = spyOn(buildTripMod, "buildTripCore");
    const buildCompletedSpy = spyOn(
      buildCompletedTripMod,
      "buildCompletedTrip"
    );

    detectSpy.mockImplementation(() => completedEvents);
    buildCompletedSpy.mockImplementation(() => completedTrip);
    buildTripSpy.mockImplementation(() => replacementTrip);

    try {
      const { computeVesselTripsRows } = await import(
        "../computeVesselTripsRows"
      );
      const result = computeVesselTripsRows({
        vesselLocations: [makeLocation({ AtDock: true, LeftDock: undefined })],
        existingActiveTrips: [completedExisting],
        scheduleSnapshot: emptyScheduleSnapshot,
        sailingDay: testSailingDay,
      });

      expect(result.completedTrips).toEqual([completedTrip]);
      expect(result.activeTrips).toEqual([replacementTrip]);
      expect("tripComputations" in result).toBe(false);
    } finally {
      detectSpy.mockRestore();
      buildTripSpy.mockRestore();
      buildCompletedSpy.mockRestore();
    }
  });

  it("falls back to the existing active trip when a per-vessel update fails", async () => {
    const existingTrip = makeTrip();
    const detectTripEventsMod = await import(
      "../tripLifecycle/detectTripEvents"
    );
    const buildTripMod = await import("../tripLifecycle/buildTrip");
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const buildTripSpy = spyOn(buildTripMod, "buildTripCore");

    detectSpy.mockImplementation(() => defaultEvents);
    buildTripSpy.mockImplementation(() => {
      throw new Error("boom");
    });

    try {
      const { computeVesselTripsRows } = await import(
        "../computeVesselTripsRows"
      );
      const result = computeVesselTripsRows({
        vesselLocations: [makeLocation()],
        existingActiveTrips: [existingTrip],
        scheduleSnapshot: emptyScheduleSnapshot,
        sailingDay: testSailingDay,
      });

      expect(result.completedTrips).toEqual([]);
      expect(result.activeTrips).toEqual([existingTrip]);
    } finally {
      detectSpy.mockRestore();
      buildTripSpy.mockRestore();
    }
  });
});
