import { describe, expect, it } from "bun:test";
import { inferTripFieldsFromSchedule } from "../inferTripFieldsFromSchedule";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

describe("inferTripFieldsFromSchedule", () => {
  it("treats direct WSF trip fields as authoritative even when ScheduleKey is derived locally", () => {
    const inferred = inferTripFieldsFromSchedule({
      location: makeLocation({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: "CHE--2026-03-13--12:30--CLI-MUK",
      }),
      scheduleTables: makeScheduledTables(),
    });

    expect(inferred.tripFieldDataSource).toBe("wsf");
    expect(inferred.tripFieldInferenceMethod).toBeUndefined();
    expect(inferred.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
  });

  it("infers trip fields from the next scheduled trip when WSF is incomplete", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });

    const inferred = inferTripFieldsFromSchedule({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
      }),
      scheduleTables: makeScheduledTables({
        segments: [nextSegment],
      }),
    });

    expect(inferred.tripFieldDataSource).toBe("inferred");
    expect(inferred.tripFieldInferenceMethod).toBe("next_scheduled_trip");
    expect(inferred.ScheduleKey).toBe(nextSegment.Key);
    expect(inferred.NextScheduleKey).toBe(nextSegment.NextKey);
  });

  it("infers trip fields by schedule rollover when the next scheduled trip is unavailable", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const inferred = inferTripFieldsFromSchedule({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: undefined,
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      }),
      scheduleTables: makeScheduledTables({
        segments: [nextSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${nextSegment.Key}--dep-dock`,
              ScheduledDeparture: nextSegment.DepartingTime,
              TerminalAbbrev: "CLI",
            },
          ],
        },
      }),
    });

    expect(inferred.tripFieldDataSource).toBe("inferred");
    expect(inferred.tripFieldInferenceMethod).toBe("schedule_rollover");
    expect(inferred.ScheduleKey).toBe(nextSegment.Key);
  });

  it("falls back cleanly when no schedule match exists", () => {
    const inferred = inferTripFieldsFromSchedule({
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
      scheduleTables: makeScheduledTables(),
    });

    expect(inferred.ArrivingTerminalAbbrev).toBe("MUK");
    expect(inferred.ScheduledDeparture).toBe(ms("2026-03-13T11:00:00-07:00"));
    expect(inferred.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
    expect(inferred.tripFieldDataSource).toBe("inferred");
  });

  it("marks reused persisted provisional fields as inferred semantics", () => {
    const inferred = inferTripFieldsFromSchedule({
      location: makeLocation({
        AtDock: true,
        LeftDock: undefined,
        DepartingTerminalAbbrev: "CLI",
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        AtDock: true,
        LeftDock: undefined,
        DepartingTerminalAbbrev: "CLI",
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
        NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
      }),
      scheduleTables: makeScheduledTables(),
    });

    expect(inferred).toMatchObject({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
      tripFieldDataSource: "inferred",
    });
    expect(inferred.tripFieldInferenceMethod).toBeUndefined();
  });

  it("marks partial WSF fallback rows as inferred when the feed is incomplete", () => {
    const inferred = inferTripFieldsFromSchedule({
      location: makeLocation({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: undefined,
      scheduleTables: makeScheduledTables(),
    });

    expect(inferred).toMatchObject({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: undefined,
      tripFieldDataSource: "inferred",
    });
  });
});
