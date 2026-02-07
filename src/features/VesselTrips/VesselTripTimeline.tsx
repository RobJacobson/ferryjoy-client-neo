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
  TimelineMarkerlLabel,
} from "../Timeline";
import {
  TIMELINE_CIRCLE_SIZE,
  TIMELINE_MARKER_CLASS,
} from "../Timeline/config";
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
        "relative flex-row items-center justify-between w-full overflow-visible",
        className
      )}
      style={{ minHeight: 80 }}
    >
      <TimelineMarker
        size={TIMELINE_CIRCLE_SIZE}
        className={TIMELINE_MARKER_CLASS}
        zIndex={10}
      >
        {() => <ArriveCurrLabel trip={trip} />}
      </TimelineMarker>

      <TimelineBarAtDock
        startTimeMs={arriveCurrTime?.getTime()}
        endTimeMs={departCurrTime?.getTime()}
        status={atDockStatus}
        isArrived={isHeld}
        isHeld={isHeld}
        vesselName={vesselLocation.VesselName}
        atDockAbbrev={vesselLocation.DepartingTerminalAbbrev}
      />

      <TimelineMarker
        size={TIMELINE_CIRCLE_SIZE}
        className={TIMELINE_MARKER_CLASS}
        zIndex={10}
      >
        {() => (
          <DepartCurrLabel
            vesselLocation={vesselLocation}
            departurePrediction={departurePrediction}
            trip={trip}
          />
        )}
      </TimelineMarker>

      <TimelineBarAtSea
        startTimeMs={departCurrTime?.getTime()}
        endTimeMs={predictedArrivalTime?.getTime()}
        status={atSeaStatus}
        isArrived={isHeld}
        isHeld={isHeld}
        departingDistance={vesselLocation?.DepartingDistance}
        arrivingDistance={vesselLocation?.ArrivingDistance}
        vesselName={vesselLocation.VesselName}
        animate={!vesselLocation?.AtDock && !trip.TripEnd}
        speed={vesselLocation?.Speed}
      />

      <TimelineMarker
        size={TIMELINE_CIRCLE_SIZE}
        className={TIMELINE_MARKER_CLASS}
        zIndex={10}
      >
        {() => (
          <DestinationArriveLabel
            arrivalPrediction={arrivalPrediction}
            trip={trip}
          />
        )}
      </TimelineMarker>
    </View>
  );
};

// ============================================================================
// Marker label components (VesselTrips-owned; customizable)
// ============================================================================

const ArriveCurrLabel = ({ trip }: { trip: VesselTrip }) => {
  const showActual =
    !!trip.TripStart &&
    (!trip.SailingDay || getSailingDay(trip.TripStart) === trip.SailingDay);
  return (
    <TimelineMarkerlLabel
      LabelText={`Arrived ${trip.DepartingTerminalAbbrev}`}
      TimeOne={showActual ? { time: trip.TripStart, type: "actual" } : null}
      TimeTwo={
        trip.ScheduledTrip?.SchedArriveCurr
          ? {
              time: trip.ScheduledTrip.SchedArriveCurr,
              type: "scheduled",
            }
          : null
      }
    />
  );
};

const DepartCurrLabel = ({
  vesselLocation,
  departurePrediction,
  trip,
}: {
  vesselLocation: VesselLocation;
  departurePrediction: Date | undefined;
  trip: VesselTrip;
}) => (
  <TimelineMarkerlLabel
    LabelText={`${vesselLocation?.AtDock ? "Leaves" : "Left"} ${trip.DepartingTerminalAbbrev}`}
    TimeOne={
      vesselLocation?.AtDock
        ? { time: departurePrediction, type: "estimated" }
        : {
            time: trip.LeftDock ?? departurePrediction,
            type: trip.LeftDock ? "actual" : "estimated",
          }
    }
    TimeTwo={{ time: trip.ScheduledDeparture, type: "scheduled" }}
  />
);

const DestinationArriveLabel = ({
  arrivalPrediction,
  trip,
}: {
  arrivalPrediction: Date | undefined;
  trip: VesselTrip;
}) => (
  <TimelineMarkerlLabel
    LabelText={`${trip.TripEnd ? "Arrived" : "Arrives"} ${trip.ArrivingTerminalAbbrev}`}
    TimeOne={
      !trip.TripEnd
        ? { time: arrivalPrediction, type: "estimated" }
        : { time: trip.TripEnd, type: "actual" }
    }
    TimeTwo={
      trip.ScheduledTrip?.SchedArriveNext
        ? {
            time: trip.ScheduledTrip.SchedArriveNext,
            type: "scheduled",
          }
        : null
    }
  />
);

export default VesselTripTimeline;
