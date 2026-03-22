/**
 * Measurable row wrapper that reports layout bounds for indicator geometry.
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

/**
 * Applies flex or fixed height and forwards `onLayout` measurements.
 *
 * @param id - Row id aligned with `TimelineRenderRow.id`
 * @param layoutMode - `fixed` uses `size` as height; `flex` uses flex grow
 * @param size - Height in px when fixed, or flex grow weight when flex
 * @param minHeight - Optional minimum height when using flex layout
 * @param rowClassName - Optional width/layout classes for the row container
 * @param children - Row contents (typically `TimelineRowContent`)
 * @param onRowLayout - Called with `{ y, height }` after each layout pass
 * @returns The measurable row container
 */
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

  /**
   * Forwards native layout to the parent for indicator and track math.
   *
   * @param event - `onLayout` payload containing `y` and `height`
   */
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

/**
 * Builds row container styles for fixed-height or flex-grown segments.
 *
 * @param layoutMode - `fixed` vs proportional flex growth
 * @param size - Pixel height when fixed, or flex grow when flex
 * @param minHeight - Optional minimum height in flex mode
 * @returns Style object for the row `View`
 */
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
