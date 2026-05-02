import { describe, expect, it } from "bun:test";
import { PREDICTION_SPECS } from "domain/ml/prediction/vesselTripPredictions";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { getPredictionModelTypesFromTrip } from "../tripDockStatePredictionSpecs";

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
    TripEnd: undefined,
    Eta: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    ...overrides,
  }) as ConvexVesselTrip;

describe("tripDockStatePredictionSpecs", () => {
  it("uses at-dock model types when the trip is physically docked", () => {
    const trip = makeTrip();
    expect(getPredictionModelTypesFromTrip(trip)).toEqual(
      PREDICTION_SPECS["at-dock"].map((spec) => spec.modelType)
    );
  });

  it("uses at-sea model types when the trip is physically at sea", () => {
    const trip = makeTrip({
      AtDock: false,
      LeftDockActual: ms("2026-03-13T09:31:00-07:00"),
      LeftDock: ms("2026-03-13T09:31:00-07:00"),
    });
    expect(getPredictionModelTypesFromTrip(trip)).toEqual(
      PREDICTION_SPECS["at-sea"].map((spec) => spec.modelType)
    );
  });
});
