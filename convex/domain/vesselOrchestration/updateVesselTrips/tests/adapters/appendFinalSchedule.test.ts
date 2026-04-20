/**
 * Tests for the boundary-layer `appendFinalSchedule` adapter (schedule lookup wiring).
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";
import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/shared";
import { createScheduleTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/createTripPipelineDeps";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

describe("appendFinalSchedule", () => {
  it("reuses existing next-trip schedule fields when the schedule segment is unchanged", () => {
    const existingTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--09:30--MUK-CLI",
      NextScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
    });
    const baseTrip = makeTrip({
      ScheduleKey: existingTrip.ScheduleKey,
      NextScheduleKey: undefined,
      NextScheduledDeparture: undefined,
    });

    const { appendFinalSchedule } = createScheduleTripAdapters(
      createTestLookup({})
    );
    const enriched = appendFinalSchedule(baseTrip, existingTrip);

    expect(enriched.NextScheduleKey).toBe(existingTrip.NextScheduleKey);
    expect(enriched.NextScheduledDeparture).toBe(
      existingTrip.NextScheduledDeparture
    );
  });

  it("loads the next-trip schedule fields when the schedule segment changed", () => {
    const scheduledEvent = makeScheduledEvent({
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
    });
    const nextScheduledEvent = makeScheduledEvent({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      TerminalAbbrev: "MUK",
      NextTerminalAbbrev: "CLI",
      ScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
      EventScheduledTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const expectedSegment = inferScheduledSegmentFromDepartureEvent(
      scheduledEvent,
      [scheduledEvent, nextScheduledEvent]
    );
    const baseTrip = makeTrip({
      ScheduleKey: scheduledEvent.Key,
      NextScheduleKey: undefined,
      NextScheduledDeparture: undefined,
    });

    const { appendFinalSchedule } = createScheduleTripAdapters(
      createTestLookup({
        scheduledEventByKey: new Map([[scheduledEvent.Key, scheduledEvent]]),
        scheduledEventsByScope: new Map([
          ["CHE|2026-03-13", [scheduledEvent, nextScheduledEvent]],
        ]),
      })
    );
    const enriched = appendFinalSchedule(
      baseTrip,
      makeTrip({ ScheduleKey: "CHE--2026-03-13--09:30--MUK-CLI" })
    );

    expect(enriched.ScheduleKey).toBe(expectedSegment.Key);
    expect(enriched.NextScheduleKey).toBe(expectedSegment.NextKey);
    expect(enriched.NextScheduledDeparture).toBe(
      expectedSegment.NextDepartingTime
    );
  });
});

const createTestLookup = (options: {
  scheduledEventByKey?: Map<string, ConvexScheduledDockEvent>;
  scheduledEventsByScope?: Map<string, ConvexScheduledDockEvent[]>;
}): ScheduledSegmentLookup => ({
  getScheduledDepartureEventBySegmentKey: (segmentKey: string) =>
    options.scheduledEventByKey?.get(segmentKey) ?? null,
  getScheduledDockEventsForSailingDay: (args) =>
    options.scheduledEventsByScope?.get(
      `${args.vesselAbbrev}|${args.sailingDay}`
    ) ?? [],
});

const ms = (iso: string) => new Date(iso).getTime();

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
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T04:33:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  ...overrides,
});

const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledDockEvent> = {}
): ConvexScheduledDockEvent => ({
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
  VesselAbbrev: "CHE",
  SailingDay: "2026-03-13",
  UpdatedAt: ms("2026-03-13T04:33:00-07:00"),
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  TerminalAbbrev: "ANA",
  NextTerminalAbbrev: "ORI",
  EventType: "dep-dock",
  EventScheduledTime: ms("2026-03-13T05:30:00-07:00"),
  IsLastArrivalOfSailingDay: false,
  ...overrides,
});
