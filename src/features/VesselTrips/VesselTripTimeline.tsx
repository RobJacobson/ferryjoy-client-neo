/**
 * TripProgressTimeline component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  TimelineBarAtDock,
  TimelineBarAtSea,
  TimelineDisplayTime,
  TimelineMarker,
} from "../Timeline";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getPredictedArriveNextTime,
  getPredictedDepartCurrTime,
} from "../Timeline/utils";

type VesselTripTimelineProps = {
  /**
   * VesselLocation with real-time WSF data (PRIMARY source).
   */
  vesselLocation: VesselLocation;
  /**
   * VesselTrip object containing trip data with actual, predicted, and scheduled times (SECONDARY source).
   */
  trip: VesselTrip;
  /**
   * Optional className for styling the container.
   */
  className?: string;
};

/**
 * Displays vessel trip progress through two sequential time segments with intelligent time selection and dynamic width allocation.
 *
 * The timeline visualizes a ferry trip as two distinct phases:
 * 1. First segment: Progress from arriving at terminal A to departing from A (docking/loading phase)
 * 2. Second segment: Progress from departing A to arriving at terminal B (at-sea transit phase)
 *
 * Time selection prioritizes actual times over predicted times over scheduled times for accuracy.
 * Width allocation dynamically distributes space between segments based on their relative durations,
 * using FlexBox flex-grow values proportional to segment duration (with a 5-minute minimum enforced by getTimelineLayout).
 * This ensures the timeline correctly reflects time proportions (e.g., a 20-minute dock segment and 40-minute sea segment
 * will display as 33% and 67% of total width respectively).
 *
 * The indicator is shown based on vessel state (AtDock property from VesselLocation) rather than time-based progress,
 * allowing it to display correctly even when vessels are running late.
 *
 * @param vesselLocation - VesselLocation with real-time WSF data (PRIMARY source)
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data (SECONDARY source)
 * @param className - Optional className for styling the meter container
 * @returns A View component with two self-contained progress bars
 */
const VesselTripTimeline = ({
  vesselLocation,
  trip,
  className,
}: VesselTripTimelineProps) => {
  const arriveCurrTime = trip.TripStart;
  const departCurrTime = getPredictedDepartCurrTime(trip);
  const predictedArrivalTime = getPredictedArriveNextTime(trip, vesselLocation);

  // Resolve predictions using client-side utilities (WSF > ML priority)
  const departurePrediction = getBestDepartureTime(vesselLocation, trip);
  const arrivalPrediction = getBestArrivalTime(vesselLocation, trip);

  const circleSize = 20;

  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible m-2 pr-4",
        className
      )}
      style={{ minHeight: 80 }} // Ensure enough height for markers and labels
    >
      {/* At Dock Start Marker & Label */}
      <TimelineMarker
        size={circleSize}
        className="bg-white border border-pink-500"
        zIndex={10}
      >
        <ArriveCurrLabel trip={trip} />
      </TimelineMarker>

      {/* At Dock Progress Bar */}
      <TimelineBarAtDock
        startTimeMs={arriveCurrTime?.getTime()}
        endTimeMs={departCurrTime?.getTime()}
        status={
          trip.TripEnd
            ? "Completed"
            : vesselLocation?.AtDock
              ? "InProgress"
              : "Completed"
        }
        vesselName={vesselLocation.VesselName}
        atDockAbbrev={vesselLocation.DepartingTerminalAbbrev}
        isArrived={!!trip.TripEnd}
        isHeld={!!trip.TripEnd}
      />

      {/* Depart Curr Marker & Label */}
      <TimelineMarker
        size={circleSize}
        className="bg-white border border-pink-500"
        zIndex={10}
      >
        <DepartCurrLabel
          vesselLocation={vesselLocation}
          departurePrediction={departurePrediction}
          trip={trip}
        />
      </TimelineMarker>

      {/* At Sea Progress Bar */}
      <TimelineBarAtSea
        departingDistance={vesselLocation?.DepartingDistance}
        arrivingDistance={vesselLocation?.ArrivingDistance}
        startTimeMs={departCurrTime?.getTime()}
        endTimeMs={predictedArrivalTime?.getTime()}
        status={
          trip.TripEnd
            ? "Completed"
            : !vesselLocation?.AtDock
              ? "InProgress"
              : "Pending"
        }
        vesselName={vesselLocation.VesselName}
        animate={!vesselLocation?.AtDock && !trip.TripEnd}
        speed={vesselLocation?.Speed}
        isArrived={!!trip.TripEnd}
        isHeld={!!trip.TripEnd}
      />

      {/* Destination Arrive Marker & Label */}
      <TimelineMarker
        size={circleSize}
        className="bg-white border border-pink-500"
        zIndex={10}
      >
        <DestinationArriveLabel
          arrivalPrediction={arrivalPrediction}
          trip={trip}
        />
      </TimelineMarker>
    </View>
  );
};

/**
 * Renders label for left circle of at-dock progress bar.
 * Displays the departing terminal name and actual arrival time.
 *
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with terminal text and arrival time
 */
const ArriveCurrLabel = ({ trip }: { trip: VesselTrip }) => (
  <>
    <Text className="text-xs text-muted-foreground">
      {`Arrived ${trip.DepartingTerminalAbbrev}`}
    </Text>
    <TimelineDisplayTime time={trip.TripStart} type="actual" bold />
    {trip.ScheduledTrip?.SchedArriveCurr && (
      <TimelineDisplayTime
        time={trip.ScheduledTrip?.SchedArriveCurr}
        type="scheduled"
      />
    )}
  </>
);

/**
 * Renders label for the right circle of the at-dock progress bar.
 * Conditionally displays predicted departure time (when at dock), actual departure time (when left),
 * and scheduled departure time (if available).
 *
 * @param vesselLocation - VesselLocation with real-time WSF data (PRIMARY)
 * @param departurePrediction - Resolved departure prediction
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with departure status text and time information
 */
const DepartCurrLabel = ({
  vesselLocation,
  departurePrediction,
  trip,
}: {
  vesselLocation: VesselLocation;
  departurePrediction: Date | undefined;
  trip: VesselTrip;
}) => (
  <>
    <Text className="text-xs text-muted-foreground">
      {vesselLocation?.AtDock ? "Leaves" : "Left"}{" "}
      {trip.DepartingTerminalAbbrev}
    </Text>
    {vesselLocation?.AtDock && departurePrediction && (
      <TimelineDisplayTime time={departurePrediction} type="estimated" bold />
    )}
    {!vesselLocation?.AtDock && (trip.LeftDock || departurePrediction) && (
      <TimelineDisplayTime
        time={trip.LeftDock ?? departurePrediction}
        type={trip.LeftDock ? "actual" : "estimated"}
        bold
      />
    )}
    <TimelineDisplayTime time={trip.ScheduledDeparture} type="scheduled" />
  </>
);

/**
 * Renders label for the right circle of the at-sea progress bar.
 * Displays the arriving terminal name and predicted arrival time.
 *
 * @param arrivalPrediction - Resolved arrival prediction
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with terminal text and arrival time
 */
const DestinationArriveLabel = ({
  arrivalPrediction,
  trip,
}: {
  arrivalPrediction: Date | undefined;
  trip: VesselTrip;
}) => (
  <>
    <Text className="text-xs text-muted-foreground">
      {`${trip.TripEnd ? "Arrived" : "Arrives"} ${trip.ArrivingTerminalAbbrev}`}
    </Text>
    {!trip.TripEnd && arrivalPrediction && (
      <TimelineDisplayTime time={arrivalPrediction} type="estimated" bold />
    )}
    {trip.TripEnd && (
      <TimelineDisplayTime time={trip.TripEnd} type="actual" bold />
    )}
    {trip.ScheduledTrip?.SchedArriveNext && (
      <TimelineDisplayTime
        time={trip.ScheduledTrip?.SchedArriveNext}
        type="scheduled"
      />
    )}
  </>
);

export default VesselTripTimeline;
