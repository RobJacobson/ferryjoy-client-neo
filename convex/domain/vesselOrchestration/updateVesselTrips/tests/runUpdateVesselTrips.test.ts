/**
 * Tests for the canonical public trips runner.
 */

import {
  afterEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

afterEach(() => {
  mock.restore();
});

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: "CHE--2026-03-13--07:00--ORI-LOP",
  NextScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
  ...overrides,
});

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
};

describe("runUpdateVesselTrips", () => {
  it("derives public trip rows and additive tripCore handoffs from internal lifecycle output", async () => {
    const completedExisting = makeTrip();
    const completedTrip = makeTrip({
      TripEnd: ms("2026-03-13T06:29:56-07:00"),
      ArriveDest: ms("2026-03-13T06:29:56-07:00"),
    });
    const replacementTrip = makeTrip({
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
      TripKey: generateTripKey("CHE", ms("2026-03-13T06:31:00-07:00")),
    });
    const currentPersistedTrip = makeTrip({
      VesselAbbrev: "TAC",
      TripKey: generateTripKey("TAC", ms("2026-03-13T05:00:00-07:00")),
      ScheduleKey: "TAC--2026-03-13--05:15--P52-BBI",
    });
    const currentOverlayTrip = makeTrip({
      VesselAbbrev: "KIT",
      TripKey: generateTripKey("KIT", ms("2026-03-13T05:05:00-07:00")),
      ScheduleKey: "KIT--2026-03-13--05:20--EDM-KIN",
    });
    const currentOverlayEvents: TripEvents = {
      ...defaultEvents,
      didJustLeaveDock: true,
    };

    mock.module("domain/vesselOrchestration/shared", () => ({
      createScheduledSegmentLookupFromSnapshot: () => ({
        getScheduledDepartureEventBySegmentKey: () => null,
        getScheduledDockEventsForSailingDay: () => [],
      }),
    }));
    mock.module("../processTick/defaultProcessVesselTripsDeps", () => ({
      createDefaultProcessVesselTripsDeps: () => ({ mocked: true }),
    }));

    const clockMod = await import("../processTick/computeVesselTripsWithClock");
    const tripsComputeStub = {
      completedHandoffs: [
        {
          existingTrip: completedExisting,
          tripToComplete: completedTrip,
          events: defaultEvents,
          newTripCore: {
            withFinalSchedule: replacementTrip,
            gates: {
              shouldAttemptAtDockPredictions: true,
              shouldAttemptAtSeaPredictions: false,
              didJustLeaveDock: false,
            },
          },
        },
      ],
      current: {
        activeUpserts: [currentPersistedTrip],
        pendingActualMessages: [
          {
            events: defaultEvents,
            tripCore: {
              withFinalSchedule: currentPersistedTrip,
              gates: {
                shouldAttemptAtDockPredictions: false,
                shouldAttemptAtSeaPredictions: true,
                didJustLeaveDock: false,
              },
            },
            vesselAbbrev: "TAC",
            requiresSuccessfulUpsert: true,
          },
          {
            events: currentOverlayEvents,
            tripCore: {
              withFinalSchedule: currentOverlayTrip,
              gates: {
                shouldAttemptAtDockPredictions: false,
                shouldAttemptAtSeaPredictions: false,
                didJustLeaveDock: true,
              },
            },
            vesselAbbrev: "KIT",
            requiresSuccessfulUpsert: false,
          },
        ],
        pendingPredictedMessages: [
          {
            existingTrip: undefined,
            tripCore: {
              withFinalSchedule: currentPersistedTrip,
              gates: {
                shouldAttemptAtDockPredictions: false,
                shouldAttemptAtSeaPredictions: true,
                didJustLeaveDock: false,
              },
            },
            vesselAbbrev: "TAC",
            requiresSuccessfulUpsert: true,
          },
          {
            existingTrip: undefined,
            tripCore: {
              withFinalSchedule: currentOverlayTrip,
              gates: {
                shouldAttemptAtDockPredictions: false,
                shouldAttemptAtSeaPredictions: false,
                didJustLeaveDock: true,
              },
            },
            vesselAbbrev: "KIT",
            requiresSuccessfulUpsert: false,
          },
        ],
        pendingLeaveDockEffects: [],
      },
    };
    const clockSpy = spyOn(clockMod, "computeVesselTripsWithClock");
    clockSpy.mockImplementation(async () => ({
      tickStartedAt: ms("2026-03-13T06:30:00-07:00"),
      tripsCompute: tripsComputeStub,
    }));

    try {
      const { runUpdateVesselTrips } = await import("../runUpdateVesselTrips");
      const result = await runUpdateVesselTrips({
        tickStartedAt: ms("2026-03-13T06:30:00-07:00"),
        vesselLocations: [],
        existingActiveTrips: [],
        scheduleContext: {
          records: [],
        } as never,
      });

      expect(result.completedTrips).toHaveLength(1);
      expect(result.activeTrips).toHaveLength(2);
      expect(result.activeTrips.map((trip) => trip.VesselAbbrev)).toEqual([
        "CHE",
        "TAC",
      ]);
      expect("AtDockDepartCurr" in (result.activeTrips[0] ?? {})).toBe(false);
      expect(result.tripComputations).toHaveLength(3);

      const completedComputation = result.tripComputations.find(
        (computation) => computation.branch === "completed"
      );
      expect(completedComputation?.tripCore.gates).toBeDefined();
      expect(
        completedComputation?.tripCore.gates?.shouldAttemptAtDockPredictions
      ).toBe(true);

      const overlayComputation = result.tripComputations.find(
        (computation) => computation.vesselAbbrev === "KIT"
      );
      expect(overlayComputation?.branch).toBe("current");
      expect(overlayComputation?.activeTrip?.VesselAbbrev).toBe("KIT");
      expect(overlayComputation?.tripCore.gates).toBeDefined();
      expect(overlayComputation?.tripCore.gates?.didJustLeaveDock).toBe(true);
    } finally {
      clockSpy.mockRestore();
    }
  });
});
