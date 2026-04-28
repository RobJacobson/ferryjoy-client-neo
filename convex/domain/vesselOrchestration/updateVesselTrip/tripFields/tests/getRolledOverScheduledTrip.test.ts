import { describe, expect, it } from "bun:test";
import { getRolledOverScheduledTrip } from "../getRolledOverScheduledTrip";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

describe("getRolledOverScheduledTrip", () => {
  it("rolls forward to the next scheduled departure at the same terminal", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const match = await getRolledOverScheduledTrip({
      location: makeLocation({
        VesselAbbrev: "CHE",
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: undefined,
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
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

    expect(match?.segment.Key).toBe(nextSegment.Key);
    expect(match?.tripFieldInferenceMethod).toBe("schedule_rollover");
  });

  it("returns null when no later same-terminal departure exists", async () => {
    const match = await getRolledOverScheduledTrip({
      location: makeLocation(),
      existingTrip: makeTrip({
        NextScheduleKey: undefined,
      }),
      scheduleAccess: makeScheduledTables(),
    });

    expect(match).toBeNull();
  });

  it("can roll forward using the current snapshot day when the previous trip was on the prior sailing day", async () => {
    const nextDaySegment = makeScheduledSegment({
      Key: "CHE--2026-03-14--05:30--CLI-MUK",
      SailingDay: "2026-03-14",
      DepartingTime: ms("2026-03-14T05:30:00-07:00"),
    });

    const match = await getRolledOverScheduledTrip({
      location: makeLocation({
        VesselAbbrev: "CHE",
        DepartingTerminalAbbrev: "CLI",
        TimeStamp: ms("2026-03-14T05:10:00-07:00"),
      }),
      existingTrip: makeTrip({
        NextScheduleKey: undefined,
        ScheduledDeparture: ms("2026-03-13T23:30:00-07:00"),
      }),
      scheduleAccess: makeScheduledTables({
        sailingDay: "2026-03-14",
        segments: [nextDaySegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${nextDaySegment.Key}--dep-dock`,
              VesselAbbrev: "CHE",
              SailingDay: "2026-03-14",
              UpdatedAt: 1,
              ScheduledDeparture: nextDaySegment.DepartingTime,
              TerminalAbbrev: "CLI",
              NextTerminalAbbrev: "MUK",
              EventType: "dep-dock",
            },
          ],
        },
      }),
    });

    expect(match?.segment.Key).toBe(nextDaySegment.Key);
    expect(match?.tripFieldInferenceMethod).toBe("schedule_rollover");
  });
});
