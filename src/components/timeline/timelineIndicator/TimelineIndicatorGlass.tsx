/**
 * Circular glass surface shared by the indicator badge and banner.
 */

import { BlurView } from "expo-blur";
import type { ComponentRef, ReactNode, RefObject } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { TIMELINE_RENDER_CONSTANTS, type TimelineVisualTheme } from "../theme";

type TimelineIndicatorGlassProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  className?: string;
  style?: StyleProp<ViewStyle>;
  contentClassName?: string;
  children: ReactNode;
  theme: TimelineVisualTheme;
};

/**
 * Rounded blur-backed container with themed border for indicator chrome.
 *
 * @param blurTargetRef - Host view used as the blur sampling target
 * @param className - Optional outer container classes
 * @param style - Optional outer container styles
 * @param contentClassName - Classes for the foreground content wrapper
 * @param children - Inner content (typically text)
 * @param theme - Indicator border color from the visual theme
 * @returns Clipped circular glass frame
 */
export const TimelineIndicatorGlass = ({
  blurTargetRef,
  className,
  style,
  contentClassName,
  children,
  theme,
}: TimelineIndicatorGlassProps) => (
  <View
    style={[
      style,
      {
        borderWidth: 1,
        borderColor: theme.indicator.borderColor,
      },
    ]}
    className={cn("overflow-hidden rounded-full", className)}
    pointerEvents="none"
  >
    <BlurView
      blurTarget={blurTargetRef}
      intensity={TIMELINE_RENDER_CONSTANTS.indicator.glassBlurIntensity}
      tint="light"
      blurMethod="dimezisBlurView"
      className="absolute inset-0"
    />
    <View className="absolute inset-0 bg-white/50" />
    <View className={contentClassName}>{children}</View>
  </View>
);
