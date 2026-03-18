import { BlurView } from "expo-blur";
import type { ComponentRef, ReactNode, RefObject } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { View as UIView } from "@/components/ui";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";

type TimelineIndicatorGlassProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  className?: string;
  style?: StyleProp<ViewStyle>;
  contentClassName?: string;
  children: ReactNode;
};

export const TimelineIndicatorGlass = ({
  blurTargetRef,
  className,
  style,
  contentClassName,
  children,
}: TimelineIndicatorGlassProps) => (
  <View
    style={style}
    className={cn(
      "overflow-hidden rounded-full border border-purple-400",
      className
    )}
  >
    <BlurView
      blurTarget={blurTargetRef}
      intensity={8}
      tint="light"
      blurMethod="dimezisBlurView"
      className="absolute inset-0"
    />
    <View className="absolute inset-0 bg-white/50" />
    <View className={contentClassName}>{children}</View>
  </View>
);
