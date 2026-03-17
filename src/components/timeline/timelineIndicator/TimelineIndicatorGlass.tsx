import { BlurView } from "expo-blur";
import type { ComponentRef, ReactNode, RefObject } from "react";
import type { View as UIView } from "@/components/ui";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";

type TimelineIndicatorGlassProps = {
  blurTargetRef: RefObject<ComponentRef<typeof UIView> | null>;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export const TimelineIndicatorGlass = ({
  blurTargetRef,
  className,
  contentClassName,
  children,
}: TimelineIndicatorGlassProps) => (
  <View
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
