/**
 * Endpoint markers for `TripProgressBar`.
 * Extracted to isolate absolute positioning concerns.
 */

import { cn } from "@/lib/utils";
import TripProgressMarker from "./TripProgressMarker";

export type TripProgressBarEndpointsProps = {
  circleSize: number;
  markerClassName?: string;
  zIndex: number;
};

/**
 * Renders the endpoint circle markers at the start and end of the progress bar.
 *
 * @param circleSize - Marker size in pixels
 * @param markerClassName - Optional theme className for markers
 * @param zIndex - Base z-index for stacking
 * @returns Endpoint circle markers
 */
export const TripProgressBarEndpoints = ({
  circleSize,
  markerClassName,
  zIndex,
}: TripProgressBarEndpointsProps) => {
  return (
    <>
      <TripProgressMarker
        left="0%"
        className={cn("bg-white border border-pink-500", markerClassName)}
        zIndex={zIndex + 1}
        size={circleSize}
      />
      <TripProgressMarker
        left="100%"
        className={cn("bg-white border border-pink-500", markerClassName)}
        zIndex={zIndex + 1}
        size={circleSize}
      />
    </>
  );
};
