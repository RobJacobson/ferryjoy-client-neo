import { describe, expect, it } from "bun:test";
import { attachNextScheduledTripFields } from "../attachNextScheduledTripFields";
import {
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

describe("attachNextScheduledTripFields", () => {
  it("preserves carried next scheduled trip fields when the segment is unchanged", () => {
    const existingTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });
    const trip = attachNextScheduledTripFields({
      baseTrip: makeTrip({
        ScheduleKey: existingTrip.ScheduleKey,
        NextScheduleKey: undefined,
        NextScheduledDeparture: undefined,
      }),
      existingTrip,
      scheduleTables: makeScheduledTables(),
    });

    expect(trip.NextScheduleKey).toBe(existingTrip.NextScheduleKey);
    expect(trip.NextScheduledDeparture).toBe(
      existingTrip.NextScheduledDeparture
    );
  });

  it("looks up next scheduled trip fields when the schedule segment changes", () => {
    const scheduledSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      NextKey: "CHE--2026-03-13--14:00--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });
    const trip = attachNextScheduledTripFields({
      baseTrip: makeTrip({
        ScheduleKey: scheduledSegment.Key,
        NextScheduleKey: undefined,
        NextScheduledDeparture: undefined,
      }),
      existingTrip: makeTrip({
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      }),
      scheduleTables: makeScheduledTables({
        segments: [scheduledSegment],
      }),
    });

    expect(trip.NextScheduleKey).toBe(scheduledSegment.NextKey);
    expect(trip.NextScheduledDeparture).toBe(
      scheduledSegment.NextDepartingTime
    );
  });

  it("clears carried next scheduled trip fields when the segment changes and no replacement segment exists", () => {
    const trip = attachNextScheduledTripFields({
      baseTrip: makeTrip({
        ScheduleKey: "CHE--2026-03-13--12:30--CLI-MUK",
        NextScheduleKey: "STALE-NEXT-KEY",
        NextScheduledDeparture: ms("2026-03-13T14:00:00-07:00"),
      }),
      existingTrip: makeTrip({
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
        NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
      }),
      scheduleTables: makeScheduledTables(),
    });

    expect(trip.NextScheduleKey).toBeUndefined();
    expect(trip.NextScheduledDeparture).toBeUndefined();
  });
});
