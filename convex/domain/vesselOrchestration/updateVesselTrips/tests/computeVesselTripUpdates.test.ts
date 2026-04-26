import { describe, expect, it, spyOn } from "bun:test";
import {
  createScheduleContinuityAccessFromSnapshot,
  type TripLifecycleEventFlags,
} from "domain/vesselOrchestration/shared";
import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

const emptyScheduleSnapshot: ScheduleSnapshot = {
  SailingDay: "2026-03-13",
  scheduledDepartureBySegmentKey: {},
  scheduledDeparturesByVesselAbbrev: {},
};

const scheduleTables = createScheduleContinuityAccessFromSnapshot(
  emptyScheduleSnapshot,
  "2026-03-13"
);

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

type DetectedTripEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

const defaultEvents: DetectedTripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  leftDockTime: undefined,
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

describe("updateVesselTrips", () => {
  it("emits no write intents for an unchanged vessel", async () => {
    const existingTrip = makeTrip();
    const detectTripEventsMod = await import("../lifecycle");
    const buildTripMod = await import("../tripBuilders");
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const buildTripSpy = spyOn(buildTripMod, "buildTripRowsForPing");

    detectSpy.mockImplementation(() => defaultEvents);
    buildTripSpy.mockImplementation(async () => ({
      activeVesselTrip: existingTrip,
    }));

    try {
      const { updateVesselTrips } = await import("../updateVesselTrips");
      const result = await updateVesselTrips({
        vesselLocation: makeLocation(),
        existingActiveTrip: existingTrip,
        scheduleAccess: scheduleTables,
      });

      expect(result.vesselAbbrev).toBe(existingTrip.VesselAbbrev);
      expect(result.activeVesselTripUpdate).toBeUndefined();
      expect(result.completedVesselTripUpdate).toBeUndefined();
    } finally {
      detectSpy.mockRestore();
      buildTripSpy.mockRestore();
    }
  });

  it("does not emit a write intent for timestamp-only churn", async () => {
    const existingTrip = makeTrip();
    const updatedTrip = makeTrip({
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const detectTripEventsMod = await import("../lifecycle");
    const buildTripMod = await import("../tripBuilders");
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const buildTripSpy = spyOn(buildTripMod, "buildTripRowsForPing");

    detectSpy.mockImplementation(() => defaultEvents);
    buildTripSpy.mockImplementation(async () => ({
      activeVesselTrip: updatedTrip,
    }));

    try {
      const { updateVesselTrips } = await import("../updateVesselTrips");
      const result = await updateVesselTrips({
        vesselLocation: makeLocation(),
        existingActiveTrip: existingTrip,
        scheduleAccess: scheduleTables,
      });

      expect(result.vesselAbbrev).toBe(updatedTrip.VesselAbbrev);
      expect(result.activeVesselTripUpdate).toBeUndefined();
      expect(result.completedVesselTripUpdate).toBeUndefined();
    } finally {
      detectSpy.mockRestore();
      buildTripSpy.mockRestore();
    }
  });

  it("emits an active write intent for ETA-only churn", async () => {
    const existingTrip = makeTrip({
      Eta: ms("2026-03-13T06:50:00-07:00"),
    });
    const updatedTrip = makeTrip({
      Eta: ms("2026-03-13T06:52:00-07:00"),
    });
    const detectTripEventsMod = await import("../lifecycle");
    const buildTripMod = await import("../tripBuilders");
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const buildTripSpy = spyOn(buildTripMod, "buildTripRowsForPing");

    detectSpy.mockImplementation(() => defaultEvents);
    buildTripSpy.mockImplementation(async () => ({
      activeVesselTrip: updatedTrip,
    }));

    try {
      const { updateVesselTrips } = await import("../updateVesselTrips");
      const result = await updateVesselTrips({
        vesselLocation: makeLocation(),
        existingActiveTrip: existingTrip,
        scheduleAccess: scheduleTables,
      });

      expect(result.vesselAbbrev).toBe(updatedTrip.VesselAbbrev);
      expect(result.activeVesselTripUpdate).toEqual(updatedTrip);
      expect(result.completedVesselTripUpdate).toBeUndefined();
    } finally {
      detectSpy.mockRestore();
      buildTripSpy.mockRestore();
    }
  });

  it("emits both active and completed write intents on completion rollover", async () => {
    const existingTrip = makeTrip();
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
    const completedEvents: DetectedTripEvents = {
      ...defaultEvents,
      isCompletedTrip: true,
      didJustArriveAtDock: true,
    };
    const detectTripEventsMod = await import("../lifecycle");
    const buildTripMod = await import("../tripBuilders");
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const buildTripSpy = spyOn(buildTripMod, "buildTripRowsForPing");

    detectSpy.mockImplementation(() => completedEvents);
    buildTripSpy.mockImplementation(async () => ({
      activeVesselTrip: replacementTrip,
      completedVesselTrip: completedTrip,
    }));

    try {
      const { updateVesselTrips } = await import("../updateVesselTrips");
      const result = await updateVesselTrips({
        vesselLocation: makeLocation({ AtDock: true, LeftDock: undefined }),
        existingActiveTrip: existingTrip,
        scheduleAccess: scheduleTables,
      });

      expect(result.vesselAbbrev).toBe(replacementTrip.VesselAbbrev);
      expect(result.activeVesselTripUpdate).toEqual(replacementTrip);
      expect(result.completedVesselTripUpdate).toEqual(completedTrip);
    } finally {
      detectSpy.mockRestore();
      buildTripSpy.mockRestore();
    }
  });

  it("emits no write intents when domain trip update fails", async () => {
    const existingTrip = makeTrip();
    const detectTripEventsMod = await import("../lifecycle");
    const tripFieldsMod = await import("../tripFields");
    const detectSpy = spyOn(detectTripEventsMod, "detectTripEvents");
    const tripFieldsSpy = spyOn(tripFieldsMod, "resolveTripFieldsForTripRow");

    detectSpy.mockImplementation(() => defaultEvents);
    tripFieldsSpy.mockImplementation(() => {
      throw new Error("boom");
    });

    try {
      const { updateVesselTrips } = await import("../updateVesselTrips");
      const result = await updateVesselTrips({
        vesselLocation: makeLocation(),
        existingActiveTrip: existingTrip,
        scheduleAccess: scheduleTables,
      });

      expect(result.vesselAbbrev).toBe(existingTrip.VesselAbbrev);
      expect(result.activeVesselTripUpdate).toBeUndefined();
      expect(result.completedVesselTripUpdate).toBeUndefined();
    } finally {
      detectSpy.mockRestore();
      tripFieldsSpy.mockRestore();
    }
  });
});
