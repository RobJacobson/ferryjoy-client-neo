/**
 * StandardMarkerLayout provides a flexible marker layout wrapper.
 * Allows arbitrary content above, below, left, and right of the marker circle.
 * Supports both horizontal (above/below) and vertical (left/right) layouts.
 * Use with extractors and TimeBox for composition.
 */

import type { ReactNode } from "react";
import TimelineMarker from "../TimelineMarker";
import TimelineMarkerContent from "../TimelineMarkerContent";

type StandardMarkerLayoutProps = {
  /**
   * Content to render above the marker circle.
   * Receives a container with full width/height for positioning.
   */
  aboveContent?: ReactNode;
  /**
   * Content to render below the marker circle.
   * Receives a container with full width/height for positioning.
   */
  belowContent?: ReactNode;
  /**
   * Content to render to the left of the marker circle.
   * Used for vertical orientation.
   */
  leftContent?: ReactNode;
  /**
   * Content to render to the right of the marker circle.
   * Used for vertical orientation.
   */
  rightContent?: ReactNode;
  /**
   * Optional z-index to pass to TimelineMarker.
   * Default is 10.
   */
  zIndex?: number;
  /**
   * Optional size to pass to TimelineMarker.
   */
  size?: number;
  /**
   * Optional orientation to pass to TimelineMarker.
   * Default is "horizontal".
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Optional circleClassName to pass to TimelineMarker.
   */
  circleClassName?: string;
  /**
   * Optional style to pass to TimelineMarker.
   */
  style?: Parameters<typeof TimelineMarker>[0]["style"];
};

/**
 * A flexible marker layout wrapper that positions content around the marker circle.
 * The marker circle is always centered; use the content containers to position content.
 * Supports both horizontal (above/below) and vertical (left/right) layouts.
 *
 * @param aboveContent - Optional content to render above the marker (horizontal orientation)
 * @param belowContent - Optional content to render below the marker (horizontal orientation)
 * @param leftContent - Optional content to render left of the marker (vertical orientation)
 * @param rightContent - Optional content to render right of the marker (vertical orientation)
 * @param zIndex - Optional zIndex to pass to TimelineMarker (default 10)
 * @param size - Optional size to pass to TimelineMarker
 * @param orientation - Optional orientation to pass to TimelineMarker
 * @param circleClassName - Optional circleClassName to pass to TimelineMarker
 * @param style - Optional style to pass to TimelineMarker
 * @returns A TimelineMarker with optional content slots
 */
export const StandardMarkerLayout = ({
  aboveContent,
  belowContent,
  leftContent,
  rightContent,
  zIndex = 10,
  size,
  orientation = "horizontal",
  circleClassName,
  style,
}: StandardMarkerLayoutProps) => {
  return (
    <TimelineMarker
      zIndex={zIndex}
      size={size}
      orientation={orientation}
      circleClassName={circleClassName}
      style={style}
    >
      {aboveContent && (
        <TimelineMarkerContent className="mb-20">
          {aboveContent}
        </TimelineMarkerContent>
      )}
      {belowContent && (
        <TimelineMarkerContent className="mt-20">
          {belowContent}
        </TimelineMarkerContent>
      )}
      {leftContent && (
        <TimelineMarkerContent className="mr-20">
          {leftContent}
        </TimelineMarkerContent>
      )}
      {rightContent && (
        <TimelineMarkerContent className="ml-20">
          {rightContent}
        </TimelineMarkerContent>
      )}
    </TimelineMarker>
  );
};

export default StandardMarkerLayout;
