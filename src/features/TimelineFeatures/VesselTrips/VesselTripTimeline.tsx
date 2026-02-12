/**
 * VesselTripTimeline: single-leg trip progress (arrive at A → at dock → depart A → at sea → arrive B).
 * VesselTrips owns composition, time selection, and marker content; Timeline provides only primitives.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import {
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineMarker,
  TimelineMarkerContent,
  TimelineMarkerLabel,
  TimelineMarkerTime,
} from "../Timeline";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getPredictedArriveNextTime,
  getPredictedDepartCurrTime,
} from "../Timeline/utils";

// ============================================================================
// Types
// ============================================================================

type VesselTripTimelineProps = {
  vesselLocation: VesselLocation;
  trip: VesselTrip;
  className?: string;
};

// ============================================================================
// Main component
// ============================================================================

/**
 * Displays vessel trip progress: arrive at origin → at-dock bar → depart → at-sea bar → arrive at destination.
 * VesselTrips selects times (actual/predicted/scheduled) and passes them as props; marker children are customizable.
 *
 * @param vesselLocation - Real-time WSF data (PRIMARY)
 * @param trip - Actual/predicted trip data (SECONDARY)
 * @param className - Optional container className
 */
const VesselTripTimeline = ({
  vesselLocation,
  trip,
  className,
}: VesselTripTimelineProps) => {
  const arriveCurrTime = trip.TripStart;
  const departCurrTime = getPredictedDepartCurrTime(trip);
  const predictedArrivalTime = getPredictedArriveNextTime(trip, vesselLocation);

  const departurePrediction = getBestDepartureTime(vesselLocation, trip);
  const arrivalPrediction = getBestArrivalTime(vesselLocation, trip);

  const isHeld = !!trip.TripEnd;
  const atDockStatus = isHeld
    ? "Completed"
    : vesselLocation?.AtDock
      ? "InProgress"
      : "Completed";
  const atSeaStatus = isHeld
    ? "Completed"
    : !vesselLocation?.AtDock
      ? "InProgress"
      : "Pending";

  return (
    <View
      className={cn(
        "relative w-full flex-row items-center justify-between overflow-visible",
        className
      )}
      style={{ minHeight: 80 }}
    >
      <TimelineMarker zIndex={10}>
        <TimelineMarkerContent className="mt-[90px]">
          <TimelineMarkerLabel
            text={`Arrived ${trip.DepartingTerminalAbbrev}`}
          />
          {(() => {
            const showActual =
              !!trip.TripStart &&
              (!trip.SailingDay ||
                getSailingDay(trip.TripStart) === trip.SailingDay);
            return showActual && trip.TripStart ? (
              <TimelineMarkerTime time={trip.TripStart} type="actual" isBold />
            ) : null;
          })()}
          <TimelineMarkerTime
            time={trip.ScheduledTrip?.SchedArriveCurr}
            type="scheduled"
          />
        </TimelineMarkerContent>
      </TimelineMarker>

      <TimelineBarAtDock
        startTimeMs={arriveCurrTime?.getTime()}
        endTimeMs={departCurrTime?.getTime()}
        status={atDockStatus}
        isArrived={!!vesselLocation?.AtDock}
        isHeld={isHeld}
        vesselLocation={vesselLocation}
      />

      <TimelineMarker zIndex={10}>
        <TimelineMarkerContent className="mt-[90px]">
          <TimelineMarkerLabel
            text={`${vesselLocation?.AtDock ? "Leaves" : "Left"} ${trip.DepartingTerminalAbbrev}`}
          />
          {(() => {
            const primaryTime = vesselLocation?.AtDock
              ? departurePrediction
              : (trip.LeftDock ?? departurePrediction);
            const primaryType =
              vesselLocation?.AtDock || !trip.LeftDock ? "estimated" : "actual";
            return primaryTime != null ? (
              <TimelineMarkerTime
                time={primaryTime}
                type={primaryType}
                isBold
              />
            ) : null;
          })()}
          {trip.ScheduledDeparture != null && (
            <TimelineMarkerTime
              time={trip.ScheduledDeparture}
              type="scheduled"
            />
          )}
        </TimelineMarkerContent>
      </TimelineMarker>

      <TimelineBarAtSea
        startTimeMs={departCurrTime?.getTime()}
        endTimeMs={predictedArrivalTime?.getTime()}
        status={atSeaStatus}
        isArrived={isHeld}
        isHeld={isHeld}
        vesselLocation={vesselLocation}
        animate={!vesselLocation?.AtDock && !trip.TripEnd}
      />

      <TimelineMarker zIndex={10}>
        <TimelineMarkerContent className="mt-[90px]">
          <TimelineMarkerLabel
            text={`${trip.TripEnd ? "Arrived" : "Arrives"} ${trip.ArrivingTerminalAbbrev}`}
          />
          {!trip.TripEnd && arrivalPrediction != null ? (
            <TimelineMarkerTime
              time={arrivalPrediction}
              type="estimated"
              isBold
            />
          ) : trip.TripEnd != null ? (
            <TimelineMarkerTime time={trip.TripEnd} type="actual" isBold />
          ) : null}
          {trip.ScheduledTrip?.SchedArriveNext != null && (
            <TimelineMarkerTime
              time={trip.ScheduledTrip.SchedArriveNext}
              type="scheduled"
            />
          )}
        </TimelineMarkerContent>
      </TimelineMarker>
    </View>
  );
};

export default VesselTripTimeline;
