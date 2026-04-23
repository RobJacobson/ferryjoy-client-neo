import { describe, expect, it } from "bun:test";
import { hasWsfTripFields } from "../hasWsfTripFields";
import { makeLocation } from "./testHelpers";

describe("hasWsfTripFields", () => {
  it("returns true when WSF provides arriving terminal and scheduled departure", () => {
    expect(hasWsfTripFields(makeLocation())).toBe(true);
  });

  it("returns false when either required WSF field is missing", () => {
    expect(
      hasWsfTripFields(
        makeLocation({
          ArrivingTerminalAbbrev: undefined,
        })
      )
    ).toBe(false);
    expect(
      hasWsfTripFields(
        makeLocation({
          ScheduledDeparture: undefined,
        })
      )
    ).toBe(false);
  });
});
