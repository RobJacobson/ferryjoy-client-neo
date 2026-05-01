import { describe, expect, it } from "bun:test";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { addDaysToYyyyMmDd, getSailingDay } from "shared/time";
import type { UpdateVesselTripDbAccess } from "../types";
import { updateVesselTrip } from "../updateVesselTrip";

const ms = (iso: string): number => new Date(iso).getTime();

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
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
  AtDockObserved: overrides.AtDockObserved ?? false,
});

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
  NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
  NextScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
  ...overrides,
});

const makeDbAccess = (
  options: {
    scheduledSegmentByKey?: Record<
      string,
      ConvexInferredScheduledSegment | null
    >;
    scheduledDockEventsBySailingDay?: Record<
      string,
      ConvexScheduledDockEvent[]
    >;
    throwOnAnyCall?: boolean;
  } = {}
): {
  dbAccess: UpdateVesselTripDbAccess;
  counters: {
    getScheduledSegmentByScheduleKey: number;
    getScheduleRolloverDockEvents: number;
  };
} => {
  const counters = {
    getScheduledSegmentByScheduleKey: 0,
    getScheduleRolloverDockEvents: 0,
  };

  const failIfGuarded = (name: keyof typeof counters) => {
    if (options.throwOnAnyCall) {
      throw new Error(`${name} should not be called`);
    }
  };

  const dbAccess: UpdateVesselTripDbAccess = {
    getScheduledSegmentByScheduleKey: async (scheduleKey: string) => {
      counters.getScheduledSegmentByScheduleKey += 1;
      failIfGuarded("getScheduledSegmentByScheduleKey");
      return options.scheduledSegmentByKey?.[scheduleKey] ?? null;
    },
    getScheduleRolloverDockEvents: async ({ timestamp }) => {
      counters.getScheduleRolloverDockEvents += 1;
      failIfGuarded("getScheduleRolloverDockEvents");
      const currentSailingDay = getSailingDay(new Date(timestamp));
      const nextSailingDay = addDaysToYyyyMmDd(currentSailingDay, 1);
      return {
        currentSailingDay,
        currentDayEvents:
          options.scheduledDockEventsBySailingDay?.[currentSailingDay] ?? [],
        nextSailingDay,
        nextDayEvents:
          options.scheduledDockEventsBySailingDay?.[nextSailingDay] ?? [],
      };
    },
  };

  return { dbAccess, counters };
};

const makeDepartureEvent = (
  overrides: Partial<ConvexScheduledDockEvent> = {}
): ConvexScheduledDockEvent => ({
  Key: "CHE--2026-03-13--07:00--ORI-LOP--dep-dock",
  VesselAbbrev: "CHE",
  SailingDay: "2026-03-13",
  UpdatedAt: 1,
  ScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
  TerminalAbbrev: "ORI",
  NextTerminalAbbrev: "LOP",
  EventType: "dep-dock",
  ...overrides,
});

const makeScheduledSegment = (
  overrides: Partial<ConvexInferredScheduledSegment> = {}
): ConvexInferredScheduledSegment => ({
  Key: "CHE--2026-03-13--07:00--ORI-LOP",
  SailingDay: "2026-03-13",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalAbbrev: "LOP",
  DepartingTime: ms("2026-03-13T07:00:00-07:00"),
  NextKey: undefined,
  NextDepartingTime: undefined,
  ...overrides,
});

describe("updateVesselTrip", () => {
  it("creates a first-seen active trip without TripStart", async () => {
    const location = makeLocation({
      AtDockObserved: true,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, undefined, dbAccess);

    expect(result).not.toBeNull();
    expect(result?.completedVesselTrip).toBeUndefined();
    expect(result?.activeVesselTrip.TripKey).toBeString();
    expect(result?.activeVesselTrip.TripStart).toBeUndefined();
    expect(result?.activeVesselTrip.LeftDockActual).toBe(
      location.LeftDock
    );
  });

  it("returns null for continuing timestamp-only churn", async () => {
    const existingTrip = makeTrip({
      TimeStamp: ms("2026-03-13T06:28:45-07:00"),
      AtDockDuration: 56.6,
      TripDelay: -0.4,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      InService: existingTrip.InService,
      AtDockObserved: existingTrip.AtDock,
      LeftDock: existingTrip.LeftDock,
      Eta: existingTrip.Eta,
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);
    expect(result).toBeNull();
  });

  it("returns an active update for continuing ETA change", async () => {
    const existingTrip = makeTrip({
      Eta: ms("2026-03-13T06:50:00-07:00"),
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      InService: existingTrip.InService,
      AtDockObserved: existingTrip.AtDock,
      LeftDock: existingTrip.LeftDock,
      Eta: ms("2026-03-13T06:52:00-07:00"),
      TimeStamp: ms("2026-03-13T06:29:45-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.activeVesselTrip.Eta).toBe(location.Eta);
    expect(result?.activeVesselTrip.TripKey).toBe(existingTrip.TripKey);
    expect(result?.activeVesselTrip.PrevTerminalAbbrev).toBe(
      existingTrip.PrevTerminalAbbrev
    );
    expect(result?.completedVesselTrip).toBeUndefined();
  });

  it("stamps LeftDockActual from LeftDock on dock-to-sea transition", async () => {
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T06:33:00-07:00"),
      TimeStamp: ms("2026-03-13T06:33:05-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTrip).toBeUndefined();
    expect(result?.activeVesselTrip.AtDock).toBe(false);
    expect(result?.activeVesselTrip.LeftDockActual).toBe(
      location.LeftDock
    );
  });

  it("falls back LeftDockActual to TimeStamp when LeftDock is missing", async () => {
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: existingTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: existingTrip.ScheduledDeparture,
      ScheduleKey: existingTrip.ScheduleKey,
      AtDockObserved: false,
      LeftDock: undefined,
      TimeStamp: ms("2026-03-13T06:34:05-07:00"),
    });
    const { dbAccess } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);
    expect(result?.activeVesselTrip.LeftDockActual).toBe(
      location.TimeStamp
    );
  });

  it("completes previous trip and starts replacement on terminal change", async () => {
    const completionTime = ms("2026-03-13T06:45:00-07:00");
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      AtDockObserved: true,
      TimeStamp: completionTime,
    });
    const { dbAccess } = makeDbAccess();

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTrip).toBeDefined();
    expect(result?.activeVesselTrip).toBeDefined();
    expect(result?.completedVesselTrip?.TripEnd).toBe(completionTime);
    expect(result?.completedVesselTrip?.TripEnd).toBe(completionTime);
    expect(result?.completedVesselTrip?.TripEnd).toBe(completionTime);
    expect(result?.completedVesselTrip?.TripEnd).toBe(completionTime);
    expect(result?.completedVesselTrip?.ArrivingTerminalAbbrev).toBe(
      "ORI"
    );
    expect(result?.activeVesselTrip.DepartingTerminalAbbrev).toBe("ORI");
    expect(result?.activeVesselTrip.TripKey).not.toBe(
      existingTrip.TripKey
    );
    expect(result?.activeVesselTrip.TripStart).toBe(completionTime);
    expect(result?.activeVesselTrip.PrevTerminalAbbrev).toBe(
      result?.completedVesselTrip?.DepartingTerminalAbbrev
    );
    expect(result?.activeVesselTrip.PrevScheduledDeparture).toBe(
      result?.completedVesselTrip?.ScheduledDeparture
    );
    expect(result?.activeVesselTrip.PrevLeftDock).toBe(
      result?.completedVesselTrip?.LeftDockActual ??
        result?.completedVesselTrip?.LeftDock
    );
    expect(result?.activeVesselTrip.LeftDock).toBeUndefined();
    expect(result?.activeVesselTrip.LeftDockActual).toBeUndefined();
  });

  it("trusts terminal change even when AtDockObserved is false", async () => {
    const existingTrip = makeTrip();
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      AtDockObserved: false,
      TimeStamp: ms("2026-03-13T06:46:00-07:00"),
    });
    const { dbAccess } = makeDbAccess();

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTrip).toBeDefined();
    expect(result?.activeVesselTrip.DepartingTerminalAbbrev).toBe("ORI");
  });

  it("does not schedule-read for continuing incomplete WSF fields", async () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      Eta: ms("2026-03-13T06:50:00-07:00"),
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: existingTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDockObserved: existingTrip.AtDock,
      LeftDock: existingTrip.LeftDock,
      Eta: ms("2026-03-13T06:52:00-07:00"),
      TimeStamp: ms("2026-03-13T06:31:45-07:00"),
    });
    const { dbAccess, counters } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result).not.toBeNull();
    expect(counters.getScheduledSegmentByScheduleKey).toBe(0);
    expect(counters.getScheduleRolloverDockEvents).toBe(0);
  });

  it("uses NextScheduleKey first for replacement trip with incomplete WSF", async () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: undefined,
      NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      TimeStamp: ms("2026-03-13T06:47:00-07:00"),
    });
    const primarySegment = makeScheduledSegment({
      NextKey: "CHE--2026-03-13--08:00--LOP-SHW",
      NextDepartingTime: ms("2026-03-13T08:00:00-07:00"),
    });
    const { dbAccess, counters } = makeDbAccess({
      scheduledSegmentByKey: {
        [primarySegment.Key]: primarySegment,
      },
    });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.activeVesselTrip.ArrivingTerminalAbbrev).toBe("LOP");
    expect(result?.activeVesselTrip.ScheduledDeparture).toBe(
      primarySegment.DepartingTime
    );
    expect(result?.activeVesselTrip.ScheduleKey).toBe(primarySegment.Key);
    expect(result?.activeVesselTrip.SailingDay).toBe("2026-03-13");
    expect(result?.activeVesselTrip.NextScheduleKey).toBe(
      "CHE--2026-03-13--08:00--LOP-SHW"
    );
    expect(result?.activeVesselTrip.NextScheduledDeparture).toBe(
      primarySegment.NextDepartingTime
    );
    expect(counters.getScheduledSegmentByScheduleKey).toBe(1);
    expect(counters.getScheduleRolloverDockEvents).toBe(0);
  });

  it("falls back to schedule rollover when replacement has no NextScheduleKey", async () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: undefined,
      NextScheduleKey: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      TimeStamp: ms("2026-03-13T06:47:00-07:00"),
    });
    const rolloverDeparture = makeDepartureEvent();
    const { dbAccess, counters } = makeDbAccess({
      scheduledDockEventsBySailingDay: {
        "2026-03-13": [rolloverDeparture],
      },
    });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.activeVesselTrip.ScheduleKey).toBe(
      "CHE--2026-03-13--07:00--ORI-LOP"
    );
    expect(result?.activeVesselTrip.ArrivingTerminalAbbrev).toBe("LOP");
    expect(counters.getScheduledSegmentByScheduleKey).toBe(0);
    expect(counters.getScheduleRolloverDockEvents).toBe(1);
  });

  it("falls back to schedule rollover when NextScheduleKey points to another terminal", async () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: undefined,
      NextScheduleKey: "CHE--2026-03-13--07:00--ANA-MUK",
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      TimeStamp: ms("2026-03-13T06:47:00-07:00"),
    });
    const staleSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--07:00--ANA-MUK",
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "MUK",
    });
    const rolloverDeparture = makeDepartureEvent();
    const { dbAccess, counters } = makeDbAccess({
      scheduledSegmentByKey: {
        [staleSegment.Key]: staleSegment,
      },
      scheduledDockEventsBySailingDay: {
        "2026-03-13": [rolloverDeparture],
      },
    });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.activeVesselTrip.ScheduleKey).toBe(
      "CHE--2026-03-13--07:00--ORI-LOP"
    );
    expect(result?.activeVesselTrip.ArrivingTerminalAbbrev).toBe("LOP");
    expect(counters.getScheduledSegmentByScheduleKey).toBe(1);
    expect(counters.getScheduleRolloverDockEvents).toBe(1);
  });

  it("does not carry prior-leg schedule onto incomplete-WSF replacement when NextScheduleKey is set", async () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T06:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--06:00--ANA-MUK",
      SailingDay: "2026-03-13",
      NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      TimeStamp: ms("2026-03-13T06:47:00-07:00"),
    });
    const primarySegment = makeScheduledSegment();
    const { dbAccess } = makeDbAccess({
      scheduledSegmentByKey: {
        [primarySegment.Key]: primarySegment,
      },
    });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.activeVesselTrip.ArrivingTerminalAbbrev).toBe("LOP");
    expect(result?.activeVesselTrip.ScheduleKey).toBe(primarySegment.Key);
  });

  it("skips schedule lookup for out-of-service replacement trips", async () => {
    const existingTrip = makeTrip();
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      InService: false,
      TimeStamp: ms("2026-03-13T06:48:00-07:00"),
    });
    const { dbAccess, counters } = makeDbAccess({ throwOnAnyCall: true });

    const result = await updateVesselTrip(location, existingTrip, dbAccess);

    expect(result?.completedVesselTrip).toBeDefined();
    expect(result?.activeVesselTrip).toBeDefined();
    expect(counters.getScheduledSegmentByScheduleKey).toBe(0);
    expect(counters.getScheduleRolloverDockEvents).toBe(0);
  });
});
