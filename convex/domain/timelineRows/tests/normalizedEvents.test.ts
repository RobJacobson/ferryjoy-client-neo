/**
 * Covers normalized boundary-event derivation helpers.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/schemas";
import type { ConvexVesselTripWithPredictions } from "../../../functions/vesselTrips/schemas";
import { buildPhysicalActualEventKey } from "../../../shared/physicalTripIdentity";
import {
  buildActualDockEventFromWrite,
  buildActualDockEvents,
  buildPredictedDockClearBatch,
  buildPredictedDockWriteBatch,
  buildScheduledDockEvents,
  type TripContextForActualRow,
} from "..";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

describe("buildScheduledDockEvents", () => {
  it("marks only the final arrival of the sailing day", () => {
    const rows = buildScheduledDockEvents(
      [
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          EventScheduledTime: at(12, 20),
        }),
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          EventScheduledTime: at(12, 55),
        }),
        makeBoundaryEventRecord({
          SegmentKey: "trip-2",
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(13, 30),
        }),
        makeBoundaryEventRecord({
          SegmentKey: "trip-2",
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(14, 5),
        }),
      ],
      at(15, 0)
    );

    expect(
      rows.map((row) => [row.Key, row.IsLastArrivalOfSailingDay ?? false])
    ).toEqual([
      ["trip-1--dep-dock", false],
      ["trip-1--arv-dock", false],
      ["trip-2--dep-dock", false],
      ["trip-2--arv-dock", true],
    ]);
  });
});

describe("buildActualDockEvents", () => {
  const tripMap = (): Map<string, TripContextForActualRow> => {
    const tripKey = "WEN 2026-03-25 19:20:00Z";
    return new Map([["trip-1", { TripKey: tripKey, ScheduleKey: "trip-1" }]]);
  };

  it("keeps occurrence-only rows without inventing an actual time", () => {
    const tk = "WEN 2026-03-25 19:20:00Z";
    const rows = buildActualDockEvents(
      [
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          EventOccurred: true,
          EventActualTime: undefined,
        }),
      ],
      at(15, 0),
      tripMap()
    );

    expect(rows).toEqual([
      expect.objectContaining({
        EventKey: buildPhysicalActualEventKey(tk, "dep-dock"),
        TripKey: tk,
        ScheduleKey: "trip-1",
        EventType: "dep-dock",
        EventOccurred: true,
        EventActualTime: undefined,
      }),
    ]);
  });

  it("normalizes exact actual times as confirmed occurrence", () => {
    const tk = "WEN 2026-03-25 19:20:00Z";
    const [row] = buildActualDockEvents(
      [
        makeBoundaryEventRecord({
          SegmentKey: "trip-1",
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          EventOccurred: undefined,
          EventActualTime: at(12, 24),
        }),
      ],
      at(15, 0),
      tripMap()
    );

    expect(row).toMatchObject({
      EventKey: buildPhysicalActualEventKey(tk, "dep-dock"),
      EventOccurred: true,
      EventActualTime: at(12, 24),
    });
  });
});

describe("buildActualDockEventFromWrite", () => {
  it("derives SailingDay and ScheduledDeparture from EventActualTime when omitted", () => {
    const row = buildActualDockEventFromWrite(
      {
        TripKey: "WEN 2026-03-25 19:20:00Z",
        VesselAbbrev: "WEN",
        TerminalAbbrev: "BBI",
        EventType: "dep-dock",
        EventOccurred: true,
        EventActualTime: at(12, 22),
      },
      at(15, 0)
    );

    expect(row.SailingDay).toBe("2026-03-25");
    expect(row.ScheduledDeparture).toBe(at(12, 22));
  });
});

describe("buildPredictedDockWriteBatch", () => {
  it("carries the full prediction key scope even when only one row is emitted", () => {
    const effect = buildPredictedDockWriteBatch(
      makeTrip({
        AtDockDepartCurr: makePrediction(at(12, 24)),
      })
    );

    expect(effect?.TargetKeys).toEqual([
      "trip-key--dep-dock",
      "trip-key--arv-dock",
      "next-trip-key--dep-dock",
    ]);
    expect(effect?.Rows.map((row) => row.Key)).toEqual(["trip-key--dep-dock"]);
  });

  it("emits WSF ETA and ML arrival rows together on the current arrival boundary", () => {
    const effect = buildPredictedDockWriteBatch(
      makeTrip({
        ScheduledDeparture: at(12, 20),
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        Eta: at(12, 57),
        AtDockArriveNext: makePrediction(at(12, 59)),
        AtSeaArriveNext: makePrediction(at(12, 58)),
      })
    );

    const arrivalRows = effect?.Rows.filter(
      (row) => row.Key === "trip-key--arv-dock"
    );

    expect(arrivalRows).toHaveLength(3);
    expect(
      arrivalRows?.find((row) => row.PredictionSource === "wsf_eta")
        ?.EventPredictedTime
    ).toBe(at(12, 57));
    expect(
      arrivalRows?.filter((row) => row.PredictionSource === "ml")
    ).toHaveLength(2);
  });

  it("emits an empty row set when a trip still owns prediction keys but has no predictions", () => {
    const effect = buildPredictedDockWriteBatch(makeTrip({}));

    expect(effect?.TargetKeys).toEqual([
      "trip-key--dep-dock",
      "trip-key--arv-dock",
      "next-trip-key--dep-dock",
    ]);
    expect(effect?.Rows).toEqual([]);
  });
});

describe("buildPredictedDockClearBatch", () => {
  it("builds a clear-only effect for the trip's full prediction scope", () => {
    const effect = buildPredictedDockClearBatch(makeTrip({}));

    expect(effect).toEqual({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      TargetKeys: [
        "trip-key--dep-dock",
        "trip-key--arv-dock",
        "next-trip-key--dep-dock",
      ],
      Rows: [],
    });
  });
});

const makePrediction = (PredTime: number) => ({
  PredTime,
  MinTime: PredTime - 60_000,
  MaxTime: PredTime + 60_000,
  MAE: 1,
  StdDev: 1,
  Actual: undefined,
  DeltaTotal: undefined,
  DeltaRange: undefined,
});

const makeBoundaryEventRecord = (
  overrides: Partial<ConvexVesselTimelineEventRecord>
): ConvexVesselTimelineEventRecord => ({
  SegmentKey: "trip-1",
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  ScheduledDeparture: at(12, 20),
  TerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: at(12, 20),
  EventOccurred: undefined,
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTripWithPredictions>
): ConvexVesselTripWithPredictions => ({
  VesselAbbrev: "WEN",
  DepartingTerminalAbbrev: "BBI",
  ArrivingTerminalAbbrev: "P52",
  RouteAbbrev: "SEA-BBI",
  TripKey: "WEN 2026-03-25 12:00:00Z",
  ScheduleKey: "trip-key",
  SailingDay: "2026-03-25",
  PrevTerminalAbbrev: "P52",
  ArriveDest: undefined,
  TripStart: at(12, 0),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: at(12, 20),
  LeftDock: at(12, 22),
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: at(12, 30),
  PrevScheduledDeparture: at(11, 10),
  PrevLeftDock: at(11, 12),
  NextScheduleKey: "next-trip-key",
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
