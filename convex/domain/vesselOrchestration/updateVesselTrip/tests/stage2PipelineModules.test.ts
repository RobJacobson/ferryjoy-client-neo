/**
 * Focused tests for Stage 2 pipeline modules (local fixtures only; do not import
 * `activeTripSchedule/tests/testHelpers` so this suite stays independent of that folder).
 */

import { describe, expect, it } from "bun:test";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { addDaysToYyyyMmDd, getSailingDay } from "shared/time";
import { buildActiveTrip } from "../buildActiveTrip";
import { completeTrip } from "../completeTrip";
import {
  didLeaveDock,
  isNewTrip,
  leftDockTimeForUpdate,
} from "../lifecycleSignals";
import { applyScheduleForActiveTrip } from "../scheduleForActiveTrip";
import type { UpdateVesselTripDbAccess } from "../types";

const ms = (iso: string): number => new Date(iso).getTime();

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Clinton",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Mukilteo",
  ArrivingTerminalAbbrev: "MUK",
  Latitude: 47.98,
  Longitude: -122.35,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  RouteAbbrev: "muk-cl",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
  AtDockObserved: overrides.AtDockObserved ?? true,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  RouteAbbrev: "muk-cl",
  TripKey: generateTripKey("CHE", ms("2026-03-13T11:08:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "MUK",
  TripEnd: undefined,
  TripStart: ms("2026-03-13T10:30:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  PrevLeftDock: ms("2026-03-13T09:34:00-07:00"),
  ...overrides,
});

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
    getScheduledSegmentByScheduleKey: async (scheduleKey) => {
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

describe("stage-2 pipeline modules", () => {
  it("reports lifecycle transitions and left-dock precedence", () => {
    const previousTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T06:33:00-07:00"),
      TimeStamp: ms("2026-03-13T06:33:05-07:00"),
    });

    expect(isNewTrip(previousTrip, location)).toBe(true);
    expect(didLeaveDock(previousTrip, location)).toBe(true);
    expect(leftDockTimeForUpdate(previousTrip, location)).toBe(
      location.LeftDock
    );
  });

  it("builds completed trip closeout fields and durations on completion", () => {
    const previousTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
      TripStart: ms("2026-03-13T04:33:00-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const completedTrip = completeTrip(previousTrip, location);

    expect(completedTrip.TripEnd).toBe(location.TimeStamp);
    expect(completedTrip.TripEnd).toBe(location.TimeStamp);
    expect(completedTrip.TripEnd).toBe(location.TimeStamp);
    expect(completedTrip.TripEnd).toBe(location.TimeStamp);
    expect(completedTrip.ArrivingTerminalAbbrev).toBe("ORI");
    expect(completedTrip.AtSeaDuration).toBe(60.3);
    expect(completedTrip.TotalDuration).toBe(116.9);
  });

  it("keeps first-seen active trip arrival fields unset", () => {
    const location = makeLocation({
      AtDockObserved: true,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });

    const activeTrip = buildActiveTrip({
      prev: undefined,
      completedTrip: undefined,
      curr: location,
      isNewTrip: false,
    });

    expect(activeTrip.TripKey).toBeString();
    expect(activeTrip.TripStart).toBeUndefined();
  });

  it("does not read DB on cold-start pings without WSF schedule fields", async () => {
    const location = makeLocation({
      AtDockObserved: true,
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const activeTrip = buildActiveTrip({
      prev: undefined,
      completedTrip: undefined,
      curr: location,
      isNewTrip: false,
    });
    const { dbAccess, counters } = makeDbAccess({ throwOnAnyCall: true });

    const scheduledTrip = await applyScheduleForActiveTrip({
      curr: activeTrip,
      prev: undefined,
      location,
      isNewTrip: false,
      dbAccess,
    });

    expect(scheduledTrip).toBe(activeTrip);
    expect(counters.getScheduledSegmentByScheduleKey).toBe(0);
    expect(counters.getScheduleRolloverDockEvents).toBe(0);
  });

  it("stamps LeftDockActual from LeftDock on dock-to-sea transition", () => {
    const previousTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      LeftDockActual: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: previousTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: previousTrip.ArrivingTerminalAbbrev,
      ScheduledDeparture: previousTrip.ScheduledDeparture,
      ScheduleKey: previousTrip.ScheduleKey,
      AtDockObserved: false,
      LeftDock: ms("2026-03-13T06:33:00-07:00"),
      TimeStamp: ms("2026-03-13T06:33:05-07:00"),
    });

    const activeTrip = buildActiveTrip({
      prev: previousTrip,
      completedTrip: undefined,
      curr: location,
      isNewTrip: false,
    });

    expect(activeTrip.AtDock).toBe(false);
    expect(activeTrip.LeftDockActual).toBe(location.LeftDock);
  });

  it("does not read DB for continuing incomplete WSF schedule fields", async () => {
    const previousTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
    });
    const location = makeLocation({
      DepartingTerminalAbbrev: previousTrip.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      AtDockObserved: previousTrip.AtDock,
      LeftDock: previousTrip.LeftDock,
      Eta: ms("2026-03-13T06:52:00-07:00"),
      TimeStamp: ms("2026-03-13T06:31:45-07:00"),
    });
    const activeTrip = buildActiveTrip({
      prev: previousTrip,
      completedTrip: undefined,
      curr: location,
      isNewTrip: false,
    });
    const { dbAccess, counters } = makeDbAccess({ throwOnAnyCall: true });

    const scheduledTrip = await applyScheduleForActiveTrip({
      curr: activeTrip,
      prev: previousTrip,
      location,
      isNewTrip: false,
      dbAccess,
    });

    expect(scheduledTrip.ScheduleKey).toBe(activeTrip.ScheduleKey);
    expect(counters.getScheduledSegmentByScheduleKey).toBe(0);
    expect(counters.getScheduleRolloverDockEvents).toBe(0);
  });

  it("infers schedule for replacement trip with incomplete WSF", async () => {
    const previousTrip = makeTrip({
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
    const activeTrip = buildActiveTrip({
      prev: previousTrip,
      completedTrip: undefined,
      curr: location,
      isNewTrip: true,
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

    const scheduledTrip = await applyScheduleForActiveTrip({
      curr: activeTrip,
      prev: previousTrip,
      location,
      isNewTrip: true,
      dbAccess,
    });

    expect(scheduledTrip.ArrivingTerminalAbbrev).toBe("LOP");
    expect(scheduledTrip.ScheduledDeparture).toBe(primarySegment.DepartingTime);
    expect(scheduledTrip.ScheduleKey).toBe("CHE--2026-03-13--07:00--ORI-LOP");
    expect(scheduledTrip.SailingDay).toBe("2026-03-13");
    expect(scheduledTrip.NextScheduleKey).toBe(
      "CHE--2026-03-13--08:00--LOP-SHW"
    );
    expect(scheduledTrip.NextScheduledDeparture).toBe(
      primarySegment.NextDepartingTime
    );
    expect(counters.getScheduledSegmentByScheduleKey).toBe(1);
    expect(counters.getScheduleRolloverDockEvents).toBe(0);
  });

  it("falls back to rollover when replacement has no usable NextScheduleKey", async () => {
    const previousTrip = makeTrip({
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
      InService: true,
    });
    const activeTrip = buildActiveTrip({
      prev: previousTrip,
      completedTrip: undefined,
      curr: location,
      isNewTrip: true,
    });
    const rolloverDeparture = makeDepartureEvent();
    const { dbAccess, counters } = makeDbAccess({
      scheduledDockEventsBySailingDay: {
        "2026-03-13": [rolloverDeparture],
      },
    });

    const scheduledTrip = await applyScheduleForActiveTrip({
      curr: activeTrip,
      prev: previousTrip,
      location,
      isNewTrip: true,
      dbAccess,
    });

    expect(scheduledTrip.ScheduleKey).toBe("CHE--2026-03-13--07:00--ORI-LOP");
    expect(counters.getScheduledSegmentByScheduleKey).toBe(0);
    expect(counters.getScheduleRolloverDockEvents).toBe(1);
  });
});
