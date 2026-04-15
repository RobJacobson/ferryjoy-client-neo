import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  fromVesselTrip,
  getCoverageEndMs,
  getCoverageStartMs,
  getDepartureMs,
  getDestinationArrivalMs,
  getOriginArrivalMs,
} from "../unifiedTrip";

describe("unifiedTrip", () => {
  it("prefers canonical coverage and physical timestamps over legacy mirrors", () => {
    const trip = makeTrip({
      StartTime: ms("2026-04-14T10:00:00-07:00"),
      TripStart: ms("2026-04-14T11:00:00-07:00"),
      EndTime: ms("2026-04-14T11:05:00-07:00"),
      TripEnd: ms("2026-04-14T12:05:00-07:00"),
      ArriveOriginDockActual: ms("2026-04-14T10:30:00-07:00"),
      AtDockActual: ms("2026-04-14T10:45:00-07:00"),
      DepartOriginActual: ms("2026-04-14T10:45:00-07:00"),
      LeftDockActual: ms("2026-04-14T10:50:00-07:00"),
      LeftDock: ms("2026-04-14T10:55:00-07:00"),
      ArriveDestDockActual: ms("2026-04-14T11:00:00-07:00"),
      ArriveDest: ms("2026-04-14T11:10:00-07:00"),
    });

    expect(getCoverageStartMs(trip)).toBe(trip.StartTime);
    expect(getCoverageEndMs(trip)).toBe(trip.EndTime);
    expect(getOriginArrivalMs(trip)).toBe(trip.ArriveOriginDockActual);
    expect(getDepartureMs(trip)).toBe(trip.DepartOriginActual);
    expect(getDestinationArrivalMs(trip)).toBe(trip.ArriveDestDockActual);

    const unified = fromVesselTrip(trip);

    expect(unified.StartTime).toBe(trip.StartTime);
    expect(unified.TripStart).toBe(trip.StartTime);
    expect(unified.EndTime).toBe(trip.EndTime);
    expect(unified.TripEnd).toBe(trip.EndTime);
    expect(unified.ArriveOriginDockActual).toBe(trip.ArriveOriginDockActual);
    expect(unified.ArriveDestDockActual).toBe(trip.ArriveDestDockActual);
    expect(unified.DepartOriginActual).toBe(trip.DepartOriginActual);
  });
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip =>
  ({
    VesselAbbrev: "CHE",
    DepartingTerminalAbbrev: "ANA",
    ArrivingTerminalAbbrev: "FRH",
    TripKey: "CHE-2026-04-14T10:00:00-07:00",
    AtDock: false,
    InService: true,
    TimeStamp: ms("2026-04-14T10:59:00-07:00"),
    ScheduledDeparture: ms("2026-04-14T10:50:00-07:00"),
    PrevScheduledDeparture: ms("2026-04-14T08:45:00-07:00"),
    PrevLeftDock: ms("2026-04-14T08:50:00-07:00"),
    PrevTerminalAbbrev: "ORI",
    ...overrides,
  }) as ConvexVesselTrip;

const ms = (iso: string) => new Date(iso).getTime();
