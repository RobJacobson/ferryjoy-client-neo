/**
 * Tests for buildTripFromRawData - location-derived field construction.
 *
 * Covers: first trip, regular update, fallback chain, LeftDock inference,
 * null-overwrite protection, SailingDay from ScheduledDeparture.
 */
import { describe, expect, test } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildTripFromRawData } from "../buildTrip";

const baseLocation: ConvexVesselLocation = {
  VesselID: 1,
  VesselName: "Test Vessel",
  VesselAbbrev: "TV",
  DepartingTerminalID: 10,
  DepartingTerminalName: "Terminal A",
  DepartingTerminalAbbrev: "TA",
  Latitude: 47.6,
  Longitude: -122.3,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  TimeStamp: 1700000000000,
  ScheduledDeparture: 1700000100000,
  Eta: 1700000200000,
  LeftDock: undefined,
  ArrivingTerminalAbbrev: "TB",
};

describe("buildTripFromRawData", () => {
  test("first trip: builds minimal trip from location only", () => {
    const trip = buildTripFromRawData(baseLocation);

    expect(trip.VesselAbbrev).toBe("TV");
    expect(trip.DepartingTerminalAbbrev).toBe("TA");
    expect(trip.ArrivingTerminalAbbrev).toBe("TB");
    expect(trip.AtDock).toBe(true);
    expect(trip.InService).toBe(true);
    expect(trip.TimeStamp).toBe(1700000000000);
    expect(trip.ScheduledDeparture).toBe(1700000100000);
    expect(trip.Eta).toBe(1700000200000);
    expect(trip.Key).toBeTruthy(); // Derived from raw data when fields available
    expect(trip.ScheduledTrip).toBeUndefined();
    expect(trip.PrevTerminalAbbrev).toBeUndefined();
    expect(trip.TripStart).toBeUndefined();
    expect(trip.SailingDay).toBeTruthy();
  });

  test("SailingDay prefers ScheduledDeparture", () => {
    const locWithSched = {
      ...baseLocation,
      ScheduledDeparture: 1700000100000,
      TimeStamp: 1700000000000,
    };
    const trip = buildTripFromRawData(locWithSched);
    expect(trip.SailingDay).toBeTruthy();
  });

  test("regular update: carries TripStart and uses arrival fallback chain", () => {
    const existingTrip: ConvexVesselTrip = {
      ...baseLocation,
      SailingDay: "2024-01-01",
      TripStart: 1699999900000,
      ArrivingTerminalAbbrev: "TB",
      PrevTerminalAbbrev: "TX",
      PrevScheduledDeparture: 1699999800000,
      PrevLeftDock: 1699999850000,
    } as ConvexVesselTrip;

    const locNoArriving = {
      ...baseLocation,
      ArrivingTerminalAbbrev: undefined,
    };
    const trip = buildTripFromRawData(locNoArriving, existingTrip);

    expect(trip.TripStart).toBe(1699999900000);
    expect(trip.ArrivingTerminalAbbrev).toBe("TB");
    expect(trip.PrevTerminalAbbrev).toBe("TX");
  });

  test("LeftDock inference when AtDock flips false and LeftDock missing", () => {
    const existingTrip: ConvexVesselTrip = {
      ...baseLocation,
      SailingDay: "2024-01-01",
      TripStart: 1699999900000,
      AtDock: true,
      LeftDock: undefined,
    } as ConvexVesselTrip;

    const locLeftDock = {
      ...baseLocation,
      AtDock: false,
      LeftDock: undefined,
      TimeStamp: 1700000050000,
    };

    const trip = buildTripFromRawData(locLeftDock, existingTrip);

    expect(trip.LeftDock).toBe(1700000050000);
  });

  test("null-overwrite protection: preserves existing when currLocation has null", () => {
    const existingTrip: ConvexVesselTrip = {
      ...baseLocation,
      SailingDay: "2024-01-01",
      ScheduledDeparture: 1700000100000,
      Eta: 1700000200000,
      LeftDock: 1700000150000,
    } as ConvexVesselTrip;

    const locWithNulls = {
      ...baseLocation,
      ScheduledDeparture: undefined,
      Eta: undefined,
      LeftDock: undefined,
    };

    const trip = buildTripFromRawData(locWithNulls, existingTrip);

    expect(trip.ScheduledDeparture).toBe(1700000100000);
    expect(trip.Eta).toBe(1700000200000);
    expect(trip.LeftDock).toBe(1700000150000);
  });

  test("boundary: TripStart from currLocation, Prev* from completedTrip", () => {
    const completedTrip: ConvexVesselTrip = {
      ...baseLocation,
      SailingDay: "2024-01-01",
      DepartingTerminalAbbrev: "TA",
      ArrivingTerminalAbbrev: "TB",
      ScheduledDeparture: 1700000100000,
      LeftDock: 1700000150000,
    } as ConvexVesselTrip;

    const newLoc = {
      ...baseLocation,
      DepartingTerminalAbbrev: "TB",
      ArrivingTerminalAbbrev: "TA",
      TimeStamp: 1700000300000,
    };

    const trip = buildTripFromRawData(newLoc, undefined, completedTrip);

    expect(trip.TripStart).toBe(1700000300000);
    expect(trip.PrevTerminalAbbrev).toBe("TA");
    expect(trip.PrevScheduledDeparture).toBe(1700000100000);
    expect(trip.PrevLeftDock).toBe(1700000150000);
  });
});
