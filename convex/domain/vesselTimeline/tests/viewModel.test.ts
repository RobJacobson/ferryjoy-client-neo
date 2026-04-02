/**
 * Covers the backend-owned VesselTimeline row and view-model contract.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexActualBoundaryEvent } from "../../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "../../../functions/vesselTrips/schemas";
import { buildVesselTimelineViewModel } from "../viewModel";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("buildVesselTimelineViewModel", () => {
  it("builds stable at-dock and at-sea rows for a trip", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-0--arv-dock",
          TerminalAbbrev: "P52",
          EventType: "arv-dock",
          ScheduledDeparture: at(7, 10),
          EventScheduledTime: at(7, 45),
        }),
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "P52",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "BBI",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
      location: null,
      activeTrip: null,
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    });

    expect(viewModel.rows.map((row) => row.rowId)).toEqual([
      "trip-1--at-dock",
      "trip-1--at-sea",
    ]);
    expect(viewModel.rows[0]?.kind).toBe("at-dock");
    expect(viewModel.rows[1]?.kind).toBe("at-sea");
  });

  it("emits a start-of-day placeholder dock row keyed to the real trip", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "P52",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "BBI",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
      location: null,
      activeTrip: null,
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    });

    expect(viewModel.rows[0]?.rowId).toBe("trip-1--at-dock");
    expect(viewModel.rows[0]?.placeholderReason).toBe("start-of-day");
    expect(viewModel.rows[0]?.startEvent.IsArrivalPlaceholder).toBe(true);
  });

  it("emits a broken-seam placeholder dock row keyed to the affected trip", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-0--arv-dock",
          TerminalAbbrev: "FAU",
          EventType: "arv-dock",
          ScheduledDeparture: at(7, 0),
          EventScheduledTime: at(7, 20),
        }),
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "VAI",
          EventType: "dep-dock",
          ScheduledDeparture: at(7, 55),
          EventScheduledTime: at(7, 55),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "FAU",
          EventType: "arv-dock",
          ScheduledDeparture: at(7, 55),
          EventScheduledTime: at(8, 15),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
      location: null,
      activeTrip: null,
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    });

    expect(viewModel.rows[0]?.rowId).toBe("trip-1--at-dock");
    expect(viewModel.rows[0]?.placeholderReason).toBe("broken-seam");
    expect(viewModel.rows[0]?.startEvent.IsArrivalPlaceholder).toBe(true);
  });

  it("emits a terminal-tail dock row keyed to the next trip", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-0--arv-dock",
          TerminalAbbrev: "P52",
          EventType: "arv-dock",
          ScheduledDeparture: at(7, 10),
          EventScheduledTime: at(7, 45),
        }),
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "P52",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "BBI",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
      location: null,
      activeTrip: null,
      inferredDockedTripKey: null,
      terminalTailTripKey: "trip-2",
    });

    const tailRow = viewModel.rows.at(-1);
    expect(tailRow?.rowId).toBe("trip-2--at-dock");
    expect(tailRow?.rowEdge).toBe("terminal-tail");
    expect(tailRow?.startEvent.Key).toBe("trip-1--arv-dock");
    expect(tailRow?.endEvent.Key).toBe("trip-1--arv-dock");
    expect(tailRow?.durationMinutes).toBe(0);
  });

  it("keeps a late docked vessel attached to the delayed next trip row", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "KIS",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "CLI",
          EventType: "dep-dock",
          ScheduledDeparture: at(10, 30),
          EventScheduledTime: at(10, 30),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "MUK",
          EventType: "arv-dock",
          ScheduledDeparture: at(10, 30),
          EventScheduledTime: at(11, 5),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          TerminalAbbrev: "MUK",
          EventType: "dep-dock",
          ScheduledDeparture: at(11, 30),
          EventScheduledTime: at(11, 30),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          TerminalAbbrev: "CLI",
          EventType: "arv-dock",
          ScheduledDeparture: at(11, 30),
          EventScheduledTime: at(12, 5),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--arv-dock",
          ScheduledDeparture: at(10, 30),
          TerminalAbbrev: "MUK",
          EventActualTime: at(11, 8),
        }),
      ],
      predictedEvents: [],
      location: makeLocation({
        VesselAbbrev: "KIS",
        AtDock: true,
        DepartingTerminalAbbrev: "MUK",
        Key: undefined,
        TimeStamp: at(11, 12),
      }),
      activeTrip: makeTrip({
        VesselAbbrev: "KIS",
        Key: "trip-2",
        AtDock: true,
        DepartingTerminalAbbrev: "MUK",
      }),
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    });

    expect(viewModel.activeRowId).toBe("trip-2--at-dock");
    expect(viewModel.live?.AtDock).toBe(true);
    expect(viewModel.live?.DepartingTerminalAbbrev).toBe("MUK");
  });

  it("follows the resolved trip key instead of guessing between same-terminal rows", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "KIS",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "MUK",
          EventType: "dep-dock",
          ScheduledDeparture: at(13, 0),
          EventScheduledTime: at(13, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "CLI",
          EventType: "arv-dock",
          ScheduledDeparture: at(13, 0),
          EventScheduledTime: at(13, 35),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          TerminalAbbrev: "CLI",
          EventType: "dep-dock",
          ScheduledDeparture: at(14, 0),
          EventScheduledTime: at(14, 0),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          TerminalAbbrev: "MUK",
          EventType: "arv-dock",
          ScheduledDeparture: at(14, 0),
          EventScheduledTime: at(14, 35),
        }),
        makeScheduledEvent({
          Key: "trip-3--dep-dock",
          TerminalAbbrev: "MUK",
          EventType: "dep-dock",
          ScheduledDeparture: at(15, 4),
          EventScheduledTime: at(15, 4),
        }),
        makeScheduledEvent({
          Key: "trip-3--arv-dock",
          TerminalAbbrev: "CLI",
          EventType: "arv-dock",
          ScheduledDeparture: at(15, 4),
          EventScheduledTime: at(15, 39),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
      location: makeLocation({
        VesselAbbrev: "KIS",
        AtDock: true,
        DepartingTerminalAbbrev: "MUK",
        Key: "trip-3",
        TimeStamp: at(14, 22),
      }),
      activeTrip: null,
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    });

    expect(viewModel.activeRowId).toBe("trip-3--at-dock");
  });

  it("keeps row IDs stable when predictions change displayed times", () => {
    const baseArgs = {
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-0--arv-dock",
          TerminalAbbrev: "P52",
          EventType: "arv-dock",
          ScheduledDeparture: at(7, 10),
          EventScheduledTime: at(7, 45),
        }),
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "P52",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "BBI",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      location: null,
      activeTrip: null,
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    } satisfies Parameters<typeof buildVesselTimelineViewModel>[0];
    const withoutPredictions = buildVesselTimelineViewModel({
      ...baseArgs,
      predictedEvents: [],
    });
    const withPredictions = buildVesselTimelineViewModel({
      ...baseArgs,
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          ScheduledDeparture: at(8, 0),
          TerminalAbbrev: "BBI",
          EventPredictedTime: at(8, 42),
        }),
      ],
    });

    expect(withoutPredictions.rows.map((row) => row.rowId)).toEqual(
      withPredictions.rows.map((row) => row.rowId)
    );
    expect(withPredictions.rows[1]?.endEvent.EventPredictedTime).toBe(
      at(8, 42)
    );
  });

  it("returns null active row when no stable trip key can be resolved", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "P52",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "BBI",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
      location: makeLocation({
        AtDock: true,
        Key: undefined,
        TimeStamp: at(8, 10),
      }),
      activeTrip: null,
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    });

    expect(viewModel.activeRowId).toBeNull();
    expect(viewModel.live?.AtDock).toBe(true);
  });

  it("returns raw live movement state for frontend indicator derivation", () => {
    const viewModel = buildVesselTimelineViewModel({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-0--arv-dock",
          TerminalAbbrev: "P52",
          EventType: "arv-dock",
          ScheduledDeparture: at(7, 10),
          EventScheduledTime: at(7, 45),
        }),
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          TerminalAbbrev: "P52",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "BBI",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
      location: makeLocation({
        AtDock: false,
        Key: "trip-1",
        ArrivingTerminalAbbrev: "BBI",
        ArrivingDistance: 4.2,
        Speed: 12,
        TimeStamp: at(8, 10),
      }),
      activeTrip: makeTrip({
        Key: "trip-1",
        AtDock: false,
      }),
      inferredDockedTripKey: null,
      terminalTailTripKey: null,
    });

    expect(viewModel.activeRowId).toBe("trip-1--at-sea");
    expect(viewModel.live).toMatchObject({
      AtDock: false,
      ArrivingTerminalAbbrev: "BBI",
      ArrivingDistance: 4.2,
      Speed: 12,
    });
  });
});

/**
 * Builds a scheduled boundary event for tests.
 *
 * @param overrides - Field overrides
 * @returns Scheduled boundary event
 */
const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledBoundaryEvent>
): ConvexScheduledBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
  ...overrides,
});

/**
 * Builds an actual boundary event for tests.
 *
 * @param overrides - Field overrides
 * @returns Actual boundary event
 */
const makeActualEvent = (
  overrides: Partial<ConvexActualBoundaryEvent>
): ConvexActualBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventActualTime: at(8, 2),
  ...overrides,
});

/**
 * Builds a predicted boundary event for tests.
 *
 * @param overrides - Field overrides
 * @returns Predicted boundary event
 */
const makePredictedEvent = (
  overrides: Partial<ConvexPredictedBoundaryEvent>
): ConvexPredictedBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventPredictedTime: at(8, 5),
  PredictionType: "AtDockDepartCurr",
  PredictionSource: "ml",
  ...overrides,
});

/**
 * Builds a vessel-location row for tests.
 *
 * @param overrides - Field overrides
 * @returns Live vessel-location row
 */
const makeLocation = (
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Wenatchee",
  VesselAbbrev: "WEN",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Bainbridge",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 47.6,
  Longitude: -122.3,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: at(8, 0),
  RouteAbbrev: "SEA-BBI",
  VesselPositionNum: 1,
  TimeStamp: at(8, 0),
  Key: "trip-1",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

/**
 * Builds an active or completed trip row for tests.
 *
 * @param overrides - Field overrides
 * @returns Vessel trip row
 */
const makeTrip = (overrides: Partial<ConvexVesselTrip>): ConvexVesselTrip => ({
  VesselAbbrev: "WEN",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  RouteAbbrev: "SEA-BBI",
  Key: "trip-1",
  SailingDay: "2026-03-25",
  PrevTerminalAbbrev: "BBI",
  ArriveDest: undefined,
  TripStart: at(7, 45),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: at(8, 0),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: at(8, 0),
  PrevScheduledDeparture: at(6, 55),
  PrevLeftDock: at(7, 0),
  NextKey: "trip-2",
  NextScheduledDeparture: at(9, 0),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
