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
  it("rolls forward to the next scheduled departure at the same terminal", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const match = getRolledOverScheduledTrip({
      location: makeLocation({
        VesselAbbrev: "CHE",
        DepartingTerminalAbbrev: "CLI",
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

    expect(match?.segment.Key).toBe(nextSegment.Key);
    expect(match?.tripFieldInferenceMethod).toBe("schedule_rollover");
  });

  it("returns null when no later same-terminal departure exists", () => {
    const match = getRolledOverScheduledTrip({
      location: makeLocation(),
      existingTrip: makeTrip({
        NextScheduleKey: undefined,
      }),
      scheduleTables: makeScheduledTables(),
    });

    expect(match).toBeNull();
  });
});
