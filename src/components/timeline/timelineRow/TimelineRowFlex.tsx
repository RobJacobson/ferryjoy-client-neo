/**
 * Timeline row shell using flex growth for proportional segments and layout
 * measurement (bounds feed track overlays elsewhere).
 */

import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { RowLayoutBounds } from "../types";

type TimelineRowFlexProps = {
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
const TimelineRowFlex = ({
  id,
  flexGrow,
  minHeight,
  onRowLayout,
  rowClassName,
  children,
}: TimelineRowFlexProps) => {
  /**
   * Reports this row's `y` and `height` to the parent so the shared track and
   * overlays align with row geometry after native layout.
   *
   * @param event - React Native `onLayout` event for this row container
   */
  const handleLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    onRowLayout(id, { y, height });
  };

  return (
    <View
      className={cn("w-full", rowClassName)}
      style={{
        // Final segment uses `minHeight === 0` so it can collapse instead of
        // absorbing leftover flex space.
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

export type { TimelineRowFlexProps };
export { TimelineRowFlex };
