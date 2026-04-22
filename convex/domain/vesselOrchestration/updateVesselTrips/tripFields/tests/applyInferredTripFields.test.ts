import { describe, expect, it } from "bun:test";
import { applyInferredTripFields } from "../applyInferredTripFields";
import { makeLocation, ms } from "./testHelpers";

describe("applyInferredTripFields", () => {
  it("overlays only the intended trip fields", () => {
    const location = makeLocation({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
    });

    const applied = applyInferredTripFields(location, {
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
    });

    expect(applied.ArrivingTerminalAbbrev).toBe("MUK");
    expect(applied.ScheduledDeparture).toBe(ms("2026-03-13T11:00:00-07:00"));
    expect(applied.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
    expect(applied.VesselAbbrev).toBe(location.VesselAbbrev);
  });

  it("does not clobber existing values with undefined", () => {
    const location = makeLocation();

    const applied = applyInferredTripFields(location, {
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
    });

    expect(applied.ArrivingTerminalAbbrev).toBe(location.ArrivingTerminalAbbrev);
    expect(applied.ScheduledDeparture).toBe(location.ScheduledDeparture);
    expect(applied.ScheduleKey).toBe(location.ScheduleKey);
  });
});
