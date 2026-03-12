/**
 * Absolute overlay layer for the active timeline indicator.
 * Uses measured row bounds to convert row-local progress into a single
 * container-relative Y position above the full timeline.
 */

import type { RefObject } from "react";
import { type View as RNView, View } from "react-native";
import { INDICATOR_STYLE } from "../theme";
import type { RowLayoutBounds, TimelineActiveIndicator } from "../types";
import { getOverlayViewState } from "../utils/viewState";
import { TimelineIndicator } from "./TimelineIndicator";

type TimelineIndicatorOverlayProps = {
  overlayIndicator: TimelineActiveIndicator | null;
  blurTargetRef: RefObject<RNView | null>;
  /** Measured timeline row bounds used to position the active indicator. */
  rowLayouts?: Record<string, RowLayoutBounds>;
};

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
  const overlayViewState = getOverlayViewState(overlayIndicator, rowLayouts);

  if (!overlayViewState) {
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
        topPx={overlayViewState.topPx}
        shouldJump={overlayViewState.shouldJump}
        label={overlayViewState.label}
        sizePx={INDICATOR_STYLE.sizePx}
      />
    </View>
  );
};
