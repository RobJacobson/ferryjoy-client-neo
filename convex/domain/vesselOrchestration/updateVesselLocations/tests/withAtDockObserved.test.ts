/**
 * Tests AtDockObserved vote resolution for vessel-location updates.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocationIncoming } from "functions/vesselLocation/schemas";
import { addAtDockObserved } from "../addAtDockObserved";

describe("withAtDockObserved", () => {
  it("sets true when docked-oriented vote wins 2-of-3", () => {
    const incoming = [makeIncomingLocation({ AtDock: true, Speed: 0.2 })];
    const result = addAtDockObserved(incoming);
    expect(result[0]?.AtDockObserved).toBe(true);
  });

  it("sets false when sea-oriented vote wins 2-of-3", () => {
    const incoming = [
      makeIncomingLocation({ AtDock: false, Speed: 10, LeftDock: 12345 }),
    ];
    const result = addAtDockObserved(incoming);
    expect(result[0]?.AtDockObserved).toBe(false);
  });

  it("sets false when only one docked-oriented vote is true", () => {
    const incoming = [
      makeIncomingLocation({
        AtDock: true,
        Speed: Number.NaN,
        LeftDock: 12345,
      }),
    ];
    const result = addAtDockObserved(incoming);
    expect(result[0]?.AtDockObserved).toBe(false);
  });

  it("sets true when only one sea-oriented vote is true", () => {
    const incoming = [
      makeIncomingLocation({
        AtDock: true,
        Speed: 0.2,
        LeftDock: 12345,
      }),
    ];
    const result = addAtDockObserved(incoming);
    expect(result[0]?.AtDockObserved).toBe(true);
  });

  it("uses speed and left-dock signals to override AtDock", () => {
    const incoming = [
      makeIncomingLocation({
        AtDock: true,
        Speed: 8,
        LeftDock: 12345,
      }),
    ];
    const result = addAtDockObserved(incoming);
    expect(result[0]?.AtDockObserved).toBe(false);
  });
});

const makeIncomingLocation = (
  overrides: Partial<ConvexVesselLocationIncoming> = {}
): ConvexVesselLocationIncoming => ({
  VesselID: 1,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 15,
  ArrivingTerminalName: "Orcas Island",
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48.5,
  Longitude: -122.6,
  Speed: 12,
  Heading: 180,
  InService: true,
  AtDock: false,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: 1710000000000,
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: 1710000005000,
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  DepartingDistance: 0.1,
  ArrivingDistance: 10.2,
  ...overrides,
});
