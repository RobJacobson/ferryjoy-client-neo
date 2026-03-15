/**
 * Shared animated timeline indicator orchestrator.
 */

import type { ComponentRef, RefObject } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { View as UIView } from "@/components/ui";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TIMELINE_TRACK_X_POSITION_PERCENT } from "../config";
import { useAnimatedProgress } from "../useAnimatedProgress";
import { useRockingAnimation } from "../useRockingAnimation";
import { TimelineIndicatorBadge } from "./TimelineIndicatorBadge";
import { TimelineIndicatorBanner } from "./TimelineIndicatorBanner";
import { TimelineIndicatorRadarPing } from "./TimelineIndicatorRadarPing";
import type { TimelineIndicatorRadarPingVariant } from "./timelineIndicatorRadarPingConfig";

type TimelineIndicatorProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  topPx: number;
  shouldJump?: boolean;
  label: string;
  title?: string;
  subtitle?: string;
  animate?: boolean;
  speedKnots?: number;
  sizePx?: number;
  showRadarPing?: boolean;
  radarPingVariant?: TimelineIndicatorRadarPingVariant;
};

export const TimelineIndicator = ({
  blurTargetRef,
  topPx,
  shouldJump = false,
  label,
  title,
  subtitle,
  animate = false,
  speedKnots = 0,
  sizePx = 42,
  showRadarPing = true,
  radarPingVariant = "glass-orchid",
}: TimelineIndicatorProps) => {
  const progress = useAnimatedProgress(topPx, shouldJump);
  const rockingStyle = useRockingAnimation(animate, speedKnots);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: progress.value,
    };
  }, [progress]);

  return (
    <Animated.View
      style={[
        { left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%` },
        getAbsoluteCenteredBoxStyle({
          width: sizePx,
          height: sizePx,
        }),
        animatedStyle,
        rockingStyle,
      ]}
    >
      {showRadarPing ? (
        <TimelineIndicatorRadarPing
          sizePx={sizePx}
          variant={radarPingVariant}
        />
      ) : null}
      <TimelineIndicatorBanner
        blurTargetRef={blurTargetRef}
        title={title}
        subtitle={subtitle}
        sizePx={sizePx}
      />
      <TimelineIndicatorBadge
        blurTargetRef={blurTargetRef}
        label={label}
        sizePx={sizePx}
      />
    </Animated.View>
  );
};
