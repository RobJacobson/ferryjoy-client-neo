import { describe, expect, it } from "bun:test";
import { resolveCurrentTripFields } from "../resolveCurrentTripFields";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

describe("resolveCurrentTripFields", () => {
  it("prefers next scheduled segment over rollover when both are available", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const rolloverSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--13:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T13:30:00-07:00"),
    });

    const resolved = resolveCurrentTripFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      }),
      scheduleTables: makeScheduledTables({
        segments: [nextSegment, rolloverSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${rolloverSegment.Key}--dep-dock`,
              ScheduledDeparture: rolloverSegment.DepartingTime,
              TerminalAbbrev: "CLI",
            },
          ],
        },
      }),
    });

    expect(resolved.ScheduleKey).toBe(nextSegment.Key);
    expect(resolved.tripFieldInferenceMethod).toBe("next_scheduled_trip");
  });

  it("treats direct WSF trip fields as authoritative even when ScheduleKey is derived locally", () => {
    const resolved = resolveCurrentTripFields({
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

    expect(resolved.tripFieldDataSource).toBe("wsf");
    expect(resolved.tripFieldInferenceMethod).toBeUndefined();
    expect(resolved.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
    expect(resolved).not.toHaveProperty("NextScheduleKey");
  });

  it("infers trip fields from the next scheduled trip when WSF is incomplete", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });

    const resolved = resolveCurrentTripFields({
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

    expect(resolved.tripFieldDataSource).toBe("inferred");
    expect(resolved.tripFieldInferenceMethod).toBe("next_scheduled_trip");
    expect(resolved.ScheduleKey).toBe(nextSegment.Key);
    expect(resolved).not.toHaveProperty("NextScheduleKey");
  });

  it("infers trip fields by schedule rollover when the next scheduled trip is unavailable", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const resolved = resolveCurrentTripFields({
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

    expect(resolved.tripFieldDataSource).toBe("inferred");
    expect(resolved.tripFieldInferenceMethod).toBe("schedule_rollover");
    expect(resolved.ScheduleKey).toBe(nextSegment.Key);
  });

  it("falls back cleanly when no schedule match exists", () => {
    const resolved = resolveCurrentTripFields({
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

    expect(resolved.ArrivingTerminalAbbrev).toBe("MUK");
    expect(resolved.ScheduledDeparture).toBe(ms("2026-03-13T11:00:00-07:00"));
    expect(resolved.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
    expect(resolved.tripFieldDataSource).toBe("inferred");
  });

  it("marks reused persisted provisional fields as inferred semantics without next-leg on the contract", () => {
    const resolved = resolveCurrentTripFields({
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

    expect(resolved).toMatchObject({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      tripFieldDataSource: "inferred",
    });
    expect(resolved).not.toHaveProperty("NextScheduleKey");
    expect(resolved.tripFieldInferenceMethod).toBeUndefined();
  });

  it("marks partial WSF fallback rows as inferred when the feed is incomplete", () => {
    const resolved = resolveCurrentTripFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: undefined,
      scheduleTables: makeScheduledTables(),
    });

    expect(resolved).toMatchObject({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: undefined,
      tripFieldDataSource: "inferred",
    });
  });
});
