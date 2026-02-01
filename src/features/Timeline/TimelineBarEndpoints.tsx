/**
 * Endpoint markers for `TimelineBar`.
 * Extracted to isolate absolute positioning concerns.
 */

import TimelineMarker from "./TimelineMarker";

export type TimelineBarEndpointsProps = {
  circleSize: number;
  zIndex: number;
};

/**
 * Renders the endpoint circle markers at the start and end of the progress bar.
 *
 * @param circleSize - Marker size in pixels
 * @param zIndex - Base z-index for stacking
 * @returns Endpoint circle markers
 */
export const TimelineBarEndpoints = ({
  circleSize,
  zIndex,
}: TimelineBarEndpointsProps) => {
  return (
    <>
      {[0, 100].map((percentage) => (
        <TimelineMarker
          key={`${percentage}%`}
          left={`${percentage}%`}
          className="bg-white border border-pink-500"
          zIndex={zIndex + 1}
          size={circleSize}
        />
      ))}
    </>
  );
};
