/**
 * Shared measurable row shell for the vertical timeline renderer.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import type { RowLayoutBounds } from "../types";

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
    <View
      className={cn("w-full", rowClassName)}
      style={rowStyle}
      onLayout={handleLayout}
    >
      {children}
    </View>
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
