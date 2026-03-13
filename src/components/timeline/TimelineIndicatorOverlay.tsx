/**
 * Shared absolute overlay for a single active timeline indicator.
 */

import type { RefObject } from "react";
import { type View as RNView, View } from "react-native";
import { INDICATOR_STYLE } from "./theme";
import type { RowLayoutBounds, TimelineActiveIndicator } from "./types";
import { getOverlayViewState } from "./viewState";
import { TimelineIndicator } from "./TimelineIndicator";

type TimelineIndicatorOverlayProps = {
  overlayIndicator: TimelineActiveIndicator | null;
  blurTargetRef: RefObject<RNView | null>;
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
