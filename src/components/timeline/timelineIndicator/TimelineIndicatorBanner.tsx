/**
 * Expandable text banner attached to the active timeline indicator.
 */
import type { ComponentRef, RefObject } from "react";
import { Pressable, type ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { Text, View } from "@/components/ui";
import { TIMELINE_INDICATOR_CONFIG } from "../config";
import { TimelineGlassSurface } from "../TimelineGlassSurface";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "../theme";

export type TimelineIndicatorBannerProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  onPress: () => void;
  title?: string;
  subtitle?: string;
  sizePx: number;
  theme: TimelineVisualTheme;
};

const { borderWidthPx, maxWidthPx, verticalOffsetPx } =
  TIMELINE_INDICATOR_CONFIG.banner;

/**
 * Anchors the banner above the indicator circle while keeping it centered.
 *
 * @param sizePx - Indicator diameter in pixels
 * @returns Absolute position for the banner container
 */
const getBannerStyle = (sizePx: number): ViewStyle => ({
  bottom: sizePx / 2 - verticalOffsetPx,
  left: -maxWidthPx / 2,
  width: maxWidthPx,
});

/**
 * Renders the tappable title/subtitle bubble above the active indicator.
 *
 * @param blurTargetRef - Host view sampled by the glass blur
 * @param onPress - Toggles banner visibility from the parent indicator
 * @param title - Primary vessel label
 * @param subtitle - Secondary live-state copy
 * @param sizePx - Indicator diameter used for vertical anchoring
 * @param theme - Banner glass, border, and text colors
 * @returns Banner view, or `null` when there is no text to show
 */
export const TimelineIndicatorBanner = ({
  blurTargetRef,
  onPress,
  title,
  subtitle,
  sizePx,
  theme,
}: TimelineIndicatorBannerProps) => {
  if (!title && !subtitle) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute items-center"
      style={getBannerStyle(sizePx)}
    >
      <Pressable
        onPress={onPress}
        className="overflow-hidden rounded-full"
        style={{
          maxWidth: maxWidthPx,
          borderWidth: borderWidthPx,
          borderColor: theme.indicatorColor,
        }}
      >
        <TimelineGlassSurface
          blurTargetRef={blurTargetRef}
          blurIntensity={TIMELINE_RENDER_CONSTANTS.glassBlurIntensity}
          theme={theme}
          className="rounded-full"
        >
          <View className="items-center px-4 py-1">
            {title && (
              <Text
                className="text-center font-playpen-600 leading-tight"
                style={{ color: theme.text.indicatorHeadlineColor }}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                className="text-center font-playpen-300 text-sm leading-tight"
                style={{ color: theme.text.bodyColor }}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </TimelineGlassSurface>
      </Pressable>
    </View>
  );
};
