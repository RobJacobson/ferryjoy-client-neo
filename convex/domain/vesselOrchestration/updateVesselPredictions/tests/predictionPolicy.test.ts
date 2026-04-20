import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import {
  predictionModelTypesForTrip,
  shouldRunAtDockPredictions,
  shouldRunAtSeaPredictions,
} from "../predictionPolicy";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip =>
  ({
    VesselAbbrev: "CHE",
    DepartingTerminalAbbrev: "ORI",
    ArrivingTerminalAbbrev: "LOP",
    RouteAbbrev: "ana-sj",
    TripKey: generateTripKey("CHE", ms("2026-03-13T09:00:00-07:00")),
    ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
    SailingDay: "2026-03-13",
    PrevTerminalAbbrev: "SHI",
    ArrivedCurrActual: ms("2026-03-13T09:00:00-07:00"),
    AtDockActual: ms("2026-03-13T09:00:00-07:00"),
    TripStart: ms("2026-03-13T09:00:00-07:00"),
    AtDock: true,
    AtDockDuration: 10,
    ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
    LeftDock: undefined,
    LeftDockActual: undefined,
    TripDelay: 4,
    InService: true,
    TimeStamp: ms("2026-03-13T09:10:00-07:00"),
    PrevScheduledDeparture: ms("2026-03-13T08:10:00-07:00"),
    PrevLeftDock: ms("2026-03-13T08:12:00-07:00"),
    NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
    NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
    ArriveDest: undefined,
    Eta: undefined,
    TripEnd: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    ...overrides,
  }) as ConvexVesselTrip;

describe("predictionPolicy", () => {
  it("runs at-dock predictions whenever the trip is docked and origin-ready", () => {
    const trip = makeTrip();
    expect(shouldRunAtDockPredictions(trip)).toBe(true);
    expect(predictionModelTypesForTrip(trip)).toEqual([
      "at-dock-depart-curr",
      "at-dock-arrive-next",
      "at-dock-depart-next",
    ]);
  });

  it("runs at-sea predictions whenever the trip is underway with departure context", () => {
    const trip = makeTrip({
      AtDock: false,
      LeftDockActual: ms("2026-03-13T09:31:00-07:00"),
      LeftDock: ms("2026-03-13T09:31:00-07:00"),
    });
    expect(shouldRunAtSeaPredictions(trip)).toBe(true);
    expect(predictionModelTypesForTrip(trip)).toEqual([
      "at-sea-arrive-next",
      "at-sea-depart-next",
    ]);
  });

  it("returns no prediction model types when the trip is not ready for a prediction phase", () => {
    const trip = makeTrip({
      AtDock: true,
      ArrivedCurrActual: undefined,
      AtDockActual: undefined,
    });
    expect(shouldRunAtDockPredictions(trip)).toBe(false);
    expect(shouldRunAtSeaPredictions(trip)).toBe(false);
    expect(predictionModelTypesForTrip(trip)).toEqual([]);
  });
});
