/**
 * Characterization tests for the base trip builder.
 *
 * These tests lock in the subtle scenario-specific field rules so the builder
 * can be refactored with confidence.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { getSailingDay } from "shared/time";
import { baseTripFromLocation } from "../tripLifecycle/baseTripFromLocation";

const ms = (iso: string) => new Date(iso).getTime();

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

  it("uses the current tick as the new coverage start and keeps origin arrival separate", () => {
    const existingTrip = makeTrip({
      DepartingTerminalAbbrev: "ANA",
      ArrivingTerminalAbbrev: "ORI",
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      TripEnd: ms("2026-03-13T06:29:56-07:00"),
    });
    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      TimeStamp: ms("2026-03-13T06:30:05-07:00"),
    });

    const trip = baseTripFromLocation(currLocation, existingTrip, true);

    expect(trip.DepartingTerminalAbbrev).toBe(
      currLocation.DepartingTerminalAbbrev
    );
    expect(trip.StartTime).toBe(currLocation.TimeStamp);
    expect(trip.TripStart).toBe(currLocation.TimeStamp);
    expect(trip.ArriveOriginDockActual).toBe(currLocation.TimeStamp);
    expect(trip.PrevTerminalAbbrev).toBe(existingTrip.DepartingTerminalAbbrev);
    expect(trip.PrevScheduledDeparture).toBe(existingTrip.ScheduledDeparture);
    expect(trip.PrevLeftDock).toBe(existingTrip.LeftDock);
  });

  it("sets coverage start but leaves origin arrival undefined for first-seen docked bootstrap rows", () => {
    const currLocation = makeLocation({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      TimeStamp: ms("2026-03-13T06:29:56-07:00"),
    });

    const trip = baseTripFromLocation(currLocation, undefined, false);

    expect(trip.StartTime).toBe(currLocation.TimeStamp);
    expect(trip.TripStart).toBe(currLocation.TimeStamp);
    expect(trip.ArriveOriginDockActual).toBeUndefined();
    expect(trip.TripKey).toBe(
      generateTripKey(currLocation.VesselAbbrev, currLocation.TimeStamp)
    );
    expect(trip.PrevTerminalAbbrev).toBeUndefined();
    expect(trip.PrevScheduledDeparture).toBeUndefined();
    expect(trip.PrevLeftDock).toBeUndefined();
  });

  it("mints TripKey for a first-seen in-progress sailing without fabricating an origin boundary", () => {
    const currLocation = makeLocation({
      AtDock: false,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      TimeStamp: ms("2026-03-13T05:41:00-07:00"),
    });

    const trip = baseTripFromLocation(currLocation, undefined, false);

    expect(trip.TripKey).toBe(
      generateTripKey(currLocation.VesselAbbrev, currLocation.TimeStamp)
    );
    expect(trip.StartTime).toBe(currLocation.TimeStamp);
    expect(trip.TripStart).toBe(currLocation.TimeStamp);
    expect(trip.ArriveOriginDockActual).toBeUndefined();
    expect(trip.LeftDock).toBe(currLocation.LeftDock);
  });

  it("preserves docked schedule continuity when the live feed jumps ahead to a later departure", () => {
    const tripStartMs = ms("2026-04-04T16:53:06-07:00");
    const existingTrip = makeTrip({
      VesselAbbrev: "CAT",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      ScheduleKey: "CAT--2026-04-04--16:50--SOU-VAI",
      TripKey: generateTripKey("CAT", tripStartMs),
      ScheduledDeparture: ms("2026-04-04T16:50:00-07:00"),
      SailingDay: "2026-04-04",
      NextScheduleKey: "CAT--2026-04-04--17:20--VAI-FAU",
      NextScheduledDeparture: ms("2026-04-04T17:20:00-07:00"),
      TimeStamp: tripStartMs,
      TripStart: tripStartMs,
    });
    const currLocation = makeLocation({
      VesselAbbrev: "CAT",
      VesselName: "Cathlamet",
      DepartingTerminalAbbrev: "SOU",
      DepartingTerminalName: "Southworth",
      DepartingTerminalID: 20,
      ArrivingTerminalAbbrev: "VAI",
      ArrivingTerminalName: "Vashon Island",
      ArrivingTerminalID: 22,
      ScheduledDeparture: ms("2026-04-04T18:45:00-07:00"),
      TimeStamp: ms("2026-04-04T16:56:05-07:00"),
    });

    const trip = baseTripFromLocation(currLocation, existingTrip, false);

    expect(trip.ScheduleKey).toBe(existingTrip.ScheduleKey);
    expect(trip.ScheduledDeparture).toBe(existingTrip.ScheduledDeparture);
    expect(trip.SailingDay).toBe(existingTrip.SailingDay);
    expect(trip.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
  });

  it("throws when a continuing trip row is missing TripKey", () => {
    const existingTrip = makeTrip({ TripKey: undefined });
    const currLocation = makeLocation({
      TimeStamp: ms("2026-03-13T05:00:00-07:00"),
    });

    expect(() =>
      baseTripFromLocation(currLocation, existingTrip, false)
    ).toThrow("Continuing vessel trip is missing TripKey");
  });
});

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
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
