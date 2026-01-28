/**
 * Endpoint markers + below-label rendering for `TripProgressBar`.
 * Extracted to isolate absolute positioning concerns.
 */

import type { ReactElement } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import TripProgressMarker from "./TripProgressMarker";

export type TripProgressBarEndpointsProps = {
  leftCircleLabel?: ReactElement | null;
  rightCircleLabel?: ReactElement | null;
  circleSize: number;
  markerClassName?: string;
  zIndex: number;
};

/**
 * Renders the endpoint markers and their labels.
 *
 * @param leftCircleLabel - Optional left label ReactElement
 * @param rightCircleLabel - Optional right label ReactElement
 * @param circleSize - Marker size in pixels
 * @param markerClassName - Optional theme className for markers
 * @param zIndex - Base z-index for stacking
 * @returns Endpoint markers + labels
 */
export const TripProgressBarEndpoints = ({
  leftCircleLabel,
  rightCircleLabel,
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
      {leftCircleLabel && (
        <CircleLabel label={leftCircleLabel} zIndex={zIndex} />
      )}
      <TripProgressMarker
        left="100%"
        className={cn("bg-white border border-pink-500", markerClassName)}
        zIndex={zIndex + 1}
        size={circleSize}
      />
      {rightCircleLabel && (
        <CircleLabel label={rightCircleLabel} isRight zIndex={zIndex} />
      )}
    </>
  );
};

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Renders a label positioned below a circle marker using CSS centering.
 *
 * @param label - Label ReactElement to display
 * @param isRight - Whether this is the right circle (affects position)
 * @param zIndex - Optional z-index for stacking order
 * @returns A View component with the label
 */
const CircleLabel = ({
  label,
  isRight,
  zIndex,
}: {
  label: ReactElement;
  isRight?: boolean;
  zIndex?: number;
}) => {
  return (
    <View
      className="absolute"
      style={{
        top: "100%",
        left: isRight ? "100%" : "0%",
        transform: [{ translateX: "-50%" }],
        zIndex,
      }}
    >
      {label}
    </View>
  );
};
