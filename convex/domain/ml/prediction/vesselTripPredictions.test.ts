import { describe, expect, it } from "bun:test";
import type { ActionCtx } from "_generated/server";
import type {
  ConvexVesselTripWithPredictions,
  ConvexVesselTripWithML,
} from "../../../functions/vesselTrips/schemas";
import {
  actualizePredictionsOnLeaveDock,
  actualizePredictionsOnTripComplete,
  createPredictionResult,
  isPredictionReadyTrip,
  PREDICTION_SPECS,
  predictFromSpec,
} from "./vesselTripPredictions";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  overrides: Partial<ConvexVesselTripWithML> = {}
): ConvexVesselTripWithML => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "SOU",
  ArrivingTerminalAbbrev: "VAI",
  RouteAbbrev: "f-v-s",
  TripKey: "CHE--2026-03-13--05:30--SOU-VAI",
  ScheduleKey: "CHE--2026-03-13--05:30--SOU-VAI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "FAU",
  ArrivedCurrActual: ms("2026-03-13T09:30:00-07:00"),
  ArrivedNextActual: undefined,
  StartTime: ms("2026-03-13T09:00:00-07:00"),
  EndTime: undefined,
  ArriveDest: undefined,
  AtDockActual: undefined,
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T10:00:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:00:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
  PrevLeftDock: ms("2026-03-13T07:20:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--07:00--VAI-ORI",
  NextScheduledDeparture: ms("2026-03-13T11:15:00-07:00"),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

describe("isPredictionReadyTrip", () => {
  it("requires canonical origin-arrival actuals rather than TripStart or AtDockActual aliases", () => {
    const readyTrip = makeTrip({
      ArrivedCurrActual: ms("2026-03-13T09:30:00-07:00"),
      TripStart: ms("2026-03-13T09:55:00-07:00"),
      AtDockActual: ms("2026-03-13T09:55:00-07:00"),
    });

    const legacyOnlyTrip = {
      ...readyTrip,
      ArrivedCurrActual: undefined,
      TripStart: ms("2026-03-13T09:55:00-07:00"),
      AtDockActual: ms("2026-03-13T09:55:00-07:00"),
    } as ConvexVesselTripWithPredictions;

    expect(isPredictionReadyTrip(readyTrip as ConvexVesselTripWithPredictions)).toBe(true);
    expect(isPredictionReadyTrip(legacyOnlyTrip)).toBe(false);
  });
});

describe("prediction actualization", () => {
  it("uses canonical departure actuals when actualizing leave-dock predictions", () => {
    const trip = makeTrip({
      LeftDockActual: ms("2026-03-13T10:05:00-07:00"),
      LeftDock: ms("2026-03-13T10:25:00-07:00"),
      AtDockDepartCurr: createPredictionResult(
        ms("2026-03-13T10:10:00-07:00"),
        1.2,
        0.8
      ),
    });

    const actualized = actualizePredictionsOnLeaveDock(trip);

    expect(actualized.AtDockDepartCurr?.Actual).toBe(
      ms("2026-03-13T10:05:00-07:00")
    );
  });

  it("does not backfill leave-dock actuals from legacy mirrors alone", () => {
    const trip = makeTrip({
      LeftDockActual: undefined,
      LeftDock: ms("2026-03-13T10:25:00-07:00"),
      AtDockDepartCurr: createPredictionResult(
        ms("2026-03-13T10:10:00-07:00"),
        1.2,
        0.8
      ),
    });

    const actualized = actualizePredictionsOnLeaveDock(trip);

    expect(actualized.AtDockDepartCurr?.Actual).toBeUndefined();
  });

  it("uses canonical destination-arrival actuals when actualizing completion predictions", () => {
    const trip = makeTrip({
      ArrivedNextActual: ms("2026-03-13T11:05:00-07:00"),
      ArriveDest: ms("2026-03-13T11:15:00-07:00"),
      TripEnd: ms("2026-03-13T11:25:00-07:00"),
      AtSeaArriveNext: createPredictionResult(
        ms("2026-03-13T11:10:00-07:00"),
        1.2,
        0.8
      ),
    });

    const actualized = actualizePredictionsOnTripComplete(trip);

    expect(actualized.AtSeaArriveNext?.Actual).toBe(
      ms("2026-03-13T11:05:00-07:00")
    );
  });

  it("does not backfill completion actuals from legacy mirrors alone", () => {
    const trip = makeTrip({
      ArrivedNextActual: undefined,
      ArriveDest: ms("2026-03-13T11:15:00-07:00"),
      TripEnd: ms("2026-03-13T11:25:00-07:00"),
      AtSeaArriveNext: createPredictionResult(
        ms("2026-03-13T11:10:00-07:00"),
        1.2,
        0.8
      ),
    });

    const actualized = actualizePredictionsOnTripComplete(trip);

    expect(actualized.AtSeaArriveNext?.Actual).toBeUndefined();
  });
});

describe("predictFromSpec", () => {
  it("skips at-sea predictions until the canonical departure actual exists", async () => {
    const trip = makeTrip({
      LeftDockActual: undefined,
      LeftDock: ms("2026-03-13T10:25:00-07:00"),
    });

    const ctx = {
      runQuery: async () => {
        throw new Error("should not query when departure actual is missing");
      },
    } as unknown as ActionCtx;

    const result = await predictFromSpec(
      ctx,
      trip,
      PREDICTION_SPECS.AtSeaArriveNext
    );

    expect(result).toBeNull();
  });
});
