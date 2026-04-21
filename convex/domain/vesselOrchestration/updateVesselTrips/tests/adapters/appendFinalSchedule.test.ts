/**
 * Tests for `appendFinalScheduleForLookup` (schedule lookup wiring).
 */

import { describe, expect, it } from "bun:test";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared";
import { appendFinalScheduleForLookup } from "domain/vesselOrchestration/updateVesselTrips/scheduleTripAdapters";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

describe("appendFinalScheduleForLookup", () => {
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

    const lookup = createTestLookup({});
    const enriched = appendFinalScheduleForLookup(
      lookup,
      baseTrip,
      existingTrip
    );

    expect(enriched.NextScheduleKey).toBe(existingTrip.NextScheduleKey);
    expect(enriched.NextScheduledDeparture).toBe(
      existingTrip.NextScheduledDeparture
    );
  });

  it("loads the next-trip schedule fields when the schedule segment changed", () => {
    const scheduledSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--11:00--CLI-MUK",
    });
    const nextScheduledSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const baseTrip = makeTrip({
      ScheduleKey: scheduledSegment.Key,
      NextScheduleKey: undefined,
      NextScheduledDeparture: undefined,
    });

    const lookup = createTestLookup({
      scheduledSegmentByKey: new Map([
        [
          scheduledSegment.Key,
          {
            ...scheduledSegment,
            NextKey: nextScheduledSegment.Key,
            NextDepartingTime: nextScheduledSegment.DepartingTime,
          },
        ],
      ]),
    });
    const enriched = appendFinalScheduleForLookup(
      lookup,
      baseTrip,
      makeTrip({ ScheduleKey: "CHE--2026-03-13--09:30--MUK-CLI" })
    );

    expect(enriched.ScheduleKey).toBe(scheduledSegment.Key);
    expect(enriched.NextScheduleKey).toBe(nextScheduledSegment.Key);
    expect(enriched.NextScheduledDeparture).toBe(
      nextScheduledSegment.DepartingTime
    );
  });
});

const createTestLookup = (options: {
  scheduledSegmentByKey?: Map<string, ConvexInferredScheduledSegment>;
}): ScheduledSegmentTables => ({
  sailingDay: "2026-03-13",
  scheduledDepartureBySegmentKey: Object.fromEntries(
    options.scheduledSegmentByKey ?? new Map()
  ),
  scheduledDeparturesByVesselAbbrev: {},
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

const makeScheduledSegment = (
  overrides: Partial<ConvexInferredScheduledSegment> = {}
): ConvexInferredScheduledSegment => ({
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  DepartingTime: ms("2026-03-13T05:30:00-07:00"),
  NextKey: undefined,
  NextDepartingTime: undefined,
  ...overrides,
});
