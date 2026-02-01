/**
 * Endpoint markers for `TimelineBar`.
 * Extracted to isolate absolute positioning concerns.
 */

import { cn } from "@/lib/utils";
import TimelineMarker from "./TimelineMarker";

export type TimelineBarEndpointsProps = {
  circleSize: number;
  /**
   * Optional className applied to the marker elements.
   */
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
export const TimelineBarEndpoints = ({
  circleSize,
  markerClassName,
  zIndex,
}: TimelineBarEndpointsProps) => {
  return (
    <>
      <TimelineMarker
        left="0%"
        className={cn("bg-white border border-pink-500", markerClassName)}
        zIndex={zIndex + 1}
        size={circleSize}
      />
      <TimelineMarker
        left="100%"
        className={cn("bg-white border border-pink-500", markerClassName)}
        zIndex={zIndex + 1}
        size={circleSize}
      />
    </>
  );
};
