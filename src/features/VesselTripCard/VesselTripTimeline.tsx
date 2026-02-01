/**
 * TripProgressTimeline component for displaying vessel trip progress through two sequential time segments.
 * Shows progress from arriving at terminal A to departing A (first meter) and from departing A to arriving at B (second meter).
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { View } from "react-native";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { getVesselName } from "@/domain/vesselAbbreviations";
import { cn } from "@/lib/utils";
import {
  TimelineBar,
  TimelineDisplayTime,
  TimelineLabel,
  TimelineLegendText,
} from "../Timeline";
import { getArrivalTime, getDepartureTime } from "../Timeline/utils";

type VesselTripTimelineProps = {
  /**
   * VesselTrip object containing trip data with actual, predicted, and scheduled times.
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
 * using FlexBox flex-grow values with a minimum of 15% to ensure readability.
 * Each segment sizes itself based on its own time interval, so this component is
 * agnostic about sizing logic.
 *
 * The indicator is shown based on vessel state (AtDock property) rather than time-based progress,
 * allowing it to display correctly even when vessels are running late.
 *
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data
 * @param className - Optional className for styling the meter container
 * @returns A View component with two self-contained progress bars
 */
const VesselTripTimeline = ({ trip, className }: VesselTripTimelineProps) => {
  const { vesselLocations } = useConvexVesselLocations();
  const currentVessel = vesselLocations.find(
    (v) => v.VesselAbbrev === trip.VesselAbbrev
  );
  const vesselSpeed = currentVessel?.Speed ?? 0;

  const arriveCurrTime = trip.TripStart;
  const departCurrTime = getDepartureTime(trip);
  const predictedArrivalTime = getArrivalTime(trip);

  return (
    <View
      className={cn(
        "relative flex-row items-center justify-between w-full overflow-visible m-2 pr-4",
        className
      )}
    >
      {/* At Dock Start Label */}
      <TimelineLabel>
        <ArriveCurrLabel trip={trip} />
      </TimelineLabel>
      {/* At Dock Progress Bar */}
      <TimelineBar
        startTimeMs={arriveCurrTime?.getTime()}
        endTimeMs={departCurrTime?.getTime()}
        status={trip.AtDock ? "InProgress" : "Completed"}
        vesselName={getVesselName(trip.VesselAbbrev)}
      />
      {/* Depart Curr Label */}
      <TimelineLabel>
        <DepartCurrLabel trip={trip} />
      </TimelineLabel>
      {/* At Sea Progress Bar */}
      <TimelineBar
        startTimeMs={departCurrTime?.getTime()}
        endTimeMs={predictedArrivalTime?.getTime()}
        status={!trip.AtDock ? "InProgress" : "Pending"}
        vesselName={getVesselName(trip.VesselAbbrev)}
        animate={!trip.AtDock && !trip.TripEnd}
        speed={vesselSpeed}
      />
      {/* Destination Arrive Label */}
      <TimelineLabel>
        <DestinationArriveLabel trip={trip} />
      </TimelineLabel>
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
    <TimelineLegendText bold={false}>
      {`Arrived ${trip.DepartingTerminalAbbrev}`}
    </TimelineLegendText>
    <TimelineDisplayTime time={trip.TripStart} type="actual" bold />
  </>
);

/**
 * Renders label for the right circle of the at-dock progress bar.
 * Conditionally displays predicted departure time (when at dock), actual departure time (when left),
 * and scheduled departure time (if available).
 *
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with departure status text and time information
 */
const DepartCurrLabel = ({ trip }: { trip: VesselTrip }) => (
  <>
    <TimelineLegendText bold={false}>
      {trip.AtDock ? "Leaves" : "Left"} {trip.DepartingTerminalAbbrev}
    </TimelineLegendText>
    {trip.AtDock && (
      <TimelineDisplayTime
        time={trip.AtDockDepartCurr?.PredTime}
        type="estimated"
        bold
      />
    )}
    {!trip.AtDock && (
      <TimelineDisplayTime time={trip.LeftDock} type="actual" bold />
    )}
    <TimelineDisplayTime time={trip.ScheduledDeparture} type="scheduled" />
  </>
);

/**
 * Renders label for the right circle of the at-sea progress bar.
 * Displays the arriving terminal name and predicted arrival time.
 *
 * @param trip - VesselTrip object containing trip data
 * @returns A View component with terminal text and arrival time
 */
const DestinationArriveLabel = ({ trip }: { trip: VesselTrip }) => (
  <>
    <TimelineLegendText bold={false}>
      {`${trip.TripEnd ? "Arrived" : "Arrives"} ${trip.ArrivingTerminalAbbrev}`}
    </TimelineLegendText>
    {!trip.TripEnd && (
      <TimelineDisplayTime
        time={
          trip.Eta ||
          trip.AtSeaArriveNext?.PredTime ||
          trip.AtDockArriveNext?.PredTime
        }
        type="estimated"
        bold
      />
    )}
    {trip.TripEnd && (
      <TimelineDisplayTime time={trip.TripEnd} type="actual" bold />
    )}
  </>
);

export default VesselTripTimeline;
