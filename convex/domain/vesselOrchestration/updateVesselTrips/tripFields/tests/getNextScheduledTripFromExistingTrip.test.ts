import { describe, expect, it } from "bun:test";
import { getNextScheduledTripFromExistingTrip } from "../getNextScheduledTripFromExistingTrip";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
} from "./testHelpers";

describe("getNextScheduledTripFromExistingTrip", () => {
  it("returns the next scheduled segment when the terminal matches", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
    });

    const match = getNextScheduledTripFromExistingTrip({
      location: makeLocation({
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
      }),
      scheduleTables: makeScheduledTables({
        segments: [nextSegment],
      }),
    });

    expect(match?.segment.Key).toBe(nextSegment.Key);
    expect(match?.tripFieldInferenceMethod).toBe("next_scheduled_trip");
  });

  it("returns null when the next segment points at a different terminal", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
    });

    const match = getNextScheduledTripFromExistingTrip({
      location: makeLocation({
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
      }),
      scheduleTables: makeScheduledTables({
        segments: [nextSegment],
      }),
    });

    expect(match).toBeNull();
  });
});
