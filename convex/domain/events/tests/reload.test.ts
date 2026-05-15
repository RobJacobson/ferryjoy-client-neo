/**
 * Tests for scheduled and actual dock-event reload assembly.
 *
 * Exercises pure boundary context resolution, seam handling, scheduled-row
 * projection, and actual-row synthesis from history, trip fields, and current
 * tracking data. Helpers build small WSF-shaped fixtures so cases stay focused
 * on reload behavior instead of adapter details.
 */

import { describe, expect, it } from "bun:test";
import {
  buildActualRows,
  buildReloadBoundaryContext,
  buildScheduledRows,
} from "domain/events/reload";
import type {
  WsfScheduledSegment,
  WsfVesselHistory,
} from "domain/events/reload/schemas";
import type {
  ReloadScheduledBoundary,
  ReloadTripForActuals,
} from "domain/events/reload/types";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { buildSegmentKey } from "shared/keys";

const at = (hours: number, minutes: number): number =>
  Date.UTC(2026, 2, 25, hours, minutes);

const vessels: VesselIdentity[] = [
  {
    VesselID: 1,
    VesselName: "Wenatchee",
    VesselAbbrev: "WEN",
  },
  {
    VesselID: 2,
    VesselName: "Tacoma",
    VesselAbbrev: "TAC",
  },
];

const terminals: TerminalIdentity[] = [
  {
    TerminalID: 1,
    TerminalName: "Seattle",
    TerminalAbbrev: "P52",
  },
  {
    TerminalID: 2,
    TerminalName: "Bainbridge Island",
    TerminalAbbrev: "BBI",
  },
];

describe("reload dock sailing day rows from schedule and history", () => {
  it("projects scheduled rows from the shared boundary context", () => {
    const departure = at(8, 20);
    const arrival = at(8, 55);
    const scheduledSegments = [scheduleSegment({ departure, arrival })];

    const boundaryContext = buildReloadBoundaryContext({
      scheduleSegments: scheduledSegments,
      vessels,
      terminals,
    });
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: scheduledSegments,
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(buildScheduledRows(boundaryContext.boundaryEvents, 42)).toEqual(
      result.scheduledRows
    );
  });

  it("copies next terminal from boundary records without arrival lookup", () => {
    const boundaryEvent: ReloadScheduledBoundary = {
      SegmentKey: "segment-without-arrival",
      Key: "segment-without-arrival--dep-dock",
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      ScheduledDeparture: at(8, 0),
      TerminalAbbrev: "P52",
      NextTerminalAbbrev: "BBI",
      EventType: "dep-dock",
      EventScheduledTime: at(8, 0),
    };

    expect(buildScheduledRows([boundaryEvent], 42)).toEqual([
      {
        Key: "segment-without-arrival--dep-dock",
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        UpdatedAt: 42,
        ScheduledDeparture: at(8, 0),
        TerminalAbbrev: "P52",
        NextTerminalAbbrev: "BBI",
        EventType: "dep-dock",
        EventScheduledTime: at(8, 0),
        IsLastArrivalOfSailingDay: false,
      },
    ]);
  });

  it("applies minimum same-terminal turnaround to the arrival side", () => {
    const firstDeparture = at(9, 0);
    const sharedSeamTime = at(9, 35);
    const secondArrival = at(10, 10);
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [
        scheduleSegment({
          departure: firstDeparture,
          arrival: sharedSeamTime,
        }),
        scheduleSegment({
          departure: sharedSeamTime,
          arrival: secondArrival,
          departingTerminalID: 2,
          departingTerminalName: "Bainbridge Island",
          arrivingTerminalID: 1,
          arrivingTerminalName: "Seattle",
        }),
      ],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(
      result.scheduledRows.map((row) => [
        row.EventType,
        row.TerminalAbbrev,
        row.EventScheduledTime,
      ])
    ).toEqual([
      ["dep-dock", "P52", firstDeparture],
      ["arv-dock", "BBI", sharedSeamTime - 5 * 60 * 1000],
      ["dep-dock", "BBI", sharedSeamTime],
      ["arv-dock", "P52", secondArrival],
    ]);
  });

  it("marks the final arrival for each vessel sailing day", () => {
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [
        scheduleSegment({
          departure: at(8, 0),
          arrival: at(8, 35),
        }),
        scheduleSegment({
          departure: at(9, 0),
          arrival: at(9, 35),
          departingTerminalID: 2,
          departingTerminalName: "Bainbridge Island",
          arrivingTerminalID: 1,
          arrivingTerminalName: "Seattle",
        }),
        scheduleSegment({
          vesselName: "Tacoma",
          departure: at(8, 15),
          arrival: at(8, 50),
        }),
      ],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(
      result.scheduledRows
        .filter((row) => row.EventType === "arv-dock")
        .map((row) => [
          row.VesselAbbrev,
          row.ScheduledDeparture,
          row.IsLastArrivalOfSailingDay,
        ])
    ).toEqual([
      ["WEN", at(8, 0), false],
      ["WEN", at(9, 0), true],
      ["TAC", at(8, 15), true],
    ]);
  });

  it("maps matching history timestamps directly onto scheduled actual rows", () => {
    const departure = at(9, 10);
    const arrival = at(9, 45);
    const actualDeparture = at(9, 14);
    const estimatedArrival = at(9, 51);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const historyRecords: WsfVesselHistory[] = [
      {
        VesselId: 1,
        Vessel: "Wenatchee",
        Departing: "Seattle",
        Arriving: "Bainbridge Island",
        ScheduledDepart: departure,
        ActualDepart: actualDeparture,
        EstArrival: estimatedArrival,
      },
    ];
    const boundaryContext = buildReloadBoundaryContext({
      scheduleSegments: [scheduleSegment({ departure, arrival })],
      vessels,
      terminals,
    });
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [scheduleSegment({ departure, arrival })],
      historyRecords,
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
      ],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(result.scheduledRows.map((row) => row.EventType)).toEqual([
      "dep-dock",
      "arv-dock",
    ]);
    expect(
      boundaryContext.boundaryEvents.map((event) => [
        "EventActualTime" in event,
        "EventOccurred" in event,
      ])
    ).toEqual([
      [false, false],
      [false, false],
    ]);
    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([
      ["trip-scheduled--dep-dock", "dep-dock", actualDeparture],
      ["trip-scheduled--arv-dock", "arv-dock", estimatedArrival],
    ]);
  });

  it("falls back to vessel and scheduled departure when history terminals fail", () => {
    const departure = at(10, 5);
    const arrival = at(10, 40);
    const actualDeparture = at(10, 8);
    const estimatedArrival = at(10, 43);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [scheduleSegment({ departure, arrival })],
      historyRecords: [
        {
          VesselId: 1,
          Vessel: "Wenatchee",
          Departing: "Unknown Terminal",
          Arriving: "Also Unknown",
          ScheduledDepart: departure,
          ActualDepart: actualDeparture,
          EstArrival: estimatedArrival,
        },
      ],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
      ],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([
      ["trip-scheduled--dep-dock", "dep-dock", actualDeparture],
      ["trip-scheduled--arv-dock", "arv-dock", estimatedArrival],
    ]);
  });

  it("strictly matches history while leaving epoch actual fields as payload", () => {
    const departure = at(11, 15);
    const arrival = at(11, 50);
    const actualDeparture = at(11, 19);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [scheduleSegment({ departure, arrival })],
      historyRecords: [
        {
          VesselId: 1,
          Vessel: "Wenatchee",
          Departing: "Seattle",
          Arriving: "Bainbridge Island",
          ScheduledDepart: departure,
          ActualDepart: actualDeparture,
        },
      ],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
      ],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-scheduled--dep-dock", "dep-dock", actualDeparture]]);
  });

  it("hydrates history actuals and keeps physical-only evidence", () => {
    const departure = at(12, 20);
    const arrival = at(12, 55);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const scheduleSegments = [scheduleSegment({ departure, arrival })];
    const historyRecords = [
      {
        VesselId: 1,
        Vessel: "Wenatchee",
        Departing: "Seattle",
        Arriving: "Bainbridge Island",
        ScheduledDepart: departure,
        ActualDepart: at(12, 24),
        EstArrival: at(13, 0),
      },
    ];
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments,
      historyRecords,
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
        {
          TripKey: "trip-physical",
          ScheduleKey: undefined,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(14, 0),
          LeftDockActual: at(14, 5),
          TripEnd: at(14, 40),
        },
      ],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(result.actualRows).toHaveLength(4);
    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([
      ["trip-scheduled--dep-dock", "dep-dock", at(12, 24)],
      ["trip-scheduled--arv-dock", "arv-dock", at(13, 0)],
      ["trip-physical--dep-dock", "dep-dock", at(14, 5)],
      ["trip-physical--arv-dock", "arv-dock", at(14, 40)],
    ]);
  });

  it("emits only a departure row for a physical-only active trip away from dock", () => {
    const timestamp = at(16, 10);
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-physical",
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(16, 0),
        },
      ],
      completedTrips: [],
      vesselLocations: [
        vesselLocation({
          AtDock: false,
          TimeStamp: timestamp,
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-physical--dep-dock", "dep-dock", timestamp]]);
  });

  it("emits only an arrival row for a physical-only active trip at dock", () => {
    const timestamp = at(17, 0);
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-physical",
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(16, 20),
        },
      ],
      completedTrips: [],
      vesselLocations: [
        vesselLocation({
          AtDock: true,
          TimeStamp: timestamp,
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-physical--arv-dock", "arv-dock", timestamp]]);
  });

  it("does not duplicate physical-only tracking rows already emitted from trip fields", () => {
    const tripActual = at(18, 5);
    const locationActual = at(18, 8);
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-physical",
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(18, 0),
          LeftDockActual: tripActual,
        },
      ],
      completedTrips: [],
      vesselLocations: [
        vesselLocation({
          AtDock: false,
          TimeStamp: locationActual,
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-physical--dep-dock", "dep-dock", tripActual]]);
  });

  it("keeps durable actual rows before physical-only tracking rows in mixed batches", () => {
    const departure = at(13, 20);
    const arrival = at(13, 55);
    const historyActual = at(13, 24);
    const tripActual = at(18, 5);
    const locationActual = at(18, 8);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [scheduleSegment({ departure, arrival })],
      historyRecords: [
        {
          VesselId: 1,
          Vessel: "Wenatchee",
          Departing: "Seattle",
          Arriving: "Bainbridge Island",
          ScheduledDepart: departure,
          ActualDepart: historyActual,
        },
      ],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-physical",
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(18, 0),
          LeftDockActual: tripActual,
        },
      ],
      completedTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
      ],
      vesselLocations: [
        vesselLocation({
          AtDock: false,
          TimeStamp: locationActual,
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([
      ["trip-scheduled--dep-dock", "dep-dock", historyActual],
      ["trip-physical--dep-dock", "dep-dock", tripActual],
    ]);
  });

  it("emits only a departure row for physical-only trip left-dock evidence", () => {
    const leftDockActual = at(19, 4);
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-physical",
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(19, 0),
          LeftDockActual: leftDockActual,
        },
      ],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-physical--dep-dock", "dep-dock", leftDockActual]]);
  });

  it("emits only an arrival row for physical-only trip-end evidence", () => {
    const tripEnd = at(20, 35);
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-physical",
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(20, 0),
          TripEnd: tripEnd,
        },
      ],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-physical--arv-dock", "arv-dock", tripEnd]]);
  });

  it("suppresses physical-only trip-end rows without an arrival terminal", () => {
    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-physical",
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ScheduledDeparture: at(21, 0),
          TripEnd: at(21, 35),
        },
      ],
      vesselLocations: [],
      updatedAt: 42,
    });

    expect(result.actualRows).toEqual([]);
  });

  it("emits a scheduled departure row from away-from-dock tracking evidence", () => {
    const departure = at(22, 0);
    const arrival = at(22, 35);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [scheduleSegment({ departure, arrival })],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
      ],
      completedTrips: [],
      vesselLocations: [
        vesselLocation({
          AtDock: false,
          ScheduledDeparture: departure,
          TimeStamp: at(22, 5),
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-scheduled--dep-dock", "dep-dock", undefined]]);
  });

  it("emits an eligible prior scheduled arrival row from at-dock tracking evidence", () => {
    const firstDeparture = at(15, 0);
    const firstArrival = at(15, 35);
    const secondDeparture = at(16, 0);
    const secondArrival = at(16, 35);
    const firstSegmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(firstDeparture)
    );
    const secondSegmentKey = buildSegmentKey(
      "WEN",
      "BBI",
      "P52",
      new Date(secondDeparture)
    );

    if (firstSegmentKey === undefined || secondSegmentKey === undefined) {
      throw new Error("Expected fixture segment keys.");
    }

    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [
        scheduleSegment({
          departure: firstDeparture,
          arrival: firstArrival,
        }),
        scheduleSegment({
          departure: secondDeparture,
          arrival: secondArrival,
          departingTerminalID: 2,
          departingTerminalName: "Bainbridge Island",
          arrivingTerminalID: 1,
          arrivingTerminalName: "Seattle",
        }),
      ],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-next",
          ScheduleKey: secondSegmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "BBI",
          ArrivingTerminalAbbrev: "P52",
          ScheduledDeparture: secondDeparture,
        },
      ],
      completedTrips: [
        {
          TripKey: "trip-previous",
          ScheduleKey: firstSegmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: firstDeparture,
        },
      ],
      vesselLocations: [
        vesselLocation({
          AtDock: true,
          DepartingTerminalID: 2,
          DepartingTerminalName: "Bainbridge Island",
          DepartingTerminalAbbrev: "BBI",
          ArrivingTerminalID: 1,
          ArrivingTerminalName: "Seattle",
          ArrivingTerminalAbbrev: "P52",
          ScheduledDeparture: secondDeparture,
          TimeStamp: at(15, 50),
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-previous--arv-dock", "arv-dock", undefined]]);
  });

  it("chooses the most recent eligible prior scheduled arrival row", () => {
    const firstDeparture = at(14, 0);
    const firstArrival = at(14, 35);
    const secondDeparture = at(15, 0);
    const secondArrival = at(15, 35);
    const nextDeparture = at(16, 0);
    const nextArrival = at(16, 35);
    const firstSegmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(firstDeparture)
    );
    const secondSegmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(secondDeparture)
    );
    const nextSegmentKey = buildSegmentKey(
      "WEN",
      "BBI",
      "P52",
      new Date(nextDeparture)
    );

    if (
      firstSegmentKey === undefined ||
      secondSegmentKey === undefined ||
      nextSegmentKey === undefined
    ) {
      throw new Error("Expected fixture segment keys.");
    }

    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [
        scheduleSegment({
          departure: firstDeparture,
          arrival: firstArrival,
        }),
        scheduleSegment({
          departure: secondDeparture,
          arrival: secondArrival,
        }),
        scheduleSegment({
          departure: nextDeparture,
          arrival: nextArrival,
          departingTerminalID: 2,
          departingTerminalName: "Bainbridge Island",
          arrivingTerminalID: 1,
          arrivingTerminalName: "Seattle",
        }),
      ],
      historyRecords: [],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-next",
          ScheduleKey: nextSegmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "BBI",
          ArrivingTerminalAbbrev: "P52",
          ScheduledDeparture: nextDeparture,
        },
      ],
      completedTrips: [
        {
          TripKey: "trip-older",
          ScheduleKey: firstSegmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: firstDeparture,
        },
        {
          TripKey: "trip-newer",
          ScheduleKey: secondSegmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: secondDeparture,
        },
      ],
      vesselLocations: [
        vesselLocation({
          AtDock: true,
          DepartingTerminalID: 2,
          DepartingTerminalName: "Bainbridge Island",
          DepartingTerminalAbbrev: "BBI",
          ArrivingTerminalID: 1,
          ArrivingTerminalName: "Seattle",
          ArrivingTerminalAbbrev: "P52",
          ScheduledDeparture: nextDeparture,
          TimeStamp: at(15, 50),
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-newer--arv-dock", "arv-dock", undefined]]);
  });

  it("does not duplicate scheduled tracking rows already actualized by history", () => {
    const departure = at(23, 0);
    const arrival = at(23, 35);
    const actualDeparture = at(23, 4);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const result = buildReloadResult({
      sailingDay: "2026-03-25",
      scheduleSegments: [scheduleSegment({ departure, arrival })],
      historyRecords: [
        {
          VesselId: 1,
          Vessel: "Wenatchee",
          Departing: "Seattle",
          Arriving: "Bainbridge Island",
          ScheduledDepart: departure,
          ActualDepart: actualDeparture,
        },
      ],
      vessels,
      terminals,
      activeTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
      ],
      completedTrips: [],
      vesselLocations: [
        vesselLocation({
          AtDock: false,
          ScheduledDeparture: departure,
          TimeStamp: at(23, 8),
        }),
      ],
      updatedAt: 42,
    });

    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([["trip-scheduled--dep-dock", "dep-dock", actualDeparture]]);
  });
});

const buildReloadResult = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
  activeTrips,
  completedTrips,
  vesselLocations,
  updatedAt,
}: {
  sailingDay: string;
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReloadTripForActuals[];
  completedTrips: ReloadTripForActuals[];
  vesselLocations: ConvexVesselLocation[];
  updatedAt: number;
}) => {
  const boundaryContext = buildReloadBoundaryContext({
    scheduleSegments,
    vessels,
    terminals,
  });

  return {
    scheduledRows: buildScheduledRows(
      boundaryContext.boundaryEvents,
      updatedAt
    ),
    actualRows: buildActualRows({
      sailingDay,
      seedSegments: boundaryContext.seedSegments,
      boundaryEvents: boundaryContext.boundaryEvents,
      historyRecords,
      activeTrips,
      completedTrips,
      vesselLocations,
      vessels,
      terminals,
      updatedAt,
    }),
  };
};

const scheduleSegment = ({
  vesselName = "Wenatchee",
  departure,
  arrival,
  departingTerminalID = 1,
  departingTerminalName = "Seattle",
  arrivingTerminalID = 2,
  arrivingTerminalName = "Bainbridge Island",
}: {
  vesselName?: string;
  departure: number;
  arrival: number;
  departingTerminalID?: number;
  departingTerminalName?: string;
  arrivingTerminalID?: number;
  arrivingTerminalName?: string;
}): WsfScheduledSegment => ({
  VesselName: vesselName,
  DepartingTerminalID: departingTerminalID,
  ArrivingTerminalID: arrivingTerminalID,
  DepartingTerminalName: departingTerminalName,
  ArrivingTerminalName: arrivingTerminalName,
  DepartingTime: departure,
  ArrivingTime: arrival,
  SailingNotes: "",
  Annotations: [],
  RouteID: 3,
  RouteAbbrev: "sea-bi",
  SailingDay: "2026-03-25",
});

const vesselLocation = (
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Wenatchee",
  VesselAbbrev: "WEN",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Bainbridge Island",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 47.6,
  Longitude: -122.3,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: false,
  TimeStamp: at(16, 0),
  AtDockObserved: true,
  ...overrides,
});
