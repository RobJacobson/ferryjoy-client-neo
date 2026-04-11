/**
 * Timeline row shell using flex growth for proportional segments and layout measurement.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import type { RowLayoutBounds } from "../types";

export type TimelineRowFlexProps = {
  id: string;
  flexGrow: number;
  minHeight?: number;
  onRowLayout: (rowId: string, bounds: RowLayoutBounds) => void;
  rowClassName?: string;
  children: ReactNode;
};

/**
 * Renders a proportional timeline segment and reports measured bounds for overlays.
 *
 * @param id - Stable row id passed to `onRowLayout`
 * @param flexGrow - Flex grow weight (e.g. geometry minutes)
 * @param minHeight - Optional minimum height when using flex layout
 * @param onRowLayout - Called with row id and bounds after native layout
 * @param rowClassName - Optional width/layout classes for the row container
 * @param children - Row contents (typically `TimelineRowContent`)
 * @returns Row container with flex-based vertical sizing
 */
export const TimelineRowFlex = ({
  id,
  flexGrow,
  minHeight,
  onRowLayout,
  rowClassName,
  children,
}: TimelineRowFlexProps) => {
  const handleLayout = (event: {
    nativeEvent: { layout: RowLayoutBounds };
  }) => {
    const { y, height } = event.nativeEvent.layout;
    onRowLayout(id, { y, height });
  };

  return (
    <View
      className={cn("w-full", rowClassName)}
      style={{
        // `minHeight === 0` lets the final row collapse instead of forcing flex space.
        flexGrow: minHeight === 0 ? 0 : flexGrow,
        flexBasis: "auto",
        minHeight,
      }}
      onLayout={handleLayout}
    >
      {children}
    </View>
  );
};
