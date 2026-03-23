import type { ComponentRef, RefObject } from "react";
import type { View as UIView } from "@/components/ui";
import { Text, View } from "@/components/ui";
import { TIMELINE_INDICATOR_CONFIG } from "../config";
import { TimelineGlassSurface } from "../TimelineGlassSurface";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "../theme";

export type TimelineIndicatorCircleProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  label: string;
  sizePx: number;
  theme: TimelineVisualTheme;
};

export const TimelineIndicatorCircle = ({
  blurTargetRef,
  label,
  sizePx,
  theme,
}: TimelineIndicatorCircleProps) => (
  <View
    pointerEvents="none"
    className="absolute overflow-hidden rounded-full"
    style={{
      width: sizePx,
      height: sizePx,
      borderWidth: TIMELINE_INDICATOR_CONFIG.circle.borderWidthPx,
      borderColor: theme.indicator.borderColor,
    }}
  >
    <TimelineGlassSurface
      blurTargetRef={blurTargetRef}
      blurIntensity={TIMELINE_RENDER_CONSTANTS.indicator.glassBlurIntensity}
      theme={theme}
      className="h-full w-full rounded-full"
    >
      <View className="h-full w-full items-center justify-center">
        <Text
          className="font-playpen-600"
          style={{ color: theme.text.indicatorHeadlineColor }}
        >
          {label}
        </Text>
      </View>
    </TimelineGlassSurface>
  </View>
);
