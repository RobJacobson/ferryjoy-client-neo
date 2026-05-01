import { describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as vesselPredictions from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { loadPredictionContext } from "../actions/ping/updateVesselPredictions";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T09:00:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--09:30--ANA-ORI",
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
  NextScheduleKey: "CHE--2026-03-13--10:15--ORI-ANA",
  NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
  ...overrides,
});

describe("prediction stage off-ramp policy", () => {
  it("skips prediction model context query when there are no preload requests", async () => {
    const requestSpy = spyOn(
      vesselPredictions,
      "predictionModelLoadRequestForTripUpdate"
    ).mockReturnValue(null);
    const runQuery = mock(async () => ({}));
    const ctx = { runQuery } as unknown as ActionCtx;
    const tripUpdate = {
      vesselAbbrev: "CHE",
      existingActiveTrip: undefined,
      activeVesselTripUpdate: makeTrip(),
      completedVesselTripUpdate: undefined,
    };

    const predictionContext = await loadPredictionContext(ctx, tripUpdate);
    expect(predictionContext).toEqual({});
    expect(runQuery).toHaveBeenCalledTimes(0);
    requestSpy.mockRestore();
  });
});
