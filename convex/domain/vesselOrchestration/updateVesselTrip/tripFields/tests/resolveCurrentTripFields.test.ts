import { describe, expect, it } from "bun:test";
import { getTripFieldInferenceLog, resolveTripScheduleFields } from "..";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

const resolveFields = (
  input: Parameters<typeof resolveTripScheduleFields>[0]
) => resolveTripScheduleFields(input);

describe("resolveTripScheduleFields", () => {
  it("prefers next scheduled segment over rollover when both are available", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const rolloverSegment = makeScheduledSegment({
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
        segments: [nextSegment, rolloverSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${rolloverSegment.Key}--dep-dock`,
              VesselAbbrev: "CHE",
              SailingDay: "2026-03-13",
              UpdatedAt: 1,
              ScheduledDeparture: rolloverSegment.DepartingTime,
              TerminalAbbrev: "CLI",
              NextTerminalAbbrev: "MUK",
              EventType: "dep-dock",
            },
          ],
        },
      }),
    });

    expect(resolution.current.ScheduleKey).toBe(nextSegment.Key);
  });

  it("treats direct WSF trip fields as authoritative even when ScheduleKey is derived locally", async () => {
    let scheduleReadCount = 0;
    const scheduleAccess = makeScheduledTables();
    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: "CHE--2026-03-13--12:30--CLI-MUK",
      }),
      scheduleAccess: {
        getScheduledDepartureEvent: async (scheduleKey) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduledDepartureEvent(scheduleKey);
        },
        getScheduledDockEvents: async (vesselAbbrev, sailingDay) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduledDockEvents(
            vesselAbbrev,
            sailingDay
          );
        },
      },
    });

    expect(resolution.current.ScheduleKey).toBe(
      "CHE--2026-03-13--11:00--CLI-MUK"
    );
    expect(scheduleReadCount).toBe(0);
  });

  it("uses existing trip fields without schedule reads when WSF is incomplete", async () => {
    let scheduleReadCount = 0;
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
    });
    const scheduleAccess = makeScheduledTables();

    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip,
      scheduleAccess: {
        getScheduledDepartureEvent: async (scheduleKey) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduledDepartureEvent(scheduleKey);
        },
        getScheduledDockEvents: async (vesselAbbrev, sailingDay) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduledDockEvents(
            vesselAbbrev,
            sailingDay
          );
        },
      },
    });

    expect(resolution.current.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
    expect(resolution.current.ScheduledDeparture).toBe(
      existingTrip.ScheduledDeparture
    );
    expect(resolution.current.ScheduleKey).toBe(existingTrip.ScheduleKey);
    expect(scheduleReadCount).toBe(0);
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
        getScheduledDepartureEvent: async (scheduleKey) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduledDepartureEvent(scheduleKey);
        },
        getScheduledDockEvents: async (vesselAbbrev, sailingDay) => {
          scheduleReadCount += 1;
          return scheduleAccess.getScheduledDockEvents(
            vesselAbbrev,
            sailingDay
          );
        },
      },
    });

    expect(resolution.current.ScheduleKey).toBe(nextSegment.Key);
    expect(resolution.next?.NextScheduleKey).toBe(nextSegment.NextKey);
    expect(resolution.next?.NextScheduledDeparture).toBe(
      nextSegment.NextDepartingTime
    );
    expect(scheduleReadCount).toBeGreaterThan(0);
  });

  it("infers trip fields by schedule rollover when the next scheduled trip is unavailable", async () => {
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

    expect(resolution.current.ScheduleKey).toBe(nextSegment.Key);
    expect(resolution.current.ArrivingTerminalAbbrev).toBe(
      nextSegment.ArrivingTerminalAbbrev
    );
  });

  it("falls back cleanly when no schedule match exists", async () => {
    const resolution = await resolveFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      }),
      scheduleAccess: makeScheduledTables(),
    });

    expect(resolution.current.ArrivingTerminalAbbrev).toBe("MUK");
    expect(resolution.current.ScheduledDeparture).toBe(
      ms("2026-03-13T11:00:00-07:00")
    );
    expect(resolution.current.ScheduleKey).toBe(
      "CHE--2026-03-13--11:00--CLI-MUK"
    );
  });

  it("falls back to inferred fields for partial WSF conflicts", async () => {
    const resolution = await resolveFields({
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
      scheduleAccess: makeScheduledTables(),
    });

    expect(resolution.current.ScheduleKey).toBe(
      "CHE--2026-03-13--11:00--CLI-MUK"
    );
    expect(resolution.current.ArrivingTerminalAbbrev).toBe("MUK");
    expect(resolution.current.ScheduledDeparture).toBe(
      ms("2026-03-13T11:00:00-07:00")
    );
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
        tripFieldDataSource: "inferred" as const,
        tripFieldInferenceMethod: "next_scheduled_trip" as const,
      },
    };

    expect(getTripFieldInferenceLog(inferenceInput)).toMatchObject({
      message:
        "[TripFields] CHE kept provisional trip fields despite partial WSF conflict",
      context: {
        vesselAbbrev: "CHE",
        reason: "partial_wsf_conflict_with_inference",
        tripFieldDataSource: "inferred",
        tripFieldInferenceMethod: "next_scheduled_trip",
      },
    });
  });
});
