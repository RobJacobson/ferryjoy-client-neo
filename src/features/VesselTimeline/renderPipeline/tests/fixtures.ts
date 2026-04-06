/**
 * Shared fixtures for VesselTimeline render-pipeline tests.
 */

import type {
  VesselTimelineActiveInterval,
  VesselTimelineEvent,
} from "convex/functions/vesselTimeline/schemas";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import type { VesselLocation } from "@/types";
import { DEFAULT_VESSEL_TIMELINE_LAYOUT } from "../../config";
import type { VesselTimelineRow, VesselTimelineRowEvent } from "../../types";
import type {
  VesselTimelineActiveRow,
  VesselTimelinePipelineInput,
  VesselTimelinePipelineWithRenderRows,
} from "../pipelineTypes";

/**
 * Builds a UTC fixture timestamp for deterministic tests.
 *
 * @param hours - UTC hour
 * @param minutes - UTC minute
 * @returns Deterministic date fixture
 */
export const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

/**
 * Resolves full terminal names for render-pipeline tests.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Full terminal name, or `null`
 */
export const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
  (
    ({
      P52: "Seattle",
      VAI: "Vashon Is.",
      BBI: "Bainbridge Island",
      FAU: "Fauntleroy",
    }) as const
  )[terminalAbbrev] ?? null;

/**
 * Builds a backend VesselTimeline event fixture.
 *
 * @param overrides - Field overrides for the event fixture
 * @returns Backend event fixture
 */
export const makeEvent = (
  overrides: Partial<VesselTimelineEvent>
): VesselTimelineEvent => ({
  SegmentKey: "trip-1",
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-18",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
  EventPredictedTime: undefined,
  EventOccurred: undefined,
  EventActualTime: undefined,
  ...overrides,
});

/**
 * Builds the default event slice used by full-pipeline tests.
 *
 * @returns Ordered backend event slice
 */
export const makeEventSlice = (): VesselTimelineEvent[] => [
  makeEvent({
    SegmentKey: "trip-1",
    Key: "trip-1--dep-dock",
    EventType: "dep-dock",
    TerminalAbbrev: "P52",
    ScheduledDeparture: at(8, 0),
    EventScheduledTime: at(8, 0),
  }),
  makeEvent({
    SegmentKey: "trip-1",
    Key: "trip-1--arv-dock",
    EventType: "arv-dock",
    TerminalAbbrev: "VAI",
    ScheduledDeparture: at(8, 0),
    EventScheduledTime: at(8, 35),
  }),
];

/**
 * Builds a feature-owned row event fixture.
 *
 * @param overrides - Field overrides for the row event fixture
 * @returns Row event fixture
 */
export const makeRowEvent = (
  overrides: Partial<VesselTimelineRowEvent>
): VesselTimelineRowEvent => ({
  Key: "trip-1--dep-dock",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  IsArrivalPlaceholder: false,
  EventScheduledTime: at(8, 0),
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});

/**
 * Builds a feature-owned row fixture.
 *
 * @param overrides - Field overrides for the row fixture
 * @returns Row fixture
 */
export const makeRow = (
  overrides: Partial<VesselTimelineRow>
): VesselTimelineRow => ({
  rowId: "trip-1--at-sea",
  segmentKey: "trip-1",
  kind: "at-sea",
  rowEdge: "normal",
  placeholderReason: undefined,
  startEvent: makeRowEvent({}),
  endEvent: makeRowEvent({
    Key: "trip-1--arv-dock",
    EventType: "arv-dock",
    TerminalAbbrev: "VAI",
    EventScheduledTime: at(8, 35),
  }),
  durationMinutes: 35,
  ...overrides,
});

/**
 * Builds a compact derived-row fixture set.
 *
 * @returns Derived rows for layout and indicator tests
 */
export const makeRows = (): VesselTimelineRow[] => [
  makeRow({
    rowId: "trip-1--at-dock",
    segmentKey: "trip-1",
    kind: "at-dock",
    rowEdge: "normal",
    placeholderReason: "start-of-day",
    startEvent: makeRowEvent({
      Key: "trip-1--arrival-placeholder",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      ScheduledDeparture: at(8, 0),
      IsArrivalPlaceholder: true,
      EventScheduledTime: undefined,
    }),
    endEvent: makeRowEvent({
      Key: "trip-1--dep-dock",
      EventType: "dep-dock",
      TerminalAbbrev: "P52",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 0),
    }),
    durationMinutes: 0,
  }),
  makeRow({
    rowId: "trip-1--at-sea",
    segmentKey: "trip-1",
    kind: "at-sea",
    rowEdge: "normal",
    startEvent: makeRowEvent({
      Key: "trip-1--dep-dock",
      EventType: "dep-dock",
      TerminalAbbrev: "P52",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 0),
    }),
    endEvent: makeRowEvent({
      Key: "trip-1--arv-dock",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    durationMinutes: 35,
  }),
  makeRow({
    rowId: "trip-1--at-dock--terminal-tail",
    segmentKey: "trip-1",
    kind: "at-dock",
    rowEdge: "terminal-tail",
    startEvent: makeRowEvent({
      Key: "trip-1--arv-dock",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    endEvent: makeRowEvent({
      Key: "trip-1--arv-dock",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    durationMinutes: 0,
  }),
];

/**
 * Builds a live-state fixture for indicator tests.
 *
 * @param overrides - Field overrides for the live-state fixture
 * @returns Live-state fixture
 */
export const makeVesselLocation = (
  overrides: Partial<VesselLocation>
): VesselLocation => ({
  VesselID: 1,
  VesselName: "Wenatchee",
  AtDock: false,
  InService: true,
  Speed: 0,
  Heading: 0,
  DepartingTerminalAbbrev: "P52",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  ArrivingTerminalAbbrev: "VAI",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Vashon Is.",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: at(8, 0),
  RouteAbbrev: "sea-vai",
  Latitude: 47.6,
  Longitude: -122.3,
  Key: "trip-1",
  VesselAbbrev: "WEN",
  VesselPositionNum: 1,
  TimeStamp: at(8, 10),
  ...overrides,
});

/**
 * Builds the default pipeline input used by stage tests.
 *
 * @param overrides - Field overrides for the pipeline input
 * @returns Complete pipeline input fixture
 */
export const makePipelineInput = (
  overrides: Partial<VesselTimelinePipelineInput> = {}
): VesselTimelinePipelineInput => ({
  events: makeEventSlice(),
  activeInterval: null,
  vesselLocation: null,
  getTerminalNameByAbbrev,
  layout: DEFAULT_VESSEL_TIMELINE_LAYOUT,
  now: at(8, 20),
  theme: BASE_TIMELINE_VISUAL_THEME,
  ...overrides,
});

/**
 * Builds a pipeline context for the active-indicator stage.
 *
 * @param overrides - Field overrides for the pipeline context
 * @returns Pipeline context shaped for `toActiveIndicator`
 */
export const makePipelineWithRenderRows = ({
  rows = makeRows(),
  activeRow = null,
  renderRows = [],
  rowLayouts = {},
  terminalCards = [],
  contentHeightPx = 0,
  activeRowIndex = activeRow?.rowIndex ?? -1,
  activeInterval = null,
  vesselLocation = null,
  now = at(8, 20),
}: {
  rows?: VesselTimelineRow[];
  activeRow?: VesselTimelineActiveRow | null;
  renderRows?: VesselTimelinePipelineWithRenderRows["renderRows"];
  rowLayouts?: VesselTimelinePipelineWithRenderRows["rowLayouts"];
  terminalCards?: VesselTimelinePipelineWithRenderRows["terminalCards"];
  contentHeightPx?: number;
  activeRowIndex?: number;
  activeInterval?: VesselTimelineActiveInterval;
  vesselLocation?: VesselLocation | null;
  now?: Date;
} = {}): VesselTimelinePipelineWithRenderRows => ({
  ...makePipelineInput({
    activeInterval,
    vesselLocation,
    now,
  }),
  rows,
  activeRow,
  renderRows,
  rowLayouts,
  terminalCards,
  contentHeightPx,
  activeRowIndex,
});
