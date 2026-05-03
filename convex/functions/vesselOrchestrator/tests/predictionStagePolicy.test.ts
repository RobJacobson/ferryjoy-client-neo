/**
 * Tests `getVesselTripPredictionsFromTripUpdate` load policy: when the
 * injected `loadPredictionModelParameters` runs vs stays cold (route pair,
 * readiness, at-sea `LeftDockActual`).
 */

import { describe, expect, it, mock } from "bun:test";
import {
  getVesselTripPredictionsFromTripUpdate,
  type PredictionModelParametersByPairKey,
  type PredictionModelParametersRequest,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Minimal at-dock trip with a deliberately incomplete route so the domain
 * skips loading prediction model parameters.
 *
 * @returns Active vessel trip row shaped for the policy test only
 */
const tripMissingRoutePair = (): ConvexVesselTripWithPredictions =>
  ({
    VesselAbbrev: "CHE",
    DepartingTerminalAbbrev: "ORI",
    ArrivingTerminalAbbrev: undefined,
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
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
  }) as ConvexVesselTripWithPredictions;

const predictionReadyAtDockTrip = (
  overrides: Partial<ConvexVesselTripWithPredictions> = {}
): ConvexVesselTripWithPredictions =>
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
    ...overrides,
  }) as ConvexVesselTripWithPredictions;

describe("prediction stage fetch policy", () => {
  it("does not load prediction model parameters when the route pair cannot be derived", async () => {
    const loadPredictionModelParameters = mock(
      async (): Promise<PredictionModelParametersByPairKey> => {
        throw new Error("load should not run");
      }
    );

    await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: "CHE",
        activeVesselTrip: tripMissingRoutePair(),
      },
      { loadPredictionModelParameters }
    );

    expect(loadPredictionModelParameters).toHaveBeenCalledTimes(0);
  });

  it("does not load prediction model parameters when prediction readiness inputs are missing", async () => {
    const loadPredictionModelParameters = mock(
      async (): Promise<PredictionModelParametersByPairKey> => {
        throw new Error("load should not run");
      }
    );

    await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: "CHE",
        activeVesselTrip: predictionReadyAtDockTrip({
          PrevScheduledDeparture: undefined,
        }),
      },
      { loadPredictionModelParameters }
    );

    expect(loadPredictionModelParameters).toHaveBeenCalledTimes(0);
  });

  it("does not load at-sea model parameters without LeftDockActual", async () => {
    const loadPredictionModelParameters = mock(
      async (): Promise<PredictionModelParametersByPairKey> => {
        throw new Error("load should not run");
      }
    );

    await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: "CHE",
        activeVesselTrip: predictionReadyAtDockTrip({
          AtDock: false,
          LeftDockActual: undefined,
          LeftDock: ms("2026-03-13T09:31:00-07:00"),
        }),
      },
      { loadPredictionModelParameters }
    );

    expect(loadPredictionModelParameters).toHaveBeenCalledTimes(0);
  });

  it("loads only runnable at-dock model parameters", async () => {
    const loadPredictionModelParameters = mock(
      async (
        _request: PredictionModelParametersRequest
      ): Promise<PredictionModelParametersByPairKey> => ({})
    );

    await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: "CHE",
        activeVesselTrip: predictionReadyAtDockTrip({
          NextScheduledDeparture: undefined,
          NextScheduleKey: undefined,
        }),
      },
      { loadPredictionModelParameters }
    );

    expect(loadPredictionModelParameters).toHaveBeenCalledTimes(1);
    expect(loadPredictionModelParameters.mock.calls[0][0]).toEqual({
      pairKey: "ORI->LOP",
      modelTypes: ["at-dock-depart-curr", "at-dock-arrive-next"],
    });
  });
});
