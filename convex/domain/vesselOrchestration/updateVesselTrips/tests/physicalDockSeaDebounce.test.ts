/**
 * Unit tests for physical dock/sea debounce helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  rawDepartureIsContradictory,
  resolveDebouncedPhysicalBoundaries,
} from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/physicalDockSeaDebounce";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

describe("resolveDebouncedPhysicalBoundaries", () => {
  it("suppresses departure when LeftDock appears but the ping still looks docked", () => {
    const existingTrip = makeTrip({
      LeftDock: undefined,
      LeftDockActual: undefined,
      AtDock: true,
    });
    const currLocation = makeLocation({
      AtDock: true,
      Speed: 0,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
    });

    expect(rawDepartureIsContradictory(existingTrip, currLocation)).toBe(true);
    const { didJustLeaveDock } = resolveDebouncedPhysicalBoundaries(
      existingTrip,
      currLocation
    );
    expect(didJustLeaveDock).toBe(false);
  });

  it("fires departure when LeftDock appears and the ping does not contradict underway", () => {
    const existingTrip = makeTrip({
      LeftDock: undefined,
      LeftDockActual: undefined,
      AtDock: true,
    });
    const currLocation = makeLocation({
      AtDock: false,
      Speed: 3,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
    });

    expect(rawDepartureIsContradictory(existingTrip, currLocation)).toBe(false);
    const { didJustLeaveDock } = resolveDebouncedPhysicalBoundaries(
      existingTrip,
      currLocation
    );
    expect(didJustLeaveDock).toBe(true);
  });
});

const ms = (iso: string) => new Date(iso).getTime();

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: undefined,
  ArrivingTerminalName: undefined,
  ArrivingTerminalAbbrev: undefined,
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T03:08:47-07:00"),
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T04:33:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  ...overrides,
});
