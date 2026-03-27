/**
 * Covers normalized boundary-event derivation helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  buildPredictedBoundaryClearEffect,
  buildPredictedBoundaryEventsFromTrips,
  buildPredictedBoundaryProjectionEffect,
} from "../normalizedEvents";
import type { ConvexVesselTrip } from "../../../functions/vesselTrips/schemas";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

describe("buildPredictedBoundaryEventsFromTrips", () => {
  it("prefers WSF ETA over ML arrival predictions", () => {
    const [row] = buildPredictedBoundaryEventsFromTrips([
      makeTrip({
        ScheduledDeparture: at(12, 20),
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        Eta: at(12, 57),
        AtDockArriveNext: makePrediction(at(12, 59)),
        AtSeaArriveNext: makePrediction(at(12, 58)),
      }),
    ]);

    expect(row?.EventPredictedTime).toBe(at(12, 57));
    expect(row?.PredictionType).toBe("AtSeaArriveNext");
    expect(row?.PredictionSource).toBe("wsf_eta");
  });

  it("prefers at-sea depart-next over at-dock depart-next", () => {
    const rows = buildPredictedBoundaryEventsFromTrips([
      makeTrip({
        ScheduledDeparture: at(12, 20),
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        NextScheduledDeparture: at(13, 10),
        AtDockDepartNext: makePrediction(at(13, 18)),
        AtSeaDepartNext: makePrediction(at(13, 15)),
      }),
    ]);

    expect(rows[0]?.EventPredictedTime).toBe(at(13, 15));
    expect(rows[0]?.PredictionType).toBe("AtSeaDepartNext");
  });
});

describe("buildPredictedBoundaryProjectionEffect", () => {
  it("carries the full prediction key scope even when only one row is emitted", () => {
    const effect = buildPredictedBoundaryProjectionEffect(
      makeTrip({
        AtDockDepartCurr: makePrediction(at(12, 24)),
      })
    );

    expect(effect?.TargetKeys).toEqual([
      "trip-key--dep-dock",
      "trip-key--arv-dock",
      "next-trip-key--dep-dock",
    ]);
    expect(effect?.Rows.map((row) => row.Key)).toEqual(["trip-key--dep-dock"]);
  });

  it("emits an empty row set when a trip still owns prediction keys but has no predictions", () => {
    const effect = buildPredictedBoundaryProjectionEffect(makeTrip({}));

    expect(effect?.TargetKeys).toEqual([
      "trip-key--dep-dock",
      "trip-key--arv-dock",
      "next-trip-key--dep-dock",
    ]);
    expect(effect?.Rows).toEqual([]);
  });
});

describe("buildPredictedBoundaryClearEffect", () => {
  it("builds a clear-only effect for the trip's full prediction scope", () => {
    const effect = buildPredictedBoundaryClearEffect(makeTrip({}));

    expect(effect).toEqual({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      TargetKeys: [
        "trip-key--dep-dock",
        "trip-key--arv-dock",
        "next-trip-key--dep-dock",
      ],
      Rows: [],
    });
  });
});

const makePrediction = (PredTime: number) => ({
  PredTime,
  MinTime: PredTime - 60_000,
  MaxTime: PredTime + 60_000,
  MAE: 1,
  StdDev: 1,
  Actual: undefined,
  DeltaTotal: undefined,
  DeltaRange: undefined,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTrip>
): ConvexVesselTrip => ({
  VesselAbbrev: "WEN",
  DepartingTerminalAbbrev: "BBI",
  ArrivingTerminalAbbrev: "P52",
  RouteAbbrev: "SEA-BBI",
  Key: "trip-key",
  SailingDay: "2026-03-25",
  PrevTerminalAbbrev: "P52",
  ArriveDest: undefined,
  TripStart: at(12, 0),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: at(12, 20),
  LeftDock: at(12, 22),
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: at(12, 30),
  PrevScheduledDeparture: at(11, 10),
  PrevLeftDock: at(11, 12),
  NextKey: "next-trip-key",
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
