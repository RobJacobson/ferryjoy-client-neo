/**
 * Shared animated timeline indicator orchestrator.
 */

import type { ComponentRef, RefObject } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import type { View as UIView } from "@/components/ui";
import { TimelineIndicatorBadge } from "./TimelineIndicatorBadge";
import { TimelineIndicatorBanner } from "./TimelineIndicatorBanner";
import { INDICATOR_STYLE } from "./theme";
import { useAnimatedProgress } from "./useAnimatedProgress";
import { useRockingAnimation } from "./useRockingAnimation";

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
  sizePx = INDICATOR_STYLE.sizePx,
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
      className={INDICATOR_STYLE.containerClassName}
      style={[
        { left: "50%" },
        getAbsoluteCenteredBoxStyle({
          width: sizePx,
          height: sizePx,
        }),
        animatedStyle,
        rockingStyle,
      ]}
    >
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
