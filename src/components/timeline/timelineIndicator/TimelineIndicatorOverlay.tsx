/**
 * Shared absolute overlay for a single active timeline indicator.
 */

import type { ComponentRef, RefObject } from "react";
import { View } from "@/components/ui";
import { TIMELINE_INDICATOR_SIZE_PX } from "../config";
import {
  DEFAULT_TIMELINE_VISUAL_THEME,
  type TimelineVisualTheme,
} from "../theme";
import type { RowLayoutBounds, TimelineActiveIndicator } from "../types";
import { getOverlayViewState } from "../viewState";
import { TimelineIndicator } from "./TimelineIndicator";

type TimelineIndicatorOverlayProps = {
  overlayIndicator: TimelineActiveIndicator | null;
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
  /** Measured timeline row bounds used to position the active indicator. */
  rowLayouts: Record<string, RowLayoutBounds>;
  theme?: TimelineVisualTheme;
};

export const TimelineIndicatorOverlay = ({
  overlayIndicator,
  blurTargetRef,
  rowLayouts,
  theme = DEFAULT_TIMELINE_VISUAL_THEME,
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
