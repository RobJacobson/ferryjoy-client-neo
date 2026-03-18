import { describe, expect, it } from "bun:test";
import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import { classifyDirectSegments } from "./directSegments";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours, minutes);

describe("classifyDirectSegments", () => {
  it("keeps the direct leg that matches the next physical departure terminal", () => {
    const trips = classifyDirectSegments([
      makeTrip({
        Key: "A-B",
        DepartingTerminalAbbrev: "A",
        ArrivingTerminalAbbrev: "B",
        DepartingTime: at(8, 0),
      }),
      makeTrip({
        Key: "A-C",
        DepartingTerminalAbbrev: "A",
        ArrivingTerminalAbbrev: "C",
        DepartingTime: at(8, 0),
      }),
      makeTrip({
        Key: "B-C",
        DepartingTerminalAbbrev: "B",
        ArrivingTerminalAbbrev: "C",
        DepartingTime: at(9, 0),
      }),
    ]);

    expect(trips.find((trip) => trip.Key === "A-B")?.TripType).toBe("direct");
    expect(trips.find((trip) => trip.Key === "A-C")?.TripType).toBe("indirect");
    expect(trips.find((trip) => trip.Key === "B-C")?.TripType).toBe("direct");
  });
});

const makeTrip = (
  overrides: Partial<ConvexScheduledTrip>
): ConvexScheduledTrip => ({
  VesselAbbrev: "TOK",
  DepartingTerminalAbbrev: "A",
  ArrivingTerminalAbbrev: "B",
  DepartingTime: at(8, 0),
  ArrivingTime: at(8, 30),
  SailingNotes: "",
  Annotations: [],
  RouteID: 1,
  RouteAbbrev: "a-b",
  Key: "trip",
  SailingDay: "2026-03-13",
  TripType: "direct",
  ...overrides,
});
