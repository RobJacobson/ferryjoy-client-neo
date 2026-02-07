/**
 * ScheduledTrips data-flow pipeline: schedule is primary; overlay (completed/active trips) decorates.
 * Pipeline 1: join schedule with overlay by segment Key → one SegmentTuple per segment.
 * Pipeline 2: segment tuples + page maps → card display state and per-segment leg props for timeline.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type {
  TimelineActivePhase,
  TimelineSegmentStatus,
} from "../../Timeline/types";
import type { ScheduledTripJourney, SegmentTuple } from "../types";
import type { PageMaps } from "./buildPageDataMaps";
import type { ScheduledTripCardDisplayState } from "./computePageDisplayState";
import { computeCardDisplayStateForPage } from "./computePageDisplayState";

// ============================================================================
// Types
// ============================================================================

/** Props passed to ScheduledTripLeg; all data from pipeline, no lookup at render. */
export type SegmentLegProps = {
  segment: SegmentTuple["segment"];
  /** Real-time vessel location when available; null for schedule-only (e.g. future journey). */
  vesselLocation: VesselLocation | null;
  actualTrip?: VesselTrip;
  prevActualTrip?: VesselTrip;
  nextActualTrip?: VesselTrip;
  predictionTrip?: VesselTrip;
  legStatus: TimelineSegmentStatus;
  activeKey: string | null;
  activePhase: TimelineActivePhase;
  isFirst: boolean;
  isLast: boolean;
};

/** Result of runScheduledTripsPipeline; only leg props are returned (display state is used internally). */
export type ScheduledTripsPipelineResult = {
  legPropsByJourneyId: Map<string, SegmentLegProps[]>;
};

// ============================================================================
// Runner: pipeline 1 + pipeline 2
// ============================================================================

/**
 * Runs the ScheduledTrips pipeline: join schedule with overlay by Key (reduce), then
 * map to card display state and per-segment leg props. Schedule is primary; when
 * maps are empty, renders basic schedule (no actuals/predictions).
 *
 * @param journeys - Scheduled journeys (from getScheduledTripsForTerminal)
 * @param maps - Page maps (vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev); may be empty
 * @param terminalAbbrev - Page departure terminal (for active-segment selection)
 * @returns legPropsByJourneyId (display state is used internally to build leg props)
 */
export const runScheduledTripsPipeline = (
  journeys: ScheduledTripJourney[],
  maps: PageMaps | null,
  terminalAbbrev: string
): ScheduledTripsPipelineResult => {
  const vesselTripMap = maps?.vesselTripMap ?? new Map<string, VesselTrip>();
  const vesselLocationByAbbrev =
    maps?.vesselLocationByAbbrev ?? new Map<string, VesselLocation>();
  const displayTripByAbbrev =
    maps?.displayTripByAbbrev ?? new Map<string, VesselTrip>();

  // Pipeline 1: join by Key → segment tuples
  const segmentTuples = buildSegmentTuples(journeys, vesselTripMap);

  // Pipeline 2: display state per journey (internal), then leg props per journey
  const displayStateByJourneyId = computeCardDisplayStateForPage({
    terminalAbbrev,
    journeys,
    vesselLocationByAbbrev,
    displayTripByAbbrev,
    vesselTripMap,
  });

  const legPropsByJourneyId = new Map<string, SegmentLegProps[]>();

  for (const journey of journeys) {
    const displayState = displayStateByJourneyId.get(journey.id);
    if (!displayState) continue;

    const segmentTuplesForJourney = segmentTuples.filter(
      (t) => t.journeyId === journey.id
    );
    const legProps = buildLegPropsForJourney(
      journey,
      segmentTuplesForJourney,
      vesselTripMap,
      vesselLocationByAbbrev,
      displayState
    );
    legPropsByJourneyId.set(journey.id, legProps);
  }

  return { legPropsByJourneyId };
};

// ============================================================================
// Pipeline 1: reduce — join schedule with overlay by Key
// ============================================================================

/**
 * Builds one tuple per scheduled segment with optional overlay trip (active wins over completed).
 * Schedule is the canonical list; overlay is attached by segment Key.
 *
 * @param journeys - Scheduled journeys (from schedule query)
 * @param vesselTripMap - Map of segment Key to VesselTrip (from completed + active + hold)
 * @returns SegmentTuple[] in journey order
 */
const buildSegmentTuples = (
  journeys: ScheduledTripJourney[],
  vesselTripMap: Map<string, VesselTrip>
): SegmentTuple[] =>
  journeys.flatMap((journey) =>
    journey.segments.map((segment, segmentIndex) => ({
      segment,
      actualTrip: vesselTripMap.get(segment.Key),
      journeyId: journey.id,
      vesselAbbrev: journey.vesselAbbrev,
      segmentIndex,
    }))
  );

// ============================================================================
// Pipeline 2: map — segment tuples + maps → display state and leg props
// ============================================================================

type TupleToLegPropsContext = {
  segments: ScheduledTripJourney["segments"];
  vesselLocation: VesselLocation | null;
  timeline: ScheduledTripCardDisplayState["timeline"];
  inboundTripForFirstSegment: VesselTrip | undefined;
  vesselTripMap: Map<string, VesselTrip>;
};

/**
 * Maps one segment tuple (and index) to SegmentLegProps using display state and maps.
 *
 * @param tuple - Segment tuple for this leg
 * @param index - Index in journey.segments (for prev/next and isFirst/isLast)
 * @param ctx - Resolved vessel location, timeline state, trip map, and nowMs
 * @returns SegmentLegProps for ScheduledTripLeg
 */
const tupleToLegProps = (
  tuple: SegmentTuple,
  index: number,
  ctx: TupleToLegPropsContext
): SegmentLegProps => {
  const {
    segments,
    vesselLocation,
    timeline,
    inboundTripForFirstSegment,
    vesselTripMap,
  } = ctx;

  const prevSegment = index > 0 ? segments[index - 1] : undefined;
  const nextSegment =
    index < segments.length - 1 ? segments[index + 1] : undefined;
  const prevActualTrip = prevSegment
    ? vesselTripMap.get(prevSegment.Key)
    : undefined;
  const nextActualTrip = nextSegment
    ? vesselTripMap.get(nextSegment.Key)
    : undefined;
  const predictionTrip = index === 0 ? inboundTripForFirstSegment : undefined;
  const legStatus = timeline.statusByKey.get(tuple.segment.Key) ?? "Pending";

  return {
    segment: tuple.segment,
    vesselLocation,
    actualTrip: tuple.actualTrip,
    prevActualTrip,
    nextActualTrip,
    predictionTrip,
    legStatus,
    activeKey: timeline.activeKey,
    activePhase: timeline.activePhase,
    isFirst: index === 0,
    isLast: index === segments.length - 1,
  };
};

/**
 * Builds leg props for one journey from segment tuples and card display state.
 *
 * @param journey - Journey for which to build leg props
 * @param segmentTuplesForJourney - Tuples for this journey (same order as journey.segments)
 * @param vesselTripMap - For prev/next lookup
 * @param vesselLocationByAbbrev - Resolved location per vessel (or empty)
 * @param displayState - Pre-computed card display state for this journey
 * @returns Array of SegmentLegProps in segment order
 */
const buildLegPropsForJourney = (
  journey: ScheduledTripJourney,
  segmentTuplesForJourney: SegmentTuple[],
  vesselTripMap: Map<string, VesselTrip>,
  vesselLocationByAbbrev: Map<string, VesselLocation>,
  displayState: ScheduledTripCardDisplayState
): SegmentLegProps[] => {
  const vesselLocation =
    vesselLocationByAbbrev.get(journey.vesselAbbrev) ?? null;
  const { timeline, inboundTripForFirstSegment } = displayState;
  const ctx: TupleToLegPropsContext = {
    segments: journey.segments,
    vesselLocation,
    timeline,
    inboundTripForFirstSegment,
    vesselTripMap,
  };
  return segmentTuplesForJourney.map((tuple, index) =>
    tupleToLegProps(tuple, index, ctx)
  );
};
