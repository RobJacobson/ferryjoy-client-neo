/**
 * Circular badge at the center of the active timeline indicator.
 */
import type { ComponentRef, RefObject } from "react";
import { Pressable } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text, View } from "@/components/ui";
import { TIMELINE_INDICATOR_CONFIG } from "../config";
import { TimelineGlassSurface } from "../TimelineGlassSurface";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "../theme";

export type TimelineIndicatorCircleProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  label: string;
  onPress: () => void;
  sizePx: number;
  theme: TimelineVisualTheme;
};

/**
 * Renders the tappable circular countdown badge for the active row.
 *
 * @param blurTargetRef - Host view sampled by the glass blur
 * @param label - Short countdown or placeholder label inside the badge
 * @param onPress - Toggles the companion banner
 * @param sizePx - Badge width and height in pixels
 * @param theme - Circle border, glass, and text colors
 * @returns Circular pressable indicator badge
 */
export const TimelineIndicatorCircle = ({
  blurTargetRef,
  label,
  onPress,
  sizePx,
  theme,
}: TimelineIndicatorCircleProps) => (
  <Pressable
    onPress={onPress}
    pointerEvents="auto"
    style={{
      width: sizePx,
      height: sizePx,
    }}
  >
    <View
      pointerEvents="none"
      className="absolute overflow-hidden rounded-full"
      style={{
        width: sizePx,
        height: sizePx,
        borderWidth: TIMELINE_INDICATOR_CONFIG.circle.borderWidthPx,
        borderColor: theme.indicatorColor,
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
  </Pressable>
);
