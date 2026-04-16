/**
 * Tests for the boundary-layer `appendFinalSchedule` adapter (schedule lookup wiring).
 */

import { describe, expect, it } from "bun:test";
import { appendFinalSchedule } from "adapters/vesselTrips/processTick";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";
import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

describe("appendFinalSchedule", () => {
  it("reuses existing next-trip schedule fields when the schedule segment is unchanged", async () => {
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

    const enriched = await appendFinalSchedule(
      createTestActionCtx({}) as never,
      baseTrip,
      existingTrip
    );

    expect(enriched.NextScheduleKey).toBe(existingTrip.NextScheduleKey);
    expect(enriched.NextScheduledDeparture).toBe(
      existingTrip.NextScheduledDeparture
    );
  });

  it("loads the next-trip schedule fields when the schedule segment changed", async () => {
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

    const enriched = await appendFinalSchedule(
      createTestActionCtx({
        scheduledEventByKey: new Map([[scheduledEvent.Key, scheduledEvent]]),
        scheduledEventsByScope: new Map([
          ["CHE|2026-03-13", [scheduledEvent, nextScheduledEvent]],
        ]),
      }) as never,
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

type TestActionCtx = {
  runQuery: (ref: unknown, args?: Record<string, unknown>) => Promise<unknown>;
};

const createTestActionCtx = (options: {
  scheduledEventByKey?: Map<string, ConvexScheduledDockEvent>;
  scheduledEventsByScope?: Map<string, ConvexScheduledDockEvent[]>;
}): TestActionCtx => ({
  runQuery: async (_ref, args) => {
    if (args && "segmentKey" in args) {
      return args.segmentKey && options.scheduledEventByKey
        ? (options.scheduledEventByKey.get(String(args.segmentKey)) ?? null)
        : null;
    }

    if (args && "vesselAbbrev" in args && "sailingDay" in args) {
      return (
        options.scheduledEventsByScope?.get(
          `${String(args.vesselAbbrev)}|${String(args.sailingDay)}`
        ) ?? []
      );
    }

    return null;
  },
});

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  overrides: Partial<ConvexVesselTripWithPredictions> = {}
): ConvexVesselTripWithPredictions => ({
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
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
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
