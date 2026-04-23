import { describe, expect, it, mock } from "bun:test";
import {
  getTripFieldInferenceLogContext,
  logTripFieldInference,
  type TripFieldInferenceLogContext,
} from "../logTripFieldInference";
import { makeLocation, makeTrip, ms } from "./testHelpers";

describe("logTripFieldInference", () => {
  it("logs when provisional trip fields first start from schedule evidence", () => {
    const context = getTripFieldInferenceLogContext({
      location: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingTrip: undefined,
      resolvedCurrentTripFields: {
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        tripFieldDataSource: "inferred",
        tripFieldInferenceMethod: "next_scheduled_trip",
      },
    });

    expect(context).toMatchObject({
      reason: "inferred_trip_fields_started",
      tripFieldDataSource: "inferred",
      tripFieldInferenceMethod: "next_scheduled_trip",
    });
  });

  it("does not log unchanged provisional trip-field reuse", () => {
    const context = getTripFieldInferenceLogContext({
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
      resolvedCurrentTripFields: {
        ArrivingTerminalAbbrev: "MUK",
        ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
        ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        tripFieldDataSource: "inferred",
        tripFieldInferenceMethod: "next_scheduled_trip",
      },
    });

    expect(context).toBeUndefined();
  });

  it("logs partial WSF conflicts against inferred trip fields", () => {
    const context = getTripFieldInferenceLogContext({
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
        tripFieldDataSource: "inferred",
        tripFieldInferenceMethod: "schedule_rollover",
      },
    });

    expect(context?.reason).toBe("partial_wsf_conflict_with_inference");
  });

  it("logs when WSF authoritative fields replace prior trip fields", () => {
    const logger = mock<
      (message: string, context: TripFieldInferenceLogContext) => void
    >(() => {});

    logTripFieldInference(
      {
        location: makeLocation({
          ArrivingTerminalAbbrev: "SHI",
          ScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
          ScheduleKey: undefined,
        }),
        existingTrip: makeTrip({
          ArrivingTerminalAbbrev: "MUK",
          ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
          ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        }),
        resolvedCurrentTripFields: {
          ArrivingTerminalAbbrev: "SHI",
          ScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
          ScheduleKey: "CHE--2026-03-13--12:30--CLI-SHI",
          tripFieldDataSource: "wsf",
        },
      },
      logger
    );

    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0]?.[0]).toContain("applied authoritative WSF");
    expect(logger.mock.calls[0]?.[1]).toMatchObject({
      reason: "wsf_trip_fields_replaced_prior_values",
      tripFieldDataSource: "wsf",
    });
  });

  it("does not log unchanged WSF trip fields", () => {
    const logger = mock<
      (message: string, context: TripFieldInferenceLogContext) => void
    >(() => {});

    logTripFieldInference(
      {
        location: makeLocation(),
        existingTrip: makeTrip(),
        resolvedCurrentTripFields: {
          ArrivingTerminalAbbrev: "MUK",
          ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
          ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
          tripFieldDataSource: "wsf",
        },
      },
      logger
    );

    expect(logger).not.toHaveBeenCalled();
  });

  it("does not log when WSF is authoritative on an initial trip with no prior fields", () => {
    const logger = mock<
      (message: string, context: TripFieldInferenceLogContext) => void
    >(() => {});

    logTripFieldInference(
      {
        location: makeLocation({
          ArrivingTerminalAbbrev: "MUK",
          ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
          ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
        }),
        existingTrip: undefined,
        resolvedCurrentTripFields: {
          ArrivingTerminalAbbrev: "MUK",
          ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
          ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
          tripFieldDataSource: "wsf",
        },
      },
      logger
    );

    expect(logger).not.toHaveBeenCalled();
  });

  it("does not log when WSF remains authoritative but only ScheduleKey is backfilled", () => {
    const logger = mock<
      (message: string, context: TripFieldInferenceLogContext) => void
    >(() => {});

    logTripFieldInference(
      {
        location: makeLocation({
          ArrivingTerminalAbbrev: "MUK",
          ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
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
          tripFieldDataSource: "wsf",
        },
      },
      logger
    );

    expect(logger).not.toHaveBeenCalled();
  });
});
