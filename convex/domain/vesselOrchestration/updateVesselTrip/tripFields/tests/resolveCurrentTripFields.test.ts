import { describe, expect, it, mock } from "bun:test";
import { getTripFieldInferenceLog, resolveTripFieldsForTripRow } from "..";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTrip,
  ms,
} from "./testHelpers";

type TripFieldsResolvedHook = NonNullable<
  Parameters<typeof resolveTripFieldsForTripRow>[0]["onTripFieldsResolved"]
>;

const buildTripFromResolvedFields = (
  input: Omit<Parameters<typeof resolveTripFieldsForTripRow>[0], "buildTrip">
) =>
  resolveTripFieldsForTripRow({
    ...input,
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
  });

describe("resolveTripFieldsForTripRow", () => {
  it("prefers next scheduled segment over rollover when both are available", async () => {
    const onTripFieldsResolved = mock<TripFieldsResolvedHook>(() => {});
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });
    const rolloverSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--13:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T13:30:00-07:00"),
    });

    const trip = await buildTripFromResolvedFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        DepartingTerminalAbbrev: "CLI",
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      scheduleAccess: makeScheduledTables({
        segments: [nextSegment, rolloverSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${rolloverSegment.Key}--dep-dock`,
              VesselAbbrev: "CHE",
              SailingDay: "2026-03-13",
              UpdatedAt: 1,
              ScheduledDeparture: rolloverSegment.DepartingTime,
              TerminalAbbrev: "CLI",
              NextTerminalAbbrev: "MUK",
              EventType: "dep-dock",
            },
          ],
        },
      }),
      onTripFieldsResolved,
    });

    expect(trip.ScheduleKey).toBe(nextSegment.Key);
    expect(
      onTripFieldsResolved.mock.calls[0]?.[0]?.resolvedCurrentTripFields
        .tripFieldInferenceMethod
    ).toBe("next_scheduled_trip");
  });

  it("treats direct WSF trip fields as authoritative even when ScheduleKey is derived locally", async () => {
    const onTripFieldsResolved = mock<TripFieldsResolvedHook>(() => {});

    const trip = await buildTripFromResolvedFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: "CHE--2026-03-13--12:30--CLI-MUK",
      }),
      scheduleAccess: makeScheduledTables(),
      onTripFieldsResolved,
    });

    expect(trip.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
    expect(
      onTripFieldsResolved.mock.calls[0]?.[0]?.resolvedCurrentTripFields
        .tripFieldDataSource
    ).toBe("wsf");
    expect(
      onTripFieldsResolved.mock.calls[0]?.[0]?.resolvedCurrentTripFields
        .tripFieldInferenceMethod
    ).toBeUndefined();
  });

  it("infers trip fields from the next scheduled trip when WSF is incomplete", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--MUK-CLI",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });

    const trip = await buildTripFromResolvedFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: nextSegment.Key,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      scheduleAccess: makeScheduledTables({
        segments: [nextSegment],
      }),
    });

    expect(trip.ScheduleKey).toBe(nextSegment.Key);
    expect(trip.NextScheduleKey).toBe(nextSegment.NextKey);
    expect(trip.NextScheduledDeparture).toBe(nextSegment.NextDepartingTime);
  });

  it("infers trip fields by schedule rollover when the next scheduled trip is unavailable", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const trip = await buildTripFromResolvedFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        NextScheduleKey: undefined,
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
      }),
      scheduleAccess: makeScheduledTables({
        segments: [nextSegment],
        scheduledDeparturesByVesselAbbrev: {
          CHE: [
            {
              Key: `${nextSegment.Key}--dep-dock`,
              VesselAbbrev: "CHE",
              SailingDay: "2026-03-13",
              UpdatedAt: 1,
              ScheduledDeparture: nextSegment.DepartingTime,
              TerminalAbbrev: "CLI",
              NextTerminalAbbrev: "MUK",
              EventType: "dep-dock",
            },
          ],
        },
      }),
    });

    expect(trip.ScheduleKey).toBe(nextSegment.Key);
    expect(trip.ArrivingTerminalAbbrev).toBe(
      nextSegment.ArrivingTerminalAbbrev
    );
  });

  it("falls back cleanly when no schedule match exists", async () => {
    const trip = await buildTripFromResolvedFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      }),
      scheduleAccess: makeScheduledTables(),
    });

    expect(trip.ArrivingTerminalAbbrev).toBe("MUK");
    expect(trip.ScheduledDeparture).toBe(ms("2026-03-13T11:00:00-07:00"));
    expect(trip.ScheduleKey).toBe("CHE--2026-03-13--11:00--CLI-MUK");
  });

  it("preserves carried next scheduled trip fields when the segment is unchanged", async () => {
    const existingTrip = makeTrip({
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });

    const trip = await buildTripFromResolvedFields({
      location: makeLocation(),
      existingTrip,
      scheduleAccess: makeScheduledTables(),
    });

    expect(trip.NextScheduleKey).toBe(existingTrip.NextScheduleKey);
    expect(trip.NextScheduledDeparture).toBe(
      existingTrip.NextScheduledDeparture
    );
  });

  it("logs partial WSF conflicts against inferred trip fields through the resolved hook", async () => {
    const onTripFieldsResolved = mock<TripFieldsResolvedHook>(() => {});

    await buildTripFromResolvedFields({
      location: makeLocation({
        ArrivingTerminalAbbrev: "SHI",
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      }),
      scheduleAccess: makeScheduledTables(),
      onTripFieldsResolved,
    });

    expect(
      onTripFieldsResolved.mock.calls[0]?.[0]?.resolvedCurrentTripFields
        .tripFieldDataSource
    ).toBe("inferred");
  });

  it("builds inference diagnostics only when a caller explicitly requests them", async () => {
    const inferenceInput = {
      location: makeLocation({
        ArrivingTerminalAbbrev: "SHI",
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: makeTrip({
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      }),
      resolvedCurrentTripFields: {
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        SailingDay: "2026-03-13",
        tripFieldDataSource: "inferred" as const,
        tripFieldInferenceMethod: "next_scheduled_trip" as const,
      },
    };

    expect(getTripFieldInferenceLog(inferenceInput)).toMatchObject({
      message:
        "[TripFields] CHE kept provisional trip fields despite partial WSF conflict",
      context: {
        vesselAbbrev: "CHE",
        reason: "partial_wsf_conflict_with_inference",
        tripFieldDataSource: "inferred",
        tripFieldInferenceMethod: "next_scheduled_trip",
      },
    });
  });
});
