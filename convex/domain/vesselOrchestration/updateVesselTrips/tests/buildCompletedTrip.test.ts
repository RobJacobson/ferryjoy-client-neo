import { describe, expect, it } from "bun:test";
import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import { buildTripRowsForPing } from "domain/vesselOrchestration/updateVesselTrips/tripBuilders";
import {
  makeLocation,
  makeScheduledTables,
  makeTrip,
  ms,
} from "../tripFields/tests/testHelpers";

type DetectedTripEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

const completionEvents = (
  overrides: Partial<DetectedTripEvents> = {}
): DetectedTripEvents => ({
  isFirstTrip: false,
  isTripStartReady: true,
  isCompletedTrip: true,
  didJustArriveAtDock: true,
  didJustLeaveDock: false,
  leftDockTime: undefined,
  scheduleKeyChanged: false,
  ...overrides,
});

describe("buildTripRowsForPing completion shaping", () => {
  it("preserves a valid ArriveDest when it occurs after departure", () => {
    const existingTrip = makeTrip({
      StartTime: ms("2026-03-13T04:33:00-07:00"),
      TripStart: ms("2026-03-13T04:33:00-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      ArriveDest: ms("2026-03-13T06:29:45-07:00"),
      AtDock: false,
    });

    const { completedVesselTrip } = buildTripRowsForPing(
      {
        vesselLocation: makeLocation({
          AtDock: true,
          TimeStamp: ms("2026-03-13T06:29:56-07:00"),
        }),
        existingActiveTrip: existingTrip,
        events: completionEvents(),
      },
      makeScheduledTables()
    );

    expect(completedVesselTrip?.StartTime).toBe(existingTrip.StartTime);
    expect(completedVesselTrip?.ArrivedNextActual).toBe(
      ms("2026-03-13T06:29:56-07:00")
    );
    expect(completedVesselTrip?.ArriveDest).toBe(
      ms("2026-03-13T06:29:56-07:00")
    );
    expect(completedVesselTrip?.EndTime).toBe(ms("2026-03-13T06:29:56-07:00"));
    expect(completedVesselTrip?.TripEnd).toBe(ms("2026-03-13T06:29:56-07:00"));
    expect(completedVesselTrip?.AtSeaDuration).toBe(60.3);
  });

  it("keeps ArrivedNextActual undefined when a close is synthetic", () => {
    const existingTrip = makeTrip({
      TripStart: ms("2026-03-13T04:33:00-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      AtDock: false,
    });

    const { completedVesselTrip } = buildTripRowsForPing(
      {
        vesselLocation: makeLocation({
          AtDock: true,
          TimeStamp: ms("2026-03-13T06:29:56-07:00"),
        }),
        existingActiveTrip: existingTrip,
        events: completionEvents({
          didJustArriveAtDock: false,
        }),
      },
      makeScheduledTables()
    );

    expect(completedVesselTrip?.ArrivedNextActual).toBeUndefined();
    expect(completedVesselTrip?.ArriveDest).toBeUndefined();
    expect(completedVesselTrip?.EndTime).toBe(ms("2026-03-13T06:29:56-07:00"));
  });

  it("falls back to TripEnd when ArriveDest predates LeftDock", () => {
    const existingTrip = makeTrip({
      TripStart: ms("2026-03-12T20:32:59-07:00"),
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      ArriveDest: ms("2026-03-13T03:08:47-07:00"),
      AtDock: false,
    });

    const { completedVesselTrip } = buildTripRowsForPing(
      {
        vesselLocation: makeLocation({
          AtDock: true,
          TimeStamp: ms("2026-03-13T06:29:56-07:00"),
        }),
        existingActiveTrip: existingTrip,
        events: completionEvents(),
      },
      makeScheduledTables()
    );

    expect(completedVesselTrip?.ArrivedNextActual).toBe(
      ms("2026-03-13T06:29:56-07:00")
    );
    expect(completedVesselTrip?.ArriveDest).toBe(
      ms("2026-03-13T06:29:56-07:00")
    );
    expect(completedVesselTrip?.AtSeaDuration).toBe(60.3);
    expect(completedVesselTrip?.TotalDuration).toBe(597);
  });

  it("backfills the physical arrival terminal from the completion ping when the trip destination is unknown", () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: undefined,
      LeftDock: ms("2026-03-13T05:29:38-07:00"),
      AtDock: false,
    });

    const { completedVesselTrip } = buildTripRowsForPing(
      {
        vesselLocation: makeLocation({
          DepartingTerminalAbbrev: "ORI",
          ArrivingTerminalAbbrev: "LOP",
          AtDock: true,
          TimeStamp: ms("2026-03-13T06:29:56-07:00"),
        }),
        existingActiveTrip: existingTrip,
        events: completionEvents(),
      },
      makeScheduledTables()
    );

    expect(completedVesselTrip?.ArrivingTerminalAbbrev).toBe("ORI");
    expect(completedVesselTrip?.ArrivedNextActual).toBe(
      ms("2026-03-13T06:29:56-07:00")
    );
    expect(completedVesselTrip?.ArriveDest).toBe(
      ms("2026-03-13T06:29:56-07:00")
    );
  });
});
