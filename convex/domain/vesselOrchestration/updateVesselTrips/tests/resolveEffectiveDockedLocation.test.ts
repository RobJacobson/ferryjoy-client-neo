/**
 * Tests for docked effective-location continuity (schedule next-leg and rollover).
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";
import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { resolveEffectiveDockedLocation } from "../continuity/resolveEffectiveDockedLocation";

describe("resolveEffectiveDockedLocation", () => {
  it("CAT later scheduled departure while docked reuses the active trip identity", () => {
    const location = makeLocation({
      VesselAbbrev: "CAT",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduleKey: undefined,
      ScheduledDeparture: ms("2026-04-12T18:45:00-07:00"),
      TimeStamp: ms("2026-04-12T16:47:08-07:00"),
    });
    const existingTrip = makeTrip({
      VesselAbbrev: "CAT",
      AtDock: true,
      LeftDock: undefined,
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduledDeparture: ms("2026-04-12T16:50:00-07:00"),
      TripKey: "CAT 2026-04-12 23:21:55Z",
      ScheduleKey: "CAT--2026-04-12--16:50--SOU-VAI",
      AtDockActual: ms("2026-04-12T16:34:00-07:00"),
      LeftDockActual: undefined,
      TimeStamp: ms("2026-04-12T16:47:08-07:00"),
    });

    const tables: ScheduledSegmentTables = {
      sailingDay: "2026-04-12",
      scheduledDepartureBySegmentKey: {},
      scheduledDockEventsByVesselAbbrev: {},
    };

    const { effectiveLocation } = resolveEffectiveDockedLocation(
      tables,
      location,
      existingTrip
    );

    expect(effectiveLocation.ScheduleKey).toBe(existingTrip.ScheduleKey);
    expect(effectiveLocation.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
    expect(effectiveLocation.ScheduledDeparture).toBe(
      existingTrip.ScheduledDeparture
    );
  });

  it("prefers the carried NextScheduleKey when it matches the current departing terminal", () => {
    const nextScheduledEvent = makeScheduledSegment({
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
    });
    const nextSegment = inferScheduledSegmentFromDepartureEvent(
      nextScheduledEvent,
      [nextScheduledEvent]
    );
    const lookupArgs: string[] = [];
    const tables: ScheduledSegmentTables = {
      sailingDay: "2026-03-13",
      scheduledDepartureBySegmentKey: new Proxy(
        { [nextScheduledEvent.Key]: nextScheduledEvent },
        {
          get(target, prop, receiver) {
            if (typeof prop === "string") lookupArgs.push(prop);
            return Reflect.get(target, prop, receiver);
          },
        }
      ) as Record<string, ConvexScheduledDockEvent>,
      scheduledDockEventsByVesselAbbrev: { CHE: [nextScheduledEvent] },
    };

    const { effectiveLocation } = resolveEffectiveDockedLocation(
      tables,
      makeLocation({
        ScheduleKey: undefined,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      makeTrip({
        DepartingTerminalAbbrev: "MUK",
        NextScheduleKey: nextSegment.Key,
      })
    );

    expect(lookupArgs).toEqual([nextSegment.Key]);
    expect(effectiveLocation.ScheduleKey).toBe(nextSegment.Key);
    expect(effectiveLocation.ArrivingTerminalAbbrev).toBe(
      nextSegment.ArrivingTerminalAbbrev
    );
    expect(effectiveLocation.ScheduledDeparture).toBe(
      nextSegment.DepartingTime
    );
  });

  it("skips schedule lookups for a first-seen keyless docked trip without continuity hints", () => {
    const tables: ScheduledSegmentTables = {
      sailingDay: "2026-03-13",
      scheduledDepartureBySegmentKey: {},
      scheduledDockEventsByVesselAbbrev: {},
    };

    const { effectiveLocation } = resolveEffectiveDockedLocation(
      tables,
      makeLocation({
        ScheduleKey: undefined,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      undefined
    );

    expect(effectiveLocation.ScheduleKey).toBeUndefined();
    expect(effectiveLocation.ArrivingTerminalAbbrev).toBeUndefined();
    expect(effectiveLocation.ScheduledDeparture).toBeUndefined();
  });
});

const ms = (iso: string) => new Date(iso).getTime();

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
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  RouteAbbrev: "muk-cl",
  TripKey: "CHE 2026-03-13 11:08:00Z",
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "MUK",
  ArriveDest: undefined,
  AtDockActual: ms("2026-03-13T10:30:00-07:00"),
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
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  PrevLeftDock: ms("2026-03-13T09:34:00-07:00"),
  ...overrides,
});

const makeScheduledSegment = (
  overrides: Partial<ConvexScheduledDockEvent> = {}
): ConvexScheduledDockEvent => ({
  Key: "CHE--2026-03-13--11:00--CLI-MUK",
  VesselAbbrev: "CHE",
  SailingDay: "2026-03-13",
  UpdatedAt: ms("2026-03-13T11:08:00-07:00"),
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  TerminalAbbrev: "CLI",
  NextTerminalAbbrev: "MUK",
  EventType: "dep-dock",
  EventScheduledTime: ms("2026-03-13T11:00:00-07:00"),
  IsLastArrivalOfSailingDay: false,
  ...overrides,
});
