import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  actualizePredictionsOnLeaveDock,
  isPredictionReadyTrip,
} from "../vesselTripPredictions";

describe("vesselTripPredictions", () => {
  it("accepts canonical StartTime and ArriveOriginDockActual without legacy TripStart/AtDockActual", () => {
    const trip = makeReadyTrip({
      TripStart: undefined,
      AtDockActual: undefined,
    });

    expect(isPredictionReadyTrip(trip)).toBe(true);
  });

  it("rejects trips that only have legacy TripStart/AtDockActual", () => {
    const trip = makeReadyTrip({
      StartTime: undefined,
      ArriveOriginDockActual: undefined,
      TripStart: ms("2026-04-14T10:00:00-07:00"),
      AtDockActual: ms("2026-04-14T10:00:00-07:00"),
    });

    expect(isPredictionReadyTrip(trip)).toBe(false);
  });

  it("actualizes leave-dock predictions from the canonical departure boundary", () => {
    const departureMs = ms("2026-04-14T10:45:00-07:00");
    const trip = makeReadyTrip({
      DepartOriginActual: departureMs,
      LeftDock: undefined,
      LeftDockActual: undefined,
      AtDockDepartCurr: {
        PredTime: ms("2026-04-14T10:48:00-07:00"),
        MinTime: ms("2026-04-14T10:45:00-07:00"),
        MaxTime: ms("2026-04-14T10:51:00-07:00"),
        MAE: 1,
        StdDev: 1,
      },
    });

    const updated = actualizePredictionsOnLeaveDock(trip);

    expect(updated.AtDockDepartCurr?.Actual).toBe(departureMs);
  });
});

const makeReadyTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip =>
  ({
    VesselAbbrev: "CHE",
    DepartingTerminalAbbrev: "ANA",
    ArrivingTerminalAbbrev: "FRH",
    TripKey: "CHE-2026-04-14T10:00:00-07:00",
    AtDock: true,
    InService: true,
    TimeStamp: ms("2026-04-14T10:59:00-07:00"),
    ScheduledDeparture: ms("2026-04-14T10:50:00-07:00"),
    PrevScheduledDeparture: ms("2026-04-14T08:45:00-07:00"),
    PrevLeftDock: ms("2026-04-14T08:50:00-07:00"),
    PrevTerminalAbbrev: "ORI",
    StartTime: ms("2026-04-14T10:00:00-07:00"),
    ArriveOriginDockActual: ms("2026-04-14T10:00:00-07:00"),
    ...overrides,
  }) as ConvexVesselTrip;

const ms = (iso: string) => new Date(iso).getTime();
