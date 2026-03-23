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
