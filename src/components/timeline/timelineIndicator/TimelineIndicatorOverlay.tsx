/**
 * Hosts `TimelineIndicator` when row layouts resolve an active overlay state.
 */

import type { ComponentRef, RefObject } from "react";
import { View } from "@/components/ui";
import { TIMELINE_INDICATOR_SIZE_PX } from "../config";
import type { TimelineVisualTheme } from "../theme";
import type { RowLayoutBounds, TimelineActiveIndicator } from "../types";
import { getOverlayViewState } from "../viewState";
import { TimelineIndicator } from "./TimelineIndicator";

type TimelineIndicatorOverlayProps = {
  overlayIndicator: TimelineActiveIndicator | null;
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
  rowLayouts: Record<string, RowLayoutBounds>;
  theme: TimelineVisualTheme;
};

/**
 * Positions the active indicator from `getOverlayViewState` and row layouts.
 *
 * @param overlayIndicator - Active row id, position, and copy, or null
 * @param blurTargetRef - Blur sampling target for glass surfaces
 * @param rowLayouts - Measured bounds keyed by row id
 * @param theme - Visual theme for the indicator subtree
 * @returns Overlay layer or null when the indicator should not show
 */
export const TimelineIndicatorOverlay = ({
  overlayIndicator,
  blurTargetRef,
  rowLayouts,
  theme,
}: TimelineIndicatorOverlayProps) => {
  const overlayViewState = getOverlayViewState(overlayIndicator, rowLayouts);

  if (!overlayViewState) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      style={{ zIndex: 10, elevation: 10 }}
    >
      <TimelineIndicator
        blurTargetRef={blurTargetRef}
        topPx={overlayViewState.topPx}
        label={overlayViewState.label}
        title={overlayIndicator?.title}
        subtitle={overlayIndicator?.subtitle}
        animate={overlayIndicator?.animate}
        speedKnots={overlayIndicator?.speedKnots}
        sizePx={TIMELINE_INDICATOR_SIZE_PX}
        theme={theme}
      />
    </View>
  );
};
