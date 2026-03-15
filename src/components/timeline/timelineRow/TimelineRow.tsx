/**
 * Shared measurable row shell for the vertical timeline renderer.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { cn } from "@/lib/utils";
import type { RowLayoutBounds } from "../types";

const ROW_LAYOUT_TRANSITION_DURATION_MS = 10000;

export type TimelineRowProps = {
  id: string;
  layoutMode?: "flex" | "fixed";
  size: number;
  minHeight?: number;
  rowClassName?: string;
  children: ReactNode;
  onRowLayout: (rowId: string, bounds: RowLayoutBounds) => void;
};

export const TimelineRow = ({
  id,
  layoutMode = "flex",
  size,
  minHeight,
  rowClassName,
  children,
  onRowLayout,
}: TimelineRowProps) => {
  const rowStyle = getVerticalRowStyle(layoutMode, size, minHeight);

  const handleLayout = (event: {
    nativeEvent: { layout: RowLayoutBounds };
  }) => {
    const { y, height } = event.nativeEvent.layout;
    onRowLayout(id, { y, height });
  };

  return (
    <Animated.View
      className={cn("w-full", rowClassName)}
      style={rowStyle}
      layout={LinearTransition.duration(
        ROW_LAYOUT_TRANSITION_DURATION_MS
      ).easing(Easing.inOut(Easing.quad))}
      onLayout={handleLayout}
    >
      {children}
    </Animated.View>
  );
};

const getVerticalRowStyle = (
  layoutMode: "flex" | "fixed",
  size: number,
  minHeight?: number
): ViewStyle =>
  layoutMode === "fixed"
    ? {
        height: size,
      }
    : {
        flexGrow: minHeight === 0 ? 0 : size,
        flexBasis: "auto",
        minHeight,
      };
