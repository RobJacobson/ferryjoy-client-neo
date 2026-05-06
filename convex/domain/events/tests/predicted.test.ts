/**
 * Tests predicted dock write batches built from vessel-trip ETA and ML fields.
 */

import { describe, expect, it } from "bun:test";
import type {
  ConvexPrediction,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  buildPredictedDockClearBatch,
  buildPredictedDockWriteBatch,
  predictedDockCompositeKey,
} from "../predicted";

/**
 * Builds a UTC timestamp fixture.
 *
 * @param hours - UTC hour
 * @param minutes - UTC minute
 * @returns Epoch milliseconds
 */
const at = (hours: number, minutes: number): number =>
  Date.UTC(2026, 2, 25, hours, minutes);

/**
 * Builds a full ML prediction fixture.
 *
 * @param predTime - Predicted timestamp in epoch milliseconds
 * @param overrides - Optional prediction field overrides
 * @returns ML prediction payload
 */
const prediction = (
  predTime: number,
  overrides: Partial<ConvexPrediction> = {}
): ConvexPrediction => ({
  PredTime: predTime,
  MinTime: predTime - 60_000,
  MaxTime: predTime + 60_000,
  MAE: 1,
  StdDev: 1,
  DeltaRange: 2,
  ...overrides,
});

/**
 * Builds a prediction-enriched vessel trip fixture.
 *
 * @param overrides - Trip field overrides
 * @returns Vessel trip with ML-compatible prediction fields
 */
const trip = (
  overrides: Partial<ConvexVesselTripWithML> = {}
): ConvexVesselTripWithML => ({
  VesselAbbrev: "WEN",
  DepartingTerminalAbbrev: "BBI",
  ArrivingTerminalAbbrev: "P52",
  RouteAbbrev: "SEA-BBI",
  TripKey: "physical-trip-key",
  ScheduleKey: "schedule-trip-key",
  SailingDay: "2026-03-25",
  PrevTerminalAbbrev: "P52",
  TripStart: at(12, 0),
  AtDock: false,
  ScheduledDeparture: at(12, 20),
  LeftDock: at(12, 22),
  Eta: undefined,
  InService: true,
  TimeStamp: at(12, 30),
  PrevScheduledDeparture: at(11, 10),
  PrevLeftDock: at(11, 12),
  NextScheduleKey: "next-schedule-trip-key",
  NextScheduledDeparture: at(13, 10),
  ...overrides,
});

describe("buildPredictedDockWriteBatch", () => {
  it("carries full target key scope when only one row is emitted", () => {
    const batch = buildPredictedDockWriteBatch(
      trip({
        AtDockDepartCurr: prediction(at(12, 24)),
      })
    );

    expect(batch?.TargetKeys).toEqual([
      "schedule-trip-key--dep-dock",
      "schedule-trip-key--arv-dock",
      "next-schedule-trip-key--dep-dock",
    ]);
    expect(batch?.Rows.map((row) => row.Key)).toEqual([
      "schedule-trip-key--dep-dock",
    ]);
  });

  it("emits WSF ETA and best ML arrival row on the current arrival boundary", () => {
    const batch = buildPredictedDockWriteBatch(
      trip({
        Eta: at(12, 57),
        AtDockArriveNext: prediction(at(12, 59)),
        AtSeaArriveNext: prediction(at(12, 58)),
      })
    );

    expect(batch?.Rows).toEqual([
      expect.objectContaining({
        Key: "schedule-trip-key--arv-dock",
        TerminalAbbrev: "P52",
        EventPredictedTime: at(12, 57),
        PredictionType: "AtSeaArriveNext",
        PredictionSource: "wsf_eta",
      }),
      expect.objectContaining({
        Key: "schedule-trip-key--arv-dock",
        TerminalAbbrev: "P52",
        EventPredictedTime: at(12, 58),
        PredictionType: "AtSeaArriveNext",
        PredictionSource: "ml",
      }),
    ]);
  });

  it("emits current and next departure ML rows with actualization fields", () => {
    const batch = buildPredictedDockWriteBatch(
      trip({
        AtDockDepartCurr: prediction(at(12, 24), {
          Actual: at(12, 25),
          DeltaTotal: 1,
        }),
        AtDockDepartNext: prediction(at(13, 12)),
        AtSeaDepartNext: prediction(at(13, 11), {
          Actual: at(13, 13),
          DeltaTotal: 2,
        }),
      })
    );

    expect(batch?.Rows).toEqual([
      {
        Key: "schedule-trip-key--dep-dock",
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        ScheduledDeparture: at(12, 20),
        TerminalAbbrev: "BBI",
        EventPredictedTime: at(12, 24),
        PredictionType: "AtDockDepartCurr",
        PredictionSource: "ml",
        Actual: at(12, 25),
        DeltaTotal: 1,
      },
      {
        Key: "next-schedule-trip-key--dep-dock",
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        ScheduledDeparture: at(13, 10),
        TerminalAbbrev: "P52",
        EventPredictedTime: at(13, 11),
        PredictionType: "AtSeaDepartNext",
        PredictionSource: "ml",
        Actual: at(13, 13),
        DeltaTotal: 2,
      },
    ]);
  });

  it("returns empty rows while retaining target keys for scoped trips", () => {
    const batch = buildPredictedDockWriteBatch(trip());

    expect(batch?.TargetKeys).toEqual([
      "schedule-trip-key--dep-dock",
      "schedule-trip-key--arv-dock",
      "next-schedule-trip-key--dep-dock",
    ]);
    expect(batch?.Rows).toEqual([]);
  });

  it("returns null when SailingDay is missing", () => {
    expect(
      buildPredictedDockWriteBatch(trip({ SailingDay: undefined }))
    ).toBeNull();
  });

  it("returns null when no boundary key can be derived", () => {
    expect(
      buildPredictedDockWriteBatch(
        trip({
          TripKey: undefined,
          ScheduleKey: undefined,
          NextScheduleKey: undefined,
        } as Partial<ConvexVesselTripWithML>) as ConvexVesselTripWithML
      )
    ).toBeNull();
  });

  it("dedupes target keys and keeps composite row identity source-aware", () => {
    const batch = buildPredictedDockWriteBatch(
      trip({
        NextScheduleKey: "schedule-trip-key",
        Eta: at(12, 57),
        AtSeaArriveNext: prediction(at(12, 58)),
      })
    );

    expect(batch?.TargetKeys).toEqual([
      "schedule-trip-key--dep-dock",
      "schedule-trip-key--arv-dock",
    ]);
    expect(batch?.Rows.map((row) => predictedDockCompositeKey(row))).toEqual([
      "schedule-trip-key--arv-dock|AtSeaArriveNext|wsf_eta",
      "schedule-trip-key--arv-dock|AtSeaArriveNext|ml",
    ]);
  });

  it("uses TripKey for the current leg when ScheduleKey is missing", () => {
    const batch = buildPredictedDockWriteBatch(
      trip({
        ScheduleKey: undefined,
        AtDockDepartCurr: prediction(at(12, 24)),
      })
    );

    expect(batch?.TargetKeys.slice(0, 2)).toEqual([
      "physical-trip-key--dep-dock",
      "physical-trip-key--arv-dock",
    ]);
    expect(batch?.Rows[0]?.Key).toBe("physical-trip-key--dep-dock");
  });
});

describe("buildPredictedDockClearBatch", () => {
  it("returns the same target key scope with empty rows", () => {
    const batch = buildPredictedDockClearBatch(trip());

    expect(batch).toEqual({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      TargetKeys: [
        "schedule-trip-key--dep-dock",
        "schedule-trip-key--arv-dock",
        "next-schedule-trip-key--dep-dock",
      ],
      Rows: [],
    });
  });

  it("returns null when SailingDay is missing", () => {
    expect(
      buildPredictedDockClearBatch(trip({ SailingDay: undefined }))
    ).toBeNull();
  });

  it("returns null when it cannot scope the trip", () => {
    expect(
      buildPredictedDockClearBatch(
        trip({
          TripKey: undefined,
          ScheduleKey: undefined,
          NextScheduleKey: undefined,
        } as Partial<ConvexVesselTripWithML>) as ConvexVesselTripWithML
      )
    ).toBeNull();
  });
});
