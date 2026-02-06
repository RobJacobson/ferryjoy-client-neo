/**
 * Timeline resolver for deriving a single active segment and monotonic statuses.
 *
 * This module centralizes the business logic that determines:
 * - which scheduled segment is currently active (by deterministic Key when possible)
 * - the active phase ("AtDock" vs "AtSea") using VesselLocation as real-time truth
 * - a monotonic Completed → InProgress → Pending status for each segment
 *
 * The output is intended to be consumed by Timeline presentation components so that
 * individual legs/bars never independently infer their own state.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { Segment, TimelineSegmentStatus } from "./types";

// ============================================================================
// Types
// ============================================================================

export type TimelineActivePhase = "AtDock" | "AtSea" | "Unknown";

export type ResolvedTimelineSegment = {
  scheduled: Segment;
  actual?: VesselTrip;
};

export type TimelineResolution = {
  /**
   * The segment Key that is considered active for this timeline, if any.
   * This is the primary selector; `activeIndex` is derived from it.
   */
  activeKey: string | null;
  /**
   * Index of the active segment in `segments`, derived from `activeKey`.
   */
  activeIndex: number | null;
  /**
   * Real-time phase for the active segment, derived from VesselLocation.
   */
  activePhase: TimelineActivePhase;
  /**
   * Scheduled segments joined with their matching actual trip (by Key), if present.
   */
  resolvedSegments: ResolvedTimelineSegment[];
  /**
   * Monotonic status for each segment Key.
   */
  statusByKey: Map<string, TimelineSegmentStatus>;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve a timeline render model for ordered segments.
 *
 * Priority for determining active segment:
 * 1. `heldTripKey` (30s hold window) when it exists in the segment list
 * 2. terminal matching using VesselLocation real-time state
 * 3. schedule-time fallback using `nowMs`
 *
 * @param params - Timeline inputs and optional hold key
 * @returns Resolution containing activeKey, activePhase, and per-segment statuses
 */
export const resolveTimeline = (params: {
  segments: Segment[];
  vesselLocation: VesselLocation;
  tripsByKey: Map<string, VesselTrip>;
  nowMs: number;
  heldTripKey?: string;
  /**
   * Whether schedule-time heuristics are allowed to select an active segment when
   * no hold key and no real-time terminal match exists.
   *
   * Recommended:
   * - ScheduledTrips cards: false (avoid phantom indicators on unrelated journeys)
   * - VesselTrips detail: true (best-effort rendering for single-leg views)
   */
  allowScheduleFallback?: boolean;
}): TimelineResolution => {
  const {
    segments,
    vesselLocation,
    tripsByKey,
    nowMs,
    heldTripKey,
    allowScheduleFallback = true,
  } = params;

  const resolvedSegments: ResolvedTimelineSegment[] = segments.map((s) => ({
    scheduled: s,
    actual: tripsByKey.get(s.Key),
  }));

  const heldIndex =
    heldTripKey != null ? segments.findIndex((s) => s.Key === heldTripKey) : -1;
  const activeIndexFromHeld = heldIndex >= 0 ? heldIndex : null;

  const activeIndex =
    activeIndexFromHeld ??
    findActiveIndexFromVesselLocation({ segments, vesselLocation, nowMs }) ??
    (allowScheduleFallback
      ? findActiveIndexFromScheduleTime({ segments, nowMs })
      : null);

  const activeKey =
    activeIndex != null ? (segments[activeIndex]?.Key ?? null) : null;
  const activePhase =
    activeIndex != null ? deriveActivePhase(vesselLocation) : "Unknown";

  const statusByKey = new Map<string, TimelineSegmentStatus>();
  if (activeIndex == null) {
    const fallbackStatuses = deriveStatusesWithoutActive({ segments, nowMs });
    for (const [key, status] of fallbackStatuses) statusByKey.set(key, status);
  } else {
    segments.forEach((segment, index) => {
      statusByKey.set(
        segment.Key,
        index < activeIndex
          ? "Completed"
          : index === activeIndex
            ? "InProgress"
            : "Pending"
      );
    });
  }

  return {
    activeKey,
    activeIndex,
    activePhase,
    resolvedSegments,
    statusByKey,
  };
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Derive the active phase for the currently active segment using real-time state.
 *
 * @param vesselLocation - Real-time vessel state
 * @returns Active phase string
 */
const deriveActivePhase = (
  vesselLocation: VesselLocation
): TimelineActivePhase => (vesselLocation.AtDock ? "AtDock" : "AtSea");

/**
 * Choose an active segment index using real-time vessel state.
 *
 * @param params - Segments and VesselLocation
 * @returns Active segment index or null
 */
const findActiveIndexFromVesselLocation = (params: {
  segments: Segment[];
  vesselLocation: VesselLocation;
  nowMs: number;
}): number | null => {
  const { segments, vesselLocation } = params;

  const scheduledDepartureMs = vesselLocation.ScheduledDeparture?.getTime();

  if (vesselLocation.AtDock) {
    const matches = segments
      .map((s, idx) => ({ s, idx }))
      .filter(
        ({ s }) =>
          s.DepartingTerminalAbbrev === vesselLocation.DepartingTerminalAbbrev
      );

    // If ScheduledDeparture is known, use it to disambiguate *which sailing* is active.
    // Without this, every single-segment card with the same terminal pair could appear active.
    if (scheduledDepartureMs != null) {
      const exact = matches.find(
        ({ s }) => s.DepartingTime.getTime() === scheduledDepartureMs
      );
      return exact?.idx ?? null;
    }

    // If ScheduledDeparture isn't available yet, avoid guessing by time. It's better
    // to show no active segment briefly than to incorrectly mark multiple sailings active.
    return null;
  }

  const arriving = vesselLocation.ArrivingTerminalAbbrev;
  if (!arriving) return null;

  const matches = segments
    .map((s, idx) => ({ s, idx }))
    .filter(
      ({ s }) =>
        s.DepartingTerminalAbbrev === vesselLocation.DepartingTerminalAbbrev &&
        s.ArrivingTerminalAbbrev === arriving
    );

  if (scheduledDepartureMs != null) {
    const exact = matches.find(
      ({ s }) => s.DepartingTime.getTime() === scheduledDepartureMs
    );
    return exact?.idx ?? null;
  }

  // Same rationale as the at-dock case: without ScheduledDeparture we can't safely
  // disambiguate between multiple sailings with the same terminal pair.
  return null;
};

/**
 * Choose an active segment index from schedule time windows.
 *
 * @param params - Segments and current time
 * @returns Active segment index or null
 */
const findActiveIndexFromScheduleTime = (params: {
  segments: Segment[];
  nowMs: number;
}): number | null => {
  const { segments, nowMs } = params;

  if (segments.length === 0) return null;

  // Choose the first segment whose end boundary is after now.
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const endMs =
      seg.SchedArriveNext?.getTime() ??
      seg.ArrivingTime?.getTime() ??
      seg.NextDepartingTime?.getTime();
    if (endMs != null && nowMs < endMs) return i;
  }

  // If everything ends before now, no active segment.
  return null;
};

/**
 * Derive statuses when we cannot find a single active segment.
 *
 * @param params - Segments and current time
 * @returns Map of Key → status
 */
const deriveStatusesWithoutActive = (params: {
  segments: Segment[];
  nowMs: number;
}): Map<string, TimelineSegmentStatus> => {
  const { segments, nowMs } = params;
  const statusByKey = new Map<string, TimelineSegmentStatus>();

  if (segments.length === 0) return statusByKey;

  const firstStartMs = segments[0]?.DepartingTime.getTime() ?? 0;
  const lastEndMs =
    segments
      .map(
        (s) =>
          s.SchedArriveNext?.getTime() ??
          s.ArrivingTime?.getTime() ??
          s.NextDepartingTime?.getTime() ??
          s.DepartingTime.getTime()
      )
      .reduce((max, v) => Math.max(max, v), 0) ?? 0;

  const defaultStatus: TimelineSegmentStatus =
    nowMs < firstStartMs
      ? "Pending"
      : nowMs > lastEndMs
        ? "Completed"
        : "Pending";

  for (const segment of segments) {
    statusByKey.set(segment.Key, defaultStatus);
  }

  return statusByKey;
};
