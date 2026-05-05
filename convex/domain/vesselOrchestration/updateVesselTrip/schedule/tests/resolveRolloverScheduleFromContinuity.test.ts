/**
 * Behavioral tests for resolveRolloverScheduleFromContinuity.
 *
 * This suite verifies strict fallback order and cross-day schedule lookup for
 * inferred schedule-field outcomes.
 */

import { describe, expect, it } from "bun:test";
import { resolveRolloverScheduleFromContinuity } from "..";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

/**
 * Calls continuity resolution with typed test input.
 *
 * @param input - Continuity resolver input payload for one synthetic ping
 * @returns Resolver output used by assertions in this suite
 */
const resolveFields = (
  input: Parameters<typeof resolveRolloverScheduleFromContinuity>[0]
) => resolveRolloverScheduleFromContinuity(input);

/**
 * Asserts that a continuity resolution exists and returns it.
 *
 * @param resolution - Potentially undefined resolver output
 * @returns The defined resolution for chained expectations
 */
const expectResolved = (
  resolution: Awaited<ReturnType<typeof resolveRolloverScheduleFromContinuity>>
) => {
  expect(resolution).toBeDefined();
  return resolution;
};

describe("resolveRolloverScheduleFromContinuity", () => {
  it("prefers next scheduled segment over schedule tables when both are available", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const scheduleTablesSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--13:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T13:30:00-07:00"),
    });

    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      dbAccess: makeScheduledTables({
        segments: [nextSegment, scheduleTablesSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${scheduleTablesSegment.Key}--dep-dock`,
              VesselAbbrev: "CHE",
              SailingDay: "2026-03-13",
              UpdatedAt: 1,
              ScheduledDeparture: scheduleTablesSegment.DepartingTime,
              TerminalAbbrev: "CLI",
              NextTerminalAbbrev: "MUK",
              EventType: "dep-dock",
            },
          ],
        },
      }),
    });

    const resolved = expectResolved(resolution);
    expect(resolved?.current.ScheduleKey).toBe(nextSegment.Key);
    expect(resolved?.current.tripFieldResolutionMethod).toBe("nextScheduleKey");
  });

  it("falls back to schedule lookup when next key segment mismatches terminal", async () => {
    const staleNextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--PTA-MUK",
      DepartingTerminalAbbrev: "PTA",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const scheduleTablesSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--13:30--CLI-MUK",
      DepartingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T13:30:00-07:00"),
    });

    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: staleNextSegment.Key,
      }),
      dbAccess: makeScheduledTables({
        segments: [staleNextSegment, scheduleTablesSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${scheduleTablesSegment.Key}--dep-dock`,
              VesselAbbrev: "CHE",
              SailingDay: "2026-03-13",
              UpdatedAt: 1,
              ScheduledDeparture: scheduleTablesSegment.DepartingTime,
              TerminalAbbrev: "CLI",
              NextTerminalAbbrev: "MUK",
              EventType: "dep-dock",
            },
          ],
        },
      }),
    });

    const resolved = expectResolved(resolution);
    expect(resolved?.current.ScheduleKey).toBe(scheduleTablesSegment.Key);
    expect(resolved?.current.tripFieldResolutionMethod).toBe("scheduleLookup");
  });

  it("infers trip fields from the next scheduled trip when WSF is incomplete", async () => {
    let scheduleReadCount = 0;
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });
    const dbAccessTables = makeScheduledTables({
      segments: [nextSegment],
    });

    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      dbAccess: {
        getScheduledSegmentByScheduleKey: async (scheduleKey) => {
          scheduleReadCount += 1;
          return dbAccessTables.getScheduledSegmentByScheduleKey(scheduleKey);
        },
        getScheduleRolloverDockEvents: async (args) => {
          scheduleReadCount += 1;
          return dbAccessTables.getScheduleRolloverDockEvents(args);
        },
      },
    });

    const resolved = expectResolved(resolution);
    expect(resolved?.current.ScheduleKey).toBe(nextSegment.Key);
    expect(resolved?.next?.NextScheduleKey).toBe(nextSegment.NextKey);
    expect(resolved?.next?.NextScheduledDeparture).toBe(
      nextSegment.NextDepartingTime
    );
    expect(scheduleReadCount).toBe(1);
  });

  it("infers next segment from NextScheduleKey instead of stale stored arrival row", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        ArrivingTerminalAbbrev: "OLD",
        ScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--08:00--OLD-LEG",
        NextScheduleKey: nextSegment.Key,
      }),
      dbAccess: makeScheduledTables({
        segments: [nextSegment],
      }),
    });

    const resolved = expectResolved(resolution);
    expect(resolved?.current.ArrivingTerminalAbbrev).toBe("MUK");
    expect(resolved?.current.ScheduleKey).toBe(nextSegment.Key);
  });

  it("infers trip fields by schedule tables when the next scheduled trip is unavailable", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: undefined,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      dbAccess: makeScheduledTables({
        segments: [nextSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${nextSegment.Key}--dep-dock`,
              VesselAbbrev: "CHE",
              SailingDay: "2026-03-13",
              UpdatedAt: 1,
              ScheduledDeparture: nextSegment.DepartingTime,
              TerminalAbbrev: "CLI",
              NextTerminalAbbrev: "MUK",
              EventType: "dep-dock",
            },
          ],
        },
      }),
    });

    const resolved = expectResolved(resolution);
    expect(resolved?.current.ScheduleKey).toBe(nextSegment.Key);
    expect(resolved?.current.ArrivingTerminalAbbrev).toBe(
      nextSegment.ArrivingTerminalAbbrev
    );
  });

  it("returns undefined when neither next-trip key nor schedule tables resolve", async () => {
    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: "CHE--2026-03-13--12:30--CLI-MUK",
      }),
      dbAccess: makeScheduledTables({
        segments: [],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [],
        },
      }),
    });

    expect(resolution).toBeUndefined();
  });
});
