/**
 * Shared absolute overlay for a single active timeline indicator.
 */

import type { ComponentRef, RefObject } from "react";
import { View } from "@/components/ui";
import type { RowLayoutBounds, TimelineActiveIndicator } from "../types";
import { getOverlayViewState } from "../viewState";
import { TimelineIndicator } from "./TimelineIndicator";

type TimelineIndicatorOverlayProps = {
  overlayIndicator: TimelineActiveIndicator | null;
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
  /** Measured timeline row bounds used to position the active indicator. */
  rowLayouts?: Record<string, RowLayoutBounds>;
};

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
    <View pointerEvents="none" className="absolute inset-0">
      <TimelineIndicator
        blurTargetRef={blurTargetRef}
        topPx={overlayViewState.topPx}
        shouldJump={overlayViewState.shouldJump}
        label={overlayViewState.label}
        title={overlayIndicator?.title}
        subtitle={overlayIndicator?.subtitle}
        animate={overlayIndicator?.animate}
        speedKnots={overlayIndicator?.speedKnots}
        sizePx={42}
      />
    </View>
  );
};
