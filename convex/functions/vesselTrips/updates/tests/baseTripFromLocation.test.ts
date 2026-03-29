/**
 * Characterization tests for the base trip builder.
 *
 * These tests lock in the subtle scenario-specific field rules so the builder
 * can be refactored with confidence.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getSailingDay } from "shared/time";
import { baseTripFromLocation } from "../baseTripFromLocation";

describe("baseTripFromLocation", () => {
  it("uses the current scheduled departure to set SailingDay on trip start", () => {
    const currLocation = makeLocation({
      ArrivingTerminalAbbrev: "ORI",
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      TimeStamp: ms("2026-03-13T04:45:00-07:00"),
    });
    const scheduledDeparture = currLocation.ScheduledDeparture;

    const trip = baseTripFromLocation(currLocation, undefined, true);

    expect(scheduledDeparture).toBeDefined();
    expect(trip.ScheduledDeparture).toBe(scheduledDeparture);
    expect(trip.SailingDay).toBe(
      getSailingDay(new Date(scheduledDeparture ?? 0))
    );
  });

  it("carries scheduled departure forward for continuing trips and derives SailingDay from it", () => {
    const existingTrip = makeTrip({
      ScheduledDeparture: ms("2026-03-13T00:45:00-07:00"),
    });
    const scheduledDeparture = existingTrip.ScheduledDeparture;
    const currLocation = makeLocation({
      ScheduledDeparture: undefined,
      TimeStamp: ms("2026-03-13T01:00:00-07:00"),
    });

    const trip = baseTripFromLocation(currLocation, existingTrip, false);

    expect(scheduledDeparture).toBeDefined();
    expect(trip.ScheduledDeparture).toBe(scheduledDeparture);
    expect(trip.SailingDay).toBe(
      getSailingDay(new Date(scheduledDeparture ?? 0))
    );
  });

  it("leaves SailingDay undefined when no scheduled departure exists", () => {
    const currLocation = makeLocation({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
    });

    const trip = baseTripFromLocation(currLocation, undefined, false);

    expect(trip.ScheduledDeparture).toBeUndefined();
    expect(trip.SailingDay).toBeUndefined();
  });

  it("preserves the existing trip during dock hold updates", () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "ORI",
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      NextKey: "NEXT-SEGMENT",
      TimeStamp: ms("2026-03-13T06:28:45-07:00"),
    });
    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const trip = baseTripFromLocation(currLocation, existingTrip, false);

    expect(trip.DepartingTerminalAbbrev).toBe(
      existingTrip.DepartingTerminalAbbrev
    );
    expect(trip.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
    expect(trip.LeftDock).toBe(existingTrip.LeftDock);
    expect(trip.NextKey).toBe(existingTrip.NextKey);
    expect(trip.TimeStamp).toBe(currLocation.TimeStamp);
  });
});

/**
 * Convert an ISO timestamp into epoch milliseconds.
 *
 * @param iso - ISO-8601 timestamp string
 * @returns Epoch milliseconds for the provided timestamp
 */
const ms = (iso: string) => new Date(iso).getTime();

/**
 * Build a test vessel location with sensible defaults.
 *
 * @param overrides - Scenario-specific field overrides
 * @returns Concrete location payload for tests
 */
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
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T04:33:00-07:00"),
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

/**
 * Build a test vessel trip with sensible defaults.
 *
 * @param overrides - Scenario-specific field overrides
 * @returns Concrete trip payload for tests
 */
const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
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
  NextKey: undefined,
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
