import { describe, expect, it } from "bun:test";
import type { VesselTripPersistResult } from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { assembleTripComputationsFromPersistResult } from "../assembleTripComputationsFromPersistResult";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: vesselAbbrev,
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
  ArrivedCurrActual: ms("2026-03-13T04:33:00-07:00"),
  ArrivedNextActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  EndTime: undefined,
  StartTime: ms("2026-03-13T04:33:00-07:00"),
  AtDockActual: ms("2026-03-13T04:33:00-07:00"),
  ...overrides,
});

describe("assembleTripComputationsFromPersistResult", () => {
  it("merges completed and current branch rows into timeline computations", () => {
    const completedTrip = makeTrip("CHE", {
      TripEnd: ms("2026-03-13T06:45:00-07:00"),
      ArrivedNextActual: ms("2026-03-13T06:45:00-07:00"),
    });
    const replacementTrip = makeTrip("CHE", {
      TripKey: generateTripKey("CHE", ms("2026-03-13T06:46:00-07:00")),
      DepartingTerminalAbbrev: "ORI",
      ArrivingTerminalAbbrev: "LOP",
      ScheduleKey: "CHE--2026-03-13--06:50--ORI-LOP",
    });
    const tacActive = makeTrip("TAC", {
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });

    const persistResult: VesselTripPersistResult = {
      completedFacts: [
        {
          existingTrip: makeTrip("CHE"),
          tripToComplete: completedTrip,
          events: {
            isFirstTrip: false,
            isTripStartReady: true,
            isCompletedTrip: true,
            didJustArriveAtDock: true,
            didJustLeaveDock: false,
            scheduleKeyChanged: false,
          },
          scheduleTrip: replacementTrip,
        },
      ],
      currentBranch: {
        successfulVessels: new Set(["TAC"]),
        pendingActualMessages: [
          {
            events: {
              isFirstTrip: false,
              isTripStartReady: true,
              isCompletedTrip: false,
              didJustArriveAtDock: false,
              didJustLeaveDock: true,
              scheduleKeyChanged: false,
            },
            scheduleTrip: tacActive,
            vesselAbbrev: "TAC",
            requiresSuccessfulUpsert: true,
          },
        ],
        pendingPredictedMessages: [
          {
            existingTrip: makeTrip("TAC"),
            scheduleTrip: tacActive,
            vesselAbbrev: "TAC",
            requiresSuccessfulUpsert: true,
          },
        ],
      },
    };

    const out = assembleTripComputationsFromPersistResult(
      {
        completedTrips: [completedTrip],
        activeTrips: [replacementTrip, tacActive],
      },
      persistResult
    );

    expect(out.find((row) => row.branch === "completed")?.vesselAbbrev).toBe(
      "CHE"
    );
    const tacCurrent = out.find(
      (row) => row.branch === "current" && row.vesselAbbrev === "TAC"
    );
    expect(tacCurrent).toBeDefined();
    expect(tacCurrent?.activeTrip.VesselAbbrev).toBe("TAC");
  });
});

