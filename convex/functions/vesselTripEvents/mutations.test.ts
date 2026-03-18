/**
 * Covers validation helpers for vessel trip event reseeding inputs.
 */
import { describe, expect, it } from "bun:test";
import { validateSailingDayEvents } from "./mutations";
import type { ConvexVesselTripEvent } from "./schemas";

/**
 * Creates a UTC timestamp for the fixture sailing day using local service
 * hours.
 *
 * @param hours - Hour component in local service time
 * @param minutes - Minute component in local service time
 * @returns Epoch milliseconds for the requested fixture time
 */
const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours + 7, minutes);

describe("validateSailingDayEvents", () => {
  it("accepts events for the requested sailing day", () => {
    expect(() =>
      validateSailingDayEvents("2026-03-13", [
        makeEvent({
          Key: "2026-03-13--TOK--2026-03-13--15:35:00.000Z--P52--dep",
          SailingDay: "2026-03-13",
        }),
      ])
    ).not.toThrow();
  });

  it("rejects events for a different sailing day", () => {
    expect(() =>
      validateSailingDayEvents("2026-03-13", [
        makeEvent({
          Key: "2026-03-14--TOK--2026-03-13--15:35:00.000Z--P52--dep",
          SailingDay: "2026-03-14",
        }),
      ])
    ).toThrow("reseedForSailingDay expected event");
  });
});

/**
 * Creates a baseline vessel trip event fixture with optional overrides.
 *
 * @param overrides - Partial event fields to override in the default fixture
 * @returns A valid vessel trip event fixture for tests
 */
const makeEvent = (
  overrides: Partial<ConvexVesselTripEvent>
): ConvexVesselTripEvent => ({
  Key: "2026-03-13--TOK--2026-03-13--15:35:00.000Z--P52--dep",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-13",
  ScheduledDeparture: at(8, 35),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  ScheduledTime: at(8, 35),
  PredictedTime: undefined,
  ActualTime: undefined,
  ...overrides,
});
