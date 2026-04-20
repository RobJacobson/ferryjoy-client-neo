import { describe, expect, it } from "bun:test";
import type { TripComputation } from "domain/vesselOrchestration/updateVesselTrips/contracts";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import {
  computeShouldRunPredictionFallback,
  computeVesselPredictionGates,
  derivePredictionGatesForComputation,
} from "../predictionPolicy";

const ms = (iso: string) => new Date(iso).getTime();

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
};

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
  it("computeShouldRunPredictionFallback matches first 10s of UTC minute", () => {
    const early = new Date("2026-04-19T12:00:05.000Z").getTime();
    const late = new Date("2026-04-19T12:00:15.000Z").getTime();
    expect(computeShouldRunPredictionFallback(early)).toBe(true);
    expect(computeShouldRunPredictionFallback(late)).toBe(false);
  });

  it("derivePredictionGatesForComputation matches computeVesselPredictionGates fixed vector", () => {
    const trip = makeTrip();
    const tickStartedAt = new Date("2026-03-13T12:00:03.000Z").getTime();
    const expected = computeVesselPredictionGates(
      trip,
      defaultEvents,
      false,
      computeShouldRunPredictionFallback(tickStartedAt)
    );
    const computation: TripComputation = {
      vesselAbbrev: trip.VesselAbbrev,
      branch: "current",
      events: defaultEvents,
      activeTrip: trip,
      tripCore: {
        withFinalSchedule: trip,
      },
    };
    const derived = derivePredictionGatesForComputation(
      computation,
      tickStartedAt
    );
    expect(derived).toEqual(expected);
  });

  it("returns no-op gates for current branch when events are undefined", () => {
    const trip = makeTrip();
    const computation: TripComputation = {
      vesselAbbrev: trip.VesselAbbrev,
      branch: "current",
      activeTrip: trip,
      tripCore: { withFinalSchedule: trip },
    };
    expect(
      derivePredictionGatesForComputation(computation, trip.TimeStamp)
    ).toEqual({
      shouldAttemptAtDockPredictions: false,
      shouldAttemptAtSeaPredictions: false,
      didJustLeaveDock: false,
    });
  });
});
