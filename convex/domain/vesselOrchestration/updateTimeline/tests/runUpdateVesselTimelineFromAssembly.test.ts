import { describe, expect, it } from "bun:test";
import type { RunUpdateVesselTimelineFromAssemblyInput } from "domain/vesselOrchestration/updateTimeline";
import { runUpdateVesselTimelineFromAssembly } from "domain/vesselOrchestration/updateTimeline";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

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

describe("runUpdateVesselTimelineFromAssembly", () => {
  it("applies successful-upsert gating for current-branch messages", () => {
    const currentTrip = makeTrip("TAC", {
      AtDock: false,
      LeftDockActual: ms("2026-03-13T06:40:00-07:00"),
      TimeStamp: ms("2026-03-13T06:40:00-07:00"),
    });
    const input: RunUpdateVesselTimelineFromAssemblyInput = {
      pingStartedAt: ms("2026-03-13T06:40:10-07:00"),
      projectionAssembly: {
        completedFacts: [],
        currentBranch: {
          successfulVessels: new Set<string>(),
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
              scheduleTrip: currentTrip,
              vesselAbbrev: "TAC",
              requiresSuccessfulUpsert: true,
            },
          ],
          pendingPredictedMessages: [],
        },
      },
      predictedTripComputations: [],
    };

    const out = runUpdateVesselTimelineFromAssembly(input);
    expect(out.actualEvents).toHaveLength(0);
    expect(out.predictedEvents).toHaveLength(0);
  });
});
