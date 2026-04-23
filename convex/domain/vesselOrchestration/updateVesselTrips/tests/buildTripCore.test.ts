import { describe, expect, it, mock } from "bun:test";
import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import { buildTripRowsForPing } from "domain/vesselOrchestration/updateVesselTrips/tripBuilders";
import { resolveTripFieldsForTripRow } from "domain/vesselOrchestration/updateVesselTrips/tripFields";
import { computeTripBatchForPing } from "functions/vesselOrchestrator/actions";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "../tripFields/tests/testHelpers";

type DetectedTripEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

type TripFieldsResolvedHook = NonNullable<
  Parameters<typeof resolveTripFieldsForTripRow>[0]["onTripFieldsResolved"]
>;

const continuingEvents = (
  overrides: Partial<DetectedTripEvents> = {}
): DetectedTripEvents => ({
  isFirstTrip: false,
  isTripStartReady: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  leftDockTime: undefined,
  scheduleKeyChanged: false,
  ...overrides,
});

const buildActiveTrip = ({
  vesselLocation,
  existingActiveTrip,
  events = continuingEvents(),
  scheduleTables = makeScheduledTables(),
}: {
  vesselLocation: Parameters<typeof buildTripRowsForPing>[0]["vesselLocation"];
  existingActiveTrip?: Parameters<
    typeof buildTripRowsForPing
  >[0]["existingActiveTrip"];
  events?: DetectedTripEvents;
  scheduleTables?: Parameters<typeof buildTripRowsForPing>[1];
}) =>
  buildTripRowsForPing(
    {
      vesselLocation,
      existingActiveTrip,
      events,
    },
    scheduleTables
  ).activeVesselTrip;

describe("buildTripRowsForPing", () => {
  it("keeps inferred trip fields stable while WSF remains incomplete", () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });

    const trip = buildActiveTrip({
      vesselLocation: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingActiveTrip: existingTrip,
    });

    expect(trip?.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
    expect(trip?.ScheduledDeparture).toBe(existingTrip.ScheduledDeparture);
    expect(trip?.ScheduleKey).toBe(existingTrip.ScheduleKey);
  });

  it("replaces inferred fields immediately when WSF provides authoritative values", () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
    });

    const trip = buildActiveTrip({
      vesselLocation: makeLocation({
        ArrivingTerminalAbbrev: "SHI",
        ScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
        ScheduleKey: undefined,
      }),
      existingActiveTrip: existingTrip,
      events: continuingEvents({
        scheduleKeyChanged: true,
      }),
    });

    expect(trip?.ArrivingTerminalAbbrev).toBe("SHI");
    expect(trip?.ScheduledDeparture).toBe(ms("2026-03-13T12:30:00-07:00"));
    expect(trip?.ScheduleKey).toBe("CHE--2026-03-13--12:30--CLI-SHI");
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

    const tripRows = buildTripRowsForPing(
      {
        vesselLocation: makeLocation({
          DepartingTerminalAbbrev: "MUK",
          DepartingTerminalName: "Mukilteo",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
        }),
        existingActiveTrip: completedTrip,
        events: continuingEvents({
          isCompletedTrip: true,
          didJustArriveAtDock: true,
          scheduleKeyChanged: true,
        }),
      },
      makeScheduledTables({
        segments: [nextSegment],
      })
    );

    expect(tripRows.activeVesselTrip?.ArrivingTerminalAbbrev).toBe("CLI");
    expect(tripRows.activeVesselTrip?.ScheduledDeparture).toBe(
      nextSegment.DepartingTime
    );
    expect(tripRows.activeVesselTrip?.ScheduleKey).toBe(nextSegment.Key);
    expect(tripRows.activeVesselTrip?.NextScheduleKey).toBe(
      nextSegment.NextKey
    );
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

    const trip = buildActiveTrip({
      vesselLocation: makeLocation({
        AtDock: true,
        LeftDock: existingTrip.LeftDock,
        DepartingTerminalAbbrev: "MUK",
        DepartingTerminalName: "Mukilteo",
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        TimeStamp: ms("2026-03-13T11:28:00-07:00"),
      }),
      existingActiveTrip: existingTrip,
      events: continuingEvents({
        didJustArriveAtDock: true,
      }),
      scheduleTables: makeScheduledTables({
        segments: [segment],
      }),
    });

    expect(trip?.ArrivingTerminalAbbrev).toBe("CLI");
    expect(trip?.ScheduledDeparture).toBe(segment.DepartingTime);
    expect(trip?.ScheduleKey).toBe(segment.Key);
    expect(trip?.ArriveDest).toBe(ms("2026-03-13T11:28:00-07:00"));
  });

  it("keeps tripFieldInferenceMethod transient while still exposing it to observability hooks", () => {
    const onTripFieldsResolved = mock<TripFieldsResolvedHook>(() => {});
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const trip = resolveTripFieldsForTripRow({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
      }),
      scheduleTables: makeScheduledTables({
        segments: [nextSegment],
      }),
      buildTrip: (resolvedCurrentTripFields) =>
        makeTrip({
          ArrivingTerminalAbbrev:
            resolvedCurrentTripFields.ArrivingTerminalAbbrev,
          ScheduledDeparture: resolvedCurrentTripFields.ScheduledDeparture,
          ScheduleKey: resolvedCurrentTripFields.ScheduleKey,
          SailingDay: resolvedCurrentTripFields.SailingDay,
          NextScheduleKey: undefined,
          NextScheduledDeparture: undefined,
        }),
      onTripFieldsResolved,
    });

    expect(onTripFieldsResolved).toHaveBeenCalledTimes(1);
    expect(
      onTripFieldsResolved.mock.calls[0]?.[0]?.resolvedCurrentTripFields
    ).toMatchObject({
      tripFieldDataSource: "inferred",
      tripFieldInferenceMethod: "next_scheduled_trip",
      ScheduleKey: nextSegment.Key,
    });
    expect("tripFieldInferenceMethod" in trip).toBe(false);
  });

  it("persists inferred SailingDay as part of the resolved trip-field contract", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      SailingDay: "2026-03-14",
      DepartingTime: ms("2026-03-14T01:30:00-07:00"),
    });

    const trip = buildActiveTrip({
      vesselLocation: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingActiveTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
      }),
      scheduleTables: makeScheduledTables({
        segments: [nextSegment],
      }),
    });

    expect(trip?.ScheduleKey).toBe(nextSegment.Key);
    expect(trip?.SailingDay).toBe(nextSegment.SailingDay);
  });

  it("handles provisional inference, authoritative WSF takeover, and then skips an unchanged ping", () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--CLI-MUK",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });
    const scheduleTables = makeScheduledTables({
      segments: [nextSegment],
    });
    const existingTrip = makeTrip({
      AtDock: true,
      LeftDock: undefined,
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: nextSegment.Key,
      NextScheduledDeparture: nextSegment.DepartingTime,
    });

    const inferredTrip = buildActiveTrip({
      vesselLocation: makeLocation({
        AtDock: true,
        LeftDock: undefined,
        DepartingTerminalAbbrev: "MUK",
        DepartingTerminalName: "Mukilteo",
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        TimeStamp: ms("2026-03-13T12:00:00-07:00"),
      }),
      existingActiveTrip: existingTrip,
      scheduleTables,
    });

    const authoritativeTrip = buildActiveTrip({
      vesselLocation: makeLocation({
        AtDock: true,
        LeftDock: undefined,
        DepartingTerminalAbbrev: "MUK",
        DepartingTerminalName: "Mukilteo",
        ArrivingTerminalAbbrev: "CLI",
        ScheduledDeparture: nextSegment.DepartingTime,
        ScheduleKey: undefined,
        TimeStamp: ms("2026-03-13T12:01:00-07:00"),
      }),
      existingActiveTrip: inferredTrip,
      scheduleTables,
      events: continuingEvents({
        scheduleKeyChanged: true,
      }),
    });

    expect(authoritativeTrip?.ArrivingTerminalAbbrev).toBe("CLI");
    expect(authoritativeTrip?.ScheduledDeparture).toBe(
      nextSegment.DepartingTime
    );
    expect(authoritativeTrip?.ScheduleKey).toBe(nextSegment.Key);

    const tripBatch = computeTripBatchForPing(
      [
        {
          vesselLocation: makeLocation({
            VesselAbbrev: "CHE",
            AtDock: true,
            LeftDock: undefined,
            DepartingTerminalAbbrev: "MUK",
            DepartingTerminalName: "Mukilteo",
            ArrivingTerminalAbbrev: "CLI",
            ScheduledDeparture: nextSegment.DepartingTime,
            ScheduleKey: undefined,
            TimeStamp: ms("2026-03-13T12:01:00-07:00"),
          }),
          locationChanged: false,
        },
      ],
      authoritativeTrip ? [authoritativeTrip] : [],
      {
        SailingDay: "2026-03-13",
        scheduledDepartureBySegmentKey: {},
        scheduledDeparturesByVesselAbbrev: {},
      },
      "2026-03-13"
    );

    expect(tripBatch.updates).toEqual([]);
    expect(tripBatch.rows.activeTrips).toEqual(
      authoritativeTrip ? [authoritativeTrip] : []
    );
    expect(tripBatch.rows.completedTrips).toEqual([]);
  });
});
