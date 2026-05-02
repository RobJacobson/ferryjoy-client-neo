import { describe, expect, it } from "bun:test";
import { PREDICTION_SPECS } from "domain/ml/prediction/vesselTripPredictions";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { appendPredictionsFromLoadedModels } from "../appendPredictions";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (): ConvexVesselTripWithML => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalAbbrev: "LOP",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T09:00:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "SHI",
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  TripEnd: undefined,
  AtDock: true,
  AtDockDuration: 10,
  ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: 4,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:10:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:10:00-07:00"),
  PrevLeftDock: ms("2026-03-13T08:12:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
  NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
});

describe("appendPredictionsFromLoadedModels", () => {
  it("uses a preloaded model for a single runnable spec", async () => {
    const trip = makeTrip();
    const spec = PREDICTION_SPECS["at-dock"][0];

    const out = await appendPredictionsFromLoadedModels(
      {
        "ORI->LOP": {
          "at-dock-depart-curr": {
            featureKeys: [],
            coefficients: [],
            intercept: 3,
            testMetrics: { mae: 1, stdDev: 1 },
          },
        },
      },
      trip,
      [spec]
    );

    expect(out.AtDockDepartCurr?.PredTime).toBe(
      ms("2026-03-13T09:33:00-07:00")
    );
  });
});
