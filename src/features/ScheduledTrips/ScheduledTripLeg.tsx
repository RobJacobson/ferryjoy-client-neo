/**
 * ScheduledTripLeg: one leg of a multi-segment journey (origin arrive → at-dock → depart → at-sea → arrive).
 * ScheduledTrips owns what to display; uses only Timeline primitives (Marker, BarAtDock, BarAtSea, DisplayTime).
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { Text } from "@/components/ui";
import {
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineDisplayTime,
  TimelineMarker,
} from "../Timeline";
import {
  TIMELINE_CIRCLE_SIZE,
  TIMELINE_MARKER_CLASS,
} from "../Timeline/config";
import type {
  Segment,
  TimelineActivePhase,
  TimelineSegmentStatus,
} from "../Timeline/types";
import { getSegmentLegDerivedState } from "./utils/segmentLegDerivedState";

// ============================================================================
// Types
// ============================================================================

type ScheduledTripLegProps = {
  segment: Segment;
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

// ============================================================================
// Component
// ============================================================================

/**
 * Renders one leg of a scheduled trip timeline using Timeline primitives.
 * Composes origin-arrive, at-dock, depart, at-sea, and arrive markers/bars with
 * schedule + actual/prediction times. Follows "render if exists" pattern: when
 * overlay data (actualTrip, vesselLocation) is absent, falls back to schedule-only.
 *
 * @param segment - Scheduled segment (leg) for this portion of the journey
 * @param vesselLocation - Real-time vessel location when available; null for schedule-only
 * @param actualTrip - Actual/predicted trip for this segment Key (from pipeline)
 * @param prevActualTrip - Trip for previous segment (used for depart-next prediction)
 * @param nextActualTrip - Trip for next segment (used for next-dock end time)
 * @param predictionTrip - Trip used for arrive-next on first segment (e.g. inbound)
 * @param legStatus - Timeline status for this segment (Completed / InProgress / Pending)
 * @param activeKey - Currently active segment Key for this vessel, or null
 * @param activePhase - Whether vessel is AtDock or AtSea when active
 * @param isFirst - True when this is the first segment of the journey
 * @param isLast - True when this is the last segment of the journey
 * @returns Fragment of Timeline markers and bars for this leg
 */
export const ScheduledTripLeg = ({
  segment,
  vesselLocation,
  actualTrip,
  prevActualTrip,
  nextActualTrip,
  predictionTrip,
  legStatus,
  activeKey,
  activePhase,
  isFirst,
  isLast,
}: ScheduledTripLegProps) => {
  const nowMs = vesselLocation?.TimeStamp?.getTime() ?? Date.now();
  const legState = getSegmentLegDerivedState(
    segment,
    vesselLocation ?? undefined,
    actualTrip,
    prevActualTrip,
    predictionTrip ?? prevActualTrip,
    nowMs
  );

  const isActive = activeKey != null && activeKey === segment.Key;
  const isHeld = isActive && !!actualTrip?.TripEnd;

  // Origin dock: Completed if journey done or leg done; InProgress if active and at dock (not held).
  const originDockStatus: TimelineSegmentStatus =
    legStatus === "Completed"
      ? "Completed"
      : isActive && activePhase === "AtDock" && !isHeld
        ? "InProgress"
        : isActive
          ? "Completed"
          : "Pending";

  // At-sea: Completed if held or journey done; InProgress if active and at sea; else Pending.
  const atSeaStatus: TimelineSegmentStatus =
    legStatus === "Completed"
      ? "Completed"
      : isHeld
        ? "Completed"
        : isActive && activePhase === "AtSea"
          ? "InProgress"
          : isActive
            ? "Pending"
            : "Pending";

  // Render if exists: use actual times when we have a historical match;
  // otherwise fall back to scheduled times (graceful degradation when overlay absent).
  const originDockStartMs =
    (legState.isHistoricalMatch && actualTrip?.TripStart?.getTime()) ||
    segment.SchedArriveCurr?.getTime();
  const originDockEndMs =
    (legState.isHistoricalMatch && actualTrip?.LeftDock?.getTime()) ||
    segment.DepartingTime.getTime();
  const atSeaStartMs =
    (legState.isHistoricalMatch &&
      (actualTrip?.LeftDock?.getTime() || actualTrip?.TripStart?.getTime())) ||
    segment.DepartingTime.getTime();
  const atSeaEndMs =
    (legState.isHistoricalMatch &&
      (actualTrip?.TripEnd?.getTime() ||
        legState.arrivalPrediction?.getTime())) ||
    segment.SchedArriveNext?.getTime();
  const nextDockStartMs =
    (legState.isHistoricalMatch && actualTrip?.TripEnd?.getTime()) ||
    segment.SchedArriveNext?.getTime();
  const nextDockEndMs =
    (legState.isHistoricalMatch && nextActualTrip?.TripStart?.getTime()) ||
    segment.NextDepartingTime?.getTime();

  // First segment shows origin dock (arrive at terminal); last segment has no "next dock" block.
  const showOriginBlock = isFirst;
  const showNextDockBlock = !isLast && segment.NextDepartingTime != null;

  return (
    <>
      {showOriginBlock && (
        <>
          <TimelineMarker
            size={TIMELINE_CIRCLE_SIZE}
            className={TIMELINE_MARKER_CLASS}
            zIndex={10}
          >
            <View className="items-center">
              <Text className="text-xs text-muted-foreground">
                {`${legState.originArriveInPast ? "Arrived" : "Arrive"} ${segment.DepartingTerminalAbbrev}`}
              </Text>
              {segment.SchedArriveCurr !== undefined ? (
                <TimelineDisplayTime
                  time={segment.SchedArriveCurr}
                  type="scheduled"
                  bold
                />
              ) : (
                <Text className="text-xs text-muted-foreground">--:--</Text>
              )}
              {/* Render if exists: actual arrival only when we have a match. */}
              {legState.showOriginActualTime && actualTrip?.TripStart && (
                <TimelineDisplayTime
                  time={actualTrip.TripStart}
                  type="actual"
                  bold={false}
                />
              )}
              {/* Render if exists: origin-arrive prediction from inbound trip. */}
              {!legState.isHistoricalMatch &&
                legState.originArrivePrediction != null && (
                  <TimelineDisplayTime
                    time={legState.originArrivePrediction}
                    type="estimated"
                    bold={false}
                  />
                )}
            </View>
          </TimelineMarker>

          <TimelineBarAtDock
            startTimeMs={originDockStartMs}
            endTimeMs={originDockEndMs}
            status={originDockStatus}
            isArrived={originDockStatus === "Completed"}
            isHeld={false}
            predictionEndTimeMs={
              isActive && activePhase === "AtDock"
                ? legState.departurePrediction?.getTime()
                : undefined
            }
            vesselName={vesselLocation?.VesselName}
            atDockAbbrev={
              isActive && activePhase === "AtDock" && !isHeld
                ? segment.DepartingTerminalAbbrev
                : undefined
            }
            showIndicator={isActive && activePhase === "AtDock" && !isHeld}
          />
        </>
      )}

      <TimelineMarker
        size={TIMELINE_CIRCLE_SIZE}
        className={TIMELINE_MARKER_CLASS}
        zIndex={10}
      >
        <View className="items-center">
          <Text className="text-xs text-muted-foreground">
            {`${legState.departInPast ? "Left" : "Depart"} ${segment.DepartingTerminalAbbrev}`}
          </Text>
          <TimelineDisplayTime
            time={segment.DepartingTime}
            type="scheduled"
            bold
          />
          {legState.isHistoricalMatch &&
          (actualTrip?.LeftDock ?? legState.departurePrediction) != null ? (
            <TimelineDisplayTime
              time={
                actualTrip?.LeftDock ??
                legState.departurePrediction ??
                segment.DepartingTime
              }
              type={actualTrip?.LeftDock != null ? "actual" : "estimated"}
              bold={false}
            />
          ) : null}
          {!legState.isHistoricalMatch &&
            legState.departNextPrediction != null && (
              <TimelineDisplayTime
                time={legState.departNextPrediction}
                type="estimated"
                bold={false}
              />
            )}
        </View>
      </TimelineMarker>

      <TimelineBarAtSea
        startTimeMs={atSeaStartMs}
        endTimeMs={atSeaEndMs}
        status={atSeaStatus}
        isArrived={isHeld || atSeaStatus === "Completed"}
        isHeld={isHeld}
        predictionEndTimeMs={
          isActive &&
          activePhase === "AtSea" &&
          legState.arrivalPrediction != null
            ? legState.arrivalPrediction.getTime()
            : undefined
        }
        departingDistance={vesselLocation?.DepartingDistance}
        arrivingDistance={vesselLocation?.ArrivingDistance}
        vesselName={vesselLocation?.VesselName}
        animate={isActive && activePhase === "AtSea" && !isHeld}
        speed={vesselLocation?.Speed}
        showIndicator={isActive && (activePhase === "AtSea" || isHeld)}
      />

      <TimelineMarker
        size={TIMELINE_CIRCLE_SIZE}
        className={TIMELINE_MARKER_CLASS}
        zIndex={10}
      >
        <View className="items-center">
          <Text className="text-xs text-muted-foreground">
            {`${legState.destArriveInPast ? "Arrived" : "Arrive"} ${segment.DisplayArrivingTerminalAbbrev ?? segment.ArrivingTerminalAbbrev}`}
          </Text>
          {segment.SchedArriveNext !== undefined ? (
            <TimelineDisplayTime
              time={segment.SchedArriveNext}
              type="scheduled"
              bold
            />
          ) : (
            <Text className="text-xs text-muted-foreground">--:--</Text>
          )}
          {legState.isHistoricalMatch &&
          (actualTrip?.TripEnd ?? legState.arrivalPrediction) != null ? (
            <TimelineDisplayTime
              time={
                actualTrip?.TripEnd ??
                legState.arrivalPrediction ??
                segment.SchedArriveNext
              }
              type={actualTrip?.TripEnd != null ? "actual" : "estimated"}
              bold={false}
            />
          ) : null}
        </View>
      </TimelineMarker>

      {showNextDockBlock && (
        <TimelineBarAtDock
          startTimeMs={nextDockStartMs}
          endTimeMs={nextDockEndMs}
          status={legStatus === "Completed" ? "Completed" : "Pending"}
          isArrived={legStatus === "Completed"}
          predictionEndTimeMs={
            isActive &&
            activePhase === "AtDock" &&
            actualTrip?.AtDockDepartNext != null
              ? actualTrip.AtDockDepartNext.PredTime.getTime()
              : undefined
          }
          vesselName={vesselLocation?.VesselName}
        />
      )}
    </>
  );
};
