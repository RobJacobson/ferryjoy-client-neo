/**
 * Shared glass wrapper for timeline cards, indicator surfaces, and badges.
 *
 * It layers blur plus a theme-driven tint, while callers own sizing, borders,
 * and any interior content.
 */
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { BlurView, type BlurViewProps } from "@/components/BlurView";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TimelineVisualTheme } from "./theme";

type TimelineGlassSurfaceProps = {
  blurTargetRef: NonNullable<BlurViewProps["blurTarget"]>;
  blurIntensity: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  theme: TimelineVisualTheme;
};

/**
 * Renders a reusable blurred glass surface with the timeline's shared tint.
 *
 * @param blurTargetRef - Host view sampled by the blur implementation
 * @param blurIntensity - Blur strength for this surface
 * @param className - Optional utility classes for the wrapper
 * @param style - Optional style overrides for sizing or positioning
 * @param children - Surface contents rendered above blur and tint layers
 * @param theme - Visual theme supplying the shared glass color
 * @returns Non-interactive glass wrapper view
 */
export const TimelineGlassSurface = ({
  blurTargetRef,
  blurIntensity,
  className,
  style,
  children,
  theme,
}: TimelineGlassSurfaceProps) => (
  <View
    className={cn("overflow-hidden", className)}
    style={style}
    pointerEvents="none"
  >
    <BlurView
      blurTarget={blurTargetRef}
      intensity={blurIntensity}
      blurMethod="dimezisBlurView"
      className="absolute inset-0"
    />
    <View
      className="absolute inset-0"
      style={{ backgroundColor: theme.glassColor }}
    />
    {children}
  </View>
);
