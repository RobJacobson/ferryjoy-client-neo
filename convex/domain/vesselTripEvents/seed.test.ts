import { describe, expect, it } from "bun:test";
import { buildSeedVesselTripEvents } from "./seed";
import { applyLiveLocationToEvents } from "./liveUpdates";
import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours, minutes);

describe("buildSeedVesselTripEvents", () => {
  it("builds dep/arv events from direct segments", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    expect(events.map((event) => event.EventType)).toEqual([
      "dep-dock",
      "arv-dock",
    ]);
    expect(events[1]?.ScheduledTime).toBe(at(9, 10));
  });
});

describe("applyLiveLocationToEvents", () => {
  it("writes departure actuals and clears false departures", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    const departed = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 36),
        AtDock: false,
        Speed: 12,
      })
    );
    expect(departed[0]?.ActualTime).toBe(at(8, 36));

    const unwound = applyLiveLocationToEvents(
      departed,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 37),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(unwound[0]?.ActualTime).toBeUndefined();
  });

  it("overwrites arrival predictions with fresher ETA data", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    const firstPass = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        Eta: at(9, 8),
        TimeStamp: at(8, 34),
      })
    );
    const secondPass = applyLiveLocationToEvents(
      firstPass,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        Eta: at(9, 5),
        TimeStamp: at(8, 40),
        AtDock: false,
        Speed: 14,
      })
    );

    expect(secondPass[1]?.PredictedTime).toBe(at(9, 5));
  });
});

const makeTrip = (
  overrides: Partial<ConvexScheduledTrip>
): ConvexScheduledTrip => ({
  VesselAbbrev: "TOK",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  DepartingTime: at(8, 35),
  ArrivingTime: undefined,
  SailingNotes: "",
  Annotations: [],
  RouteID: 1,
  RouteAbbrev: "sea-bi",
  Key: "TOK-P52-BBI-0835",
  SailingDay: "2026-03-13",
  TripType: "direct",
  ...overrides,
});

const makeLocation = (
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Tokitae",
  VesselAbbrev: "TOK",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Bainbridge",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 0,
  Longitude: 0,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: at(8, 35),
  RouteAbbrev: "sea-bi",
  VesselPositionNum: 1,
  TimeStamp: at(8, 34),
  DepartingDistance: undefined,
  ArrivingDistance: undefined,
  ...overrides,
});
