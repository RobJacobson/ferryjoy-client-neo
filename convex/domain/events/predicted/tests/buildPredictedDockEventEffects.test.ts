/**
 * Tests predicted dock-boundary projection batches built from vessel-trip ML fields.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import {
  buildPredictedDockClearBatch,
  buildPredictedDockWriteBatch,
} from "../buildPredictedDockEventEffects";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

describe("buildPredictedDockWriteBatch", () => {
  it("carries the full prediction key scope even when only one row is emitted", () => {
    const effect = buildPredictedDockWriteBatch(
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

  it("emits WSF ETA and the best ML arrival row on the current arrival boundary", () => {
    const effect = buildPredictedDockWriteBatch(
      makeTrip({
        ScheduledDeparture: at(12, 20),
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        Eta: at(12, 57),
        AtDockArriveNext: makePrediction(at(12, 59)),
        AtSeaArriveNext: makePrediction(at(12, 58)),
      })
    );

    const arrivalRows = effect?.Rows.filter(
      (row) => row.Key === "trip-key--arv-dock"
    );

    expect(arrivalRows).toHaveLength(2);
    expect(
      arrivalRows?.find((row) => row.PredictionSource === "wsf_eta")
        ?.EventPredictedTime
    ).toBe(at(12, 57));
    expect(arrivalRows?.find((row) => row.PredictionSource === "ml")).toEqual(
      expect.objectContaining({
        EventPredictedTime: at(12, 58),
        PredictionType: "AtSeaArriveNext",
      })
    );
  });

  it("emits an empty row set when a trip still owns prediction keys but has no predictions", () => {
    const effect = buildPredictedDockWriteBatch(makeTrip({}));

    expect(effect?.TargetKeys).toEqual([
      "trip-key--dep-dock",
      "trip-key--arv-dock",
      "next-trip-key--dep-dock",
    ]);
    expect(effect?.Rows).toEqual([]);
  });
});

describe("buildPredictedDockClearBatch", () => {
  it("builds a clear-only effect for the trip's full prediction scope", () => {
    const effect = buildPredictedDockClearBatch(makeTrip({}));

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
  overrides: Partial<ConvexVesselTripWithPredictions>
): ConvexVesselTripWithPredictions => ({
  VesselAbbrev: "WEN",
  DepartingTerminalAbbrev: "BBI",
  ArrivingTerminalAbbrev: "P52",
  RouteAbbrev: "SEA-BBI",
  TripKey: "WEN 2026-03-25 12:00:00Z",
  ScheduleKey: "trip-key",
  SailingDay: "2026-03-25",
  PrevTerminalAbbrev: "P52",
  TripEnd: undefined,
  TripStart: at(12, 0),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: at(12, 20),
  LeftDock: at(12, 22),
  TripDelay: undefined,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: at(12, 30),
  PrevScheduledDeparture: at(11, 10),
  PrevLeftDock: at(11, 12),
  NextScheduleKey: "next-trip-key",
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
