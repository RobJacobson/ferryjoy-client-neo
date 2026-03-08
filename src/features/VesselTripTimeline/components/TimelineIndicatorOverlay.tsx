/**
 * Absolute overlay layer for the active timeline indicator.
 * Uses measured row bounds to convert row-local progress into a single
 * container-relative Y position above the full timeline.
 */

import type { RefObject } from "react";
import { type View as RNView, View } from "react-native";
import { clamp } from "@/shared/utils";
import type { RowLayoutBounds } from "../types";
import type { OverlayIndicator } from "../utils";
import { TimelineIndicator } from "./TimelineIndicator";

const INDICATOR_SIZE_PX = 36;

type TimelineIndicatorOverlayProps = {
  overlayIndicator: OverlayIndicator;
  blurTargetRef: RefObject<RNView | null>;
  /** Measured timeline row bounds used to position the active indicator. */
  rowLayouts?: Record<string, RowLayoutBounds>;
};

/**
 * Converts row-local progress into an absolute container-relative Y position.
 *
 * @param layout - Measured y and height for the active timeline row
 * @param positionPercent - Row-local progress between 0 and 1
 * @returns Container-relative top position in pixels
 */
const getIndicatorTopPx = (
  layout: RowLayoutBounds,
  positionPercent: number
): number => layout.y + layout.height * clamp(positionPercent, 0, 1);

/**
 * Renders a single absolute overlay indicator when the active row has
 * measured bounds available.
 *
 * @param overlayIndicator - Active overlay indicator model
 * @param blurTargetRef - Ref to the BlurTargetView for blur effect
 * @param rowLayouts - Optional measured row bounds for exact alignment
 * @returns Overlay view with indicator
 */
export const TimelineIndicatorOverlay = ({
  overlayIndicator,
  blurTargetRef,
  rowLayouts = {},
}: TimelineIndicatorOverlayProps) => {
  const activeRowLayout = rowLayouts[overlayIndicator.rowId];

  if (!activeRowLayout) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 z-10"
      style={{ elevation: 10 }}
    >
      <TimelineIndicator
        blurTargetRef={blurTargetRef}
        topPx={getIndicatorTopPx(
          activeRowLayout,
          overlayIndicator.positionPercent
        )}
        shouldJump={
          overlayIndicator.positionPercent === 0 ||
          overlayIndicator.positionPercent === 1
        }
        label={overlayIndicator.label}
        sizePx={INDICATOR_SIZE_PX}
      />
    </View>
  );
};
