/**
 * Tests AtDockObserved vote resolution for vessel-location updates.
 */

import { describe, expect, it } from "bun:test";
import type {
  ConvexVesselLocation,
  ConvexVesselLocationIncoming,
} from "functions/vesselLocation/schemas";
import { withAtDockObserved } from "../withAtDockObserved";

describe("withAtDockObserved", () => {
  it("sets true when docked-oriented vote wins 2-of-3", () => {
    const incoming = [makeIncomingLocation({ AtDock: true, Speed: 0.2 })];
    const result = withAtDockObserved([], incoming);
    expect(result[0]?.AtDockObserved).toBe(true);
  });

  it("sets false when sea-oriented vote wins 2-of-3", () => {
    const incoming = [
      makeIncomingLocation({ AtDock: false, Speed: 10, LeftDock: 12345 }),
    ];
    const result = withAtDockObserved([], incoming);
    expect(result[0]?.AtDockObserved).toBe(false);
  });

  it("holds previous value when vote is indeterminate", () => {
    const incoming = [
      makeIncomingLocation({
        AtDock: true,
        Speed: Number.NaN,
        LeftDock: 12345,
      }),
    ];
    const existing = [makeExistingLocation({ AtDockObserved: false })];
    const result = withAtDockObserved(existing, incoming);
    expect(result[0]?.AtDockObserved).toBe(false);
  });

  it("defaults to false when first-seen vote is indeterminate", () => {
    const incoming = [
      makeIncomingLocation({
        AtDock: true,
        Speed: Number.NaN,
        LeftDock: 12345,
      }),
    ];
    const result = withAtDockObserved([], incoming);
    expect(result[0]?.AtDockObserved).toBe(false);
  });

  it("stabilizes flicker by using speed and left-dock signals", () => {
    const existing = [makeExistingLocation({ AtDockObserved: false })];
    const incoming = [
      makeIncomingLocation({
        AtDock: true,
        Speed: 8,
        LeftDock: 12345,
      }),
    ];
    const result = withAtDockObserved(existing, incoming);
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

const makeExistingLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  ...makeIncomingLocation(),
  AtDockObserved: false,
  ...overrides,
});
