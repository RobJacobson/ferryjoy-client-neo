import { describe, expect, it } from "bun:test";
import { findScheduledTripMatch } from "../findScheduledTripMatch";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

describe("findScheduledTripMatch", () => {
  it("prefers the existing trip's next scheduled segment over rollover", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const rolloverSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--13:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T13:30:00-07:00"),
    });

    const match = findScheduledTripMatch({
      location: makeLocation({
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

    expect(match?.segment.Key).toBe(nextSegment.Key);
    expect(match?.tripFieldInferenceMethod).toBe("next_scheduled_trip");
  });
});
