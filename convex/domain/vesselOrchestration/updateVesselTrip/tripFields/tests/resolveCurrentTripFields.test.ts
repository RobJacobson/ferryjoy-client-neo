import { describe, expect, it } from "bun:test";
import { getTripFieldInferenceLog, resolveScheduleFromTripArrival } from "..";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

const resolveFields = (
  input: Parameters<typeof resolveScheduleFromTripArrival>[0]
) => resolveScheduleFromTripArrival(input);

const expectResolved = (
  resolution: Awaited<ReturnType<typeof resolveScheduleFromTripArrival>>
) => {
  expect(resolution).toBeDefined();
  return resolution;
};

describe("resolveScheduleFromTripArrival", () => {
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
      scheduleAccess: makeScheduledTables({
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
      scheduleAccess: makeScheduledTables({
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
    const scheduleAccess = makeScheduledTables({
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
      scheduleAccess: {
        getScheduledSegmentByScheduleKey: async (scheduleKey) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduledSegmentByScheduleKey(scheduleKey);
        },
        getScheduleRolloverDockEvents: async (args) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduleRolloverDockEvents(args);
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
      scheduleAccess: makeScheduledTables({
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
      scheduleAccess: makeScheduledTables({
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
      scheduleAccess: makeScheduledTables({
        segments: [],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [],
        },
      }),
    });

    expect(resolution).toBeUndefined();
  });

  it("builds inference diagnostics from inferred metadata", async () => {
    const inferenceInput = {
      location: makeLocation({
        ArrivingTerminalAbbrev: "SHI",
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      }),
      current: {
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        SailingDay: "2026-03-13",
        tripFieldResolutionMethod: "nextTripKey" as const,
      },
    };

    expect(getTripFieldInferenceLog(inferenceInput)).toMatchObject({
      message:
        "[TripFields] CHE kept provisional trip fields despite partial WSF conflict",
      context: {
        vesselAbbrev: "CHE",
        reason: "partial_wsf_conflict_with_inference",
        tripFieldResolutionMethod: "nextTripKey",
      },
    });
  });
});
