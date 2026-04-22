import { describe, expect, it } from "bun:test";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "../tripFields/tests/testHelpers";

const continuingEvents = (
  overrides: Partial<TripEvents> = {}
): TripEvents => ({
  isFirstTrip: false,
  isTripStartReady: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
  ...overrides,
});

describe("buildTripCore", () => {
  it("keeps inferred trip fields stable while WSF remains incomplete", () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });

    const trip = buildTripCore(
      makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip,
      false,
      continuingEvents(),
      makeScheduledTables()
    );

    expect(trip.ArrivingTerminalAbbrev).toBe(existingTrip.ArrivingTerminalAbbrev);
    expect(trip.ScheduledDeparture).toBe(existingTrip.ScheduledDeparture);
    expect(trip.ScheduleKey).toBe(existingTrip.ScheduleKey);
  });

  it("replaces inferred fields immediately when WSF provides authoritative values", () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
    });

    const trip = buildTripCore(
      makeLocation({
        ArrivingTerminalAbbrev: "SHI",
        ScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
        ScheduleKey: undefined,
      }),
      existingTrip,
      false,
      continuingEvents({
        scheduleKeyChanged: true,
      }),
      makeScheduledTables()
    );

    expect(trip.ArrivingTerminalAbbrev).toBe("SHI");
    expect(trip.ScheduledDeparture).toBe(ms("2026-03-13T12:30:00-07:00"));
    expect(trip.ScheduleKey).toBe("CHE--2026-03-13--12:30--CLI-SHI");
  });

  it("starts the replacement trip with inferred fields after a completed arrival", () => {
    const completedTrip = makeTrip({
      AtDock: true,
      LeftDock: ms("2026-03-13T10:00:00-07:00"),
      LeftDockActual: ms("2026-03-13T10:00:00-07:00"),
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--CLI-MUK",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });

    const trip = buildTripCore(
      makeLocation({
        DepartingTerminalAbbrev: "MUK",
        DepartingTerminalName: "Mukilteo",
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      completedTrip,
      true,
      continuingEvents({
        didJustArriveAtDock: true,
        scheduleKeyChanged: true,
      }),
      makeScheduledTables({
        segments: [nextSegment],
      })
    );

    expect(trip.ArrivingTerminalAbbrev).toBe("CLI");
    expect(trip.ScheduledDeparture).toBe(nextSegment.DepartingTime);
    expect(trip.ScheduleKey).toBe(nextSegment.Key);
    expect(trip.NextScheduleKey).toBe(nextSegment.NextKey);
  });

  it("keeps physical arrival behavior while trip fields are inferred", () => {
    const existingTrip = makeTrip({
      AtDock: false,
      LeftDock: ms("2026-03-13T11:02:00-07:00"),
      LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
      ArriveDest: undefined,
      EndTime: undefined,
      StartTime: ms("2026-03-13T10:30:00-07:00"),
      TripStart: ms("2026-03-13T10:30:00-07:00"),
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: "MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });
    const segment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const trip = buildTripCore(
      makeLocation({
        AtDock: true,
        LeftDock: existingTrip.LeftDock,
        DepartingTerminalAbbrev: "MUK",
        DepartingTerminalName: "Mukilteo",
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        TimeStamp: ms("2026-03-13T11:28:00-07:00"),
      }),
      existingTrip,
      false,
      continuingEvents({
        didJustArriveAtDock: true,
      }),
      makeScheduledTables({
        segments: [segment],
      })
    );

    expect(trip.ArrivingTerminalAbbrev).toBe("CLI");
    expect(trip.ScheduledDeparture).toBe(segment.DepartingTime);
    expect(trip.ScheduleKey).toBe(segment.Key);
    expect(trip.ArriveDest).toBe(ms("2026-03-13T11:28:00-07:00"));
  });
});
