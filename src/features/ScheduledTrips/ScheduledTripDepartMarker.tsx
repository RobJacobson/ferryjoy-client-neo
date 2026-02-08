/**
 * Depart marker for ScheduledTripTimeline: "Depart/Left" + DepartingTerminalAbbrev.
 * Shows scheduled departure and actual or estimated departure time.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { TimelineMarker, TimelineMarkerlLabel } from "../Timeline";
import type { Segment } from "../Timeline/types";
import {
  getBestDepartureTime,
  getBestNextDepartureTime,
} from "../Timeline/utils";

/**
 * Renders the depart marker for a segment (left/depart from terminal).
 * Uses actual LeftDock when available, else departure prediction or next prediction.
 *
 * @param segment - Segment for this leg
 * @param actualTrip - VesselTrip overlay for this segment, if any
 * @param vesselLocation - Real-time vessel location, or undefined
 * @param prevActualTrip - Trip for previous segment (PrevKey), for next-depart prediction
 * @param predictionTrip - Fallback trip for next-depart prediction when no prev actual
 * @returns TimelineMarker with "Depart/Left" label and times
 */
export const ScheduledTripDepartMarker = ({
  segment,
  actualTrip,
  vesselLocation,
  prevActualTrip,
  predictionTrip,
}: {
  segment: Segment;
  actualTrip: VesselTrip | undefined;
  vesselLocation: VesselLocation | undefined;
  prevActualTrip: VesselTrip | undefined;
  predictionTrip: VesselTrip | undefined;
}) => {
  const departurePrediction = getBestDepartureTime(vesselLocation, actualTrip);
  const departNextPrediction = getBestNextDepartureTime(
    prevActualTrip ?? predictionTrip
  );
  const isHistoricalMatch = actualTrip !== undefined;

  return (
    <TimelineMarker zIndex={10}>
      {() => (
        <TimelineMarkerlLabel
          LabelText={`${actualTrip?.LeftDock ? "Left" : "Depart"} ${segment.DepartingTerminalAbbrev}`}
          TimeOne={{ time: segment.DepartingTime, type: "scheduled" }}
          TimeTwo={{
            time: isHistoricalMatch
              ? (actualTrip?.LeftDock ??
                departurePrediction ??
                segment.DepartingTime)
              : departNextPrediction,
            type:
              actualTrip?.LeftDock != null
                ? ("actual" as const)
                : ("estimated" as const),
          }}
        />
      )}
    </TimelineMarker>
  );
};
